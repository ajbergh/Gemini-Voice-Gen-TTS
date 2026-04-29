// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_stitch.go implements the project audio stitching
// endpoint. It reads cached PCM takes for each segment, optionally applies
// a finishing profile (trim silence, normalize peak, inter-segment gaps),
// concatenates the buffers, encodes to WAV, and returns the file.
package handler

import (
	"encoding/binary"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strconv"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// StitchHandler handles POST /api/projects/{id}/stitch.
type StitchHandler struct {
	Store         *store.Store
	AudioCacheDir string
}

// stitchRequest is the optional JSON body for the stitch endpoint.
type stitchRequest struct {
	ExportProfileID *int64 `json:"export_profile_id,omitempty"`
	SectionID       *int64 `json:"section_id,omitempty"`
}

// StitchProject concatenates approved/rendered takes into a single WAV file.
func (h *StitchHandler) StitchProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}

	var req stitchRequest
	if r.ContentLength > 0 {
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
	}

	// Optionally load an export profile.
	var profile *store.ExportProfile
	if req.ExportProfileID != nil {
		p, err := h.Store.GetExportProfile(*req.ExportProfileID)
		if err != nil {
			writeError(w, http.StatusNotFound, "export profile not found")
			return
		}
		profile = p
	}

	// Load all segments for the project.
	segments, err := h.Store.ListProjectSegments(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list segments")
		return
	}

	// Filter by section if requested.
	if req.SectionID != nil {
		filtered := segments[:0]
		for _, seg := range segments {
			if seg.SectionID != nil && *seg.SectionID == *req.SectionID {
				filtered = append(filtered, seg)
			}
		}
		segments = filtered
	}

	// Collect PCM buffers.
	var pcmBuffers [][]byte
	for _, seg := range segments {
		take, err := h.Store.GetBestTakeForSegment(projectID, seg.ID)
		if err != nil || take == nil || take.AudioPath == nil {
			slog.Debug("stitch: segment skipped (no audio)", "segment_id", seg.ID)
			continue
		}
		pcm, err := readCachedAudioFile(h.AudioCacheDir, *take.AudioPath)
		if err != nil {
			slog.Warn("stitch: segment skipped (read error)", "segment_id", seg.ID, "err", err)
			continue
		}
		pcmBuffers = append(pcmBuffers, pcm)
	}

	if len(pcmBuffers) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "no renderable segments with cached audio found")
		return
	}

	// Inter-segment silence (default 500 ms = 24 000 samples * 2 bytes).
	interSilenceMs := 500
	if profile != nil {
		interSilenceMs = profile.InterSegmentSilenceMs
	}
	silenceBytes := makePCMSilence(interSilenceMs)

	// Trim + concatenate.
	var allPCM []byte
	for i, buf := range pcmBuffers {
		seg := buf
		if profile != nil && profile.TrimSilence {
			seg = trimPCMSilence(seg, profile.SilenceThresholdDb)
		}
		allPCM = append(allPCM, seg...)
		if i < len(pcmBuffers)-1 {
			allPCM = append(allPCM, silenceBytes...)
		}
	}

	// Add leading/trailing pad.
	if profile != nil {
		if profile.LeadingSilenceMs > 0 {
			allPCM = append(makePCMSilence(profile.LeadingSilenceMs), allPCM...)
		}
		if profile.TrailingSilenceMs > 0 {
			allPCM = append(allPCM, makePCMSilence(profile.TrailingSilenceMs)...)
		}
	}

	// Normalize peak amplitude.
	if profile != nil && profile.NormalizePeakDb != 0 {
		allPCM = normalizePCMPeak(allPCM, profile.NormalizePeakDb)
	}

	// Encode to WAV.
	wavData := encodePCMToWAV(allPCM, 24000, 1, 16)

	filename := fmt.Sprintf("project-%d-export.wav", projectID)
	if req.SectionID != nil {
		filename = fmt.Sprintf("project-%d-section-%d-export.wav", projectID, *req.SectionID)
	}

	w.Header().Set("Content-Type", "audio/wav")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(wavData)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(wavData)
}

