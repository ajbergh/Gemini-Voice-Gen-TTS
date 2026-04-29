// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package audio

import (
	"encoding/binary"
	"math"
	"testing"
)

func TestAnalyzePCM16LE(t *testing.T) {
	pcm := make([]byte, 4*2)
	samples := []int16{0, 8192, -16384, 32767}
	for i, sample := range samples {
		binary.LittleEndian.PutUint16(pcm[i*2:i*2+2], uint16(sample))
	}

	got := AnalyzePCM16LE(pcm, 24000, 1)
	if got.SampleRate != 24000 || got.Channels != 1 || got.Format != PCM16LEFormat {
		t.Fatalf("unexpected format metadata: %#v", got)
	}
	if got.DurationSeconds != float64(len(samples))/24000.0 {
		t.Fatalf("duration = %f", got.DurationSeconds)
	}
	if !got.ClippingDetected {
		t.Fatal("expected clipping to be detected")
	}
	if math.Abs(got.PeakDbfs-(-0.0002650763603796191)) > 0.000001 {
		t.Fatalf("peak dBFS = %f", got.PeakDbfs)
	}
	if got.RmsDbfs >= 0 || math.IsInf(got.RmsDbfs, 0) {
		t.Fatalf("rms dBFS = %f", got.RmsDbfs)
	}
}

func TestAnalyzePCM16LESilence(t *testing.T) {
	got := AnalyzePCM16LE(make([]byte, 8), 0, 0)
	if got.SampleRate != DefaultSampleRate || got.Channels != DefaultChannels {
		t.Fatalf("defaults not applied: %#v", got)
	}
	if !math.IsInf(got.PeakDbfs, -1) {
		t.Fatalf("expected silent peak to be -Inf, got %f", got.PeakDbfs)
	}
	if !math.IsInf(got.RmsDbfs, -1) {
		t.Fatalf("expected silent rms to be -Inf, got %f", got.RmsDbfs)
	}
}
