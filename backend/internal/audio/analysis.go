// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package audio contains small PCM helpers used by render and export paths.
package audio

import (
	"encoding/binary"
	"math"
)

const (
	DefaultSampleRate = 24000
	DefaultChannels   = 1
	PCM16LEFormat     = "pcm_s16le"
)

// Analysis describes basic 16-bit PCM audio metrics.
type Analysis struct {
	DurationSeconds  float64
	PeakDbfs         float64
	RmsDbfs          float64
	ClippingDetected bool
	SampleRate       int
	Channels         int
	Format           string
}

// AnalyzePCM16LE calculates duration, peak, RMS, and clipping for signed
// little-endian 16-bit PCM audio.
func AnalyzePCM16LE(pcm []byte, sampleRate, channels int) Analysis {
	if sampleRate <= 0 {
		sampleRate = DefaultSampleRate
	}
	if channels <= 0 {
		channels = DefaultChannels
	}

	a := Analysis{
		DurationSeconds: float64(len(pcm)) / float64(sampleRate*channels*2),
		PeakDbfs:        math.Inf(-1),
		RmsDbfs:         math.Inf(-1),
		SampleRate:      sampleRate,
		Channels:        channels,
		Format:          PCM16LEFormat,
	}

	var peak int16
	var peakAbs int
	var sumSquares float64
	var sampleCount int

	for i := 0; i+1 < len(pcm); i += 2 {
		sample := int16(binary.LittleEndian.Uint16(pcm[i : i+2]))
		abs := int(sample)
		if abs < 0 {
			abs = -abs
		}
		if abs > peakAbs {
			peakAbs = abs
			peak = sample
		}
		if sample == 32767 || sample == -32768 {
			a.ClippingDetected = true
		}
		normalized := float64(sample) / 32768.0
		sumSquares += normalized * normalized
		sampleCount++
	}

	if peakAbs > 0 {
		a.PeakDbfs = 20 * math.Log10(math.Abs(float64(peak))/32768.0)
	}
	if sampleCount > 0 && sumSquares > 0 {
		rms := math.Sqrt(sumSquares / float64(sampleCount))
		a.RmsDbfs = 20 * math.Log10(rms)
	}

	return a
}