// ---------------------------------------------------------------------------
// PCM helpers
// ---------------------------------------------------------------------------

// makePCMSilence returns a byte slice of silent 16-bit PCM samples for the
// given duration in milliseconds at 24 kHz.
func makePCMSilence(ms int) []byte {
	samples := (ms * 24000) / 1000
	return make([]byte, samples*2) // 16-bit zeros = digital silence
}

// trimPCMSilence strips leading and trailing silence from 16-bit LE PCM.
// thresholdDb is negative (e.g. -50) — samples below this level are silent.
func trimPCMSilence(pcm []byte, thresholdDb float64) []byte {
	if len(pcm) < 2 {
		return pcm
	}
	linThreshold := math.Pow(10, thresholdDb/20) * 32768.0

	start := 0
	for start+1 < len(pcm) {
		s := int16(binary.LittleEndian.Uint16(pcm[start : start+2]))
		if math.Abs(float64(s)) > linThreshold {
			break
		}
		start += 2
	}

	end := len(pcm) - 2
	for end >= start {
		s := int16(binary.LittleEndian.Uint16(pcm[end : end+2]))
		if math.Abs(float64(s)) > linThreshold {
			break
		}
		end -= 2
	}

	if start > end {
		return []byte{}
	}
	// Align to sample boundary.
	return pcm[start : end+2]
}

// normalizePCMPeak scales 16-bit LE PCM so the peak amplitude equals
// targetDb dBFS (e.g. -1.0 for -1 dBFS).
func normalizePCMPeak(pcm []byte, targetDb float64) []byte {
	if len(pcm) < 2 {
		return pcm
	}
	var peak float64
	for i := 0; i+1 < len(pcm); i += 2 {
		s := math.Abs(float64(int16(binary.LittleEndian.Uint16(pcm[i : i+2]))))
		if s > peak {
			peak = s
		}
	}
	if peak == 0 {
		return pcm
	}
	targetLinear := math.Pow(10, targetDb/20) * 32768.0
	gain := targetLinear / peak

	out := make([]byte, len(pcm))
	for i := 0; i+1 < len(pcm); i += 2 {
		s := float64(int16(binary.LittleEndian.Uint16(pcm[i:i+2]))) * gain
		if s > 32767 {
			s = 32767
		} else if s < -32768 {
			s = -32768
		}
		binary.LittleEndian.PutUint16(out[i:i+2], uint16(int16(s)))
	}
	return out
}

// encodePCMToWAV wraps raw PCM bytes in a minimal RIFF/WAV header.
func encodePCMToWAV(pcm []byte, sampleRate, numChannels, bitsPerSample int) []byte {
	dataSize := len(pcm)
	buf := make([]byte, 44+dataSize)

	copy(buf[0:4], "RIFF")
	binary.LittleEndian.PutUint32(buf[4:8], uint32(36+dataSize))
	copy(buf[8:12], "WAVE")

	copy(buf[12:16], "fmt ")
	binary.LittleEndian.PutUint32(buf[16:20], 16)
	binary.LittleEndian.PutUint16(buf[20:22], 1) // PCM
	binary.LittleEndian.PutUint16(buf[22:24], uint16(numChannels))
	binary.LittleEndian.PutUint32(buf[24:28], uint32(sampleRate))
	byteRate := sampleRate * numChannels * bitsPerSample / 8
	binary.LittleEndian.PutUint32(buf[28:32], uint32(byteRate))
	blockAlign := numChannels * bitsPerSample / 8
	binary.LittleEndian.PutUint16(buf[32:34], uint16(blockAlign))
	binary.LittleEndian.PutUint16(buf[34:36], uint16(bitsPerSample))

	copy(buf[36:40], "data")
	binary.LittleEndian.PutUint32(buf[40:44], uint32(dataSize))
	copy(buf[44:], pcm)

	return buf
}
