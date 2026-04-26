// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package promptbuilder

import (
	"strings"
	"testing"
)

func TestComposeEmpty(t *testing.T) {
	instr, hash := Compose(Input{})
	if instr != "" {
		t.Errorf("expected empty instruction for empty input, got %q", instr)
	}
	if hash == "" {
		t.Error("expected non-empty hash even for empty input")
	}
}

func TestComposeSectionOrder(t *testing.T) {
	in := Input{
		CastRole:           "narrator",
		CastDescription:    "A wise elder guiding the listener.",
		PresetInstruction:  "Gravelly, warm baritone. Measured pace.",
		StyleName:          "Suspense",
		StyleDirectorNotes: "Slow down on key phrases. Let silences breathe.",
		StylePacing:        "slow",
		StyleEnergy:        "moderate",
		AccentInstruction:  "Received Pronunciation (RP) British.",
		SegmentNotes:       "Pause before the final sentence.",
	}

	instr, hash := Compose(in)

	// Check section headings appear in order.
	sections := []string{
		"## Character",
		"## Voice Character",
		"## Performance Style",
		"## Accent",
		"## Director's Note",
	}
	prev := -1
	for _, sec := range sections {
		idx := strings.Index(instr, sec)
		if idx < 0 {
			t.Errorf("section %q not found in output:\n%s", sec, instr)
			continue
		}
		if idx <= prev {
			t.Errorf("section %q appears before previous section", sec)
		}
		prev = idx
	}

	// Cast description should precede preset instruction.
	castIdx := strings.Index(instr, "wise elder")
	presetIdx := strings.Index(instr, "Gravelly")
	if castIdx < 0 || presetIdx < 0 || castIdx > presetIdx {
		t.Errorf("cast description should appear before preset instruction")
	}

	// Style name must appear in the Performance Style heading.
	if !strings.Contains(instr, "Suspense") {
		t.Error("style name not found in output")
	}
	// Style descriptors should be present.
	if !strings.Contains(instr, "Pacing: slow") {
		t.Error("pacing descriptor not found")
	}

	// Hash is deterministic.
	_, hash2 := Compose(in)
	if hash != hash2 {
		t.Error("hash is not deterministic")
	}
}

func TestComposeTranscriptNotModified(t *testing.T) {
	// Compose should never include the literal transcript text — only the
	// system instruction. This test ensures no transcript field exists.
	in := Input{
		PresetInstruction:  "Warm tone.",
		StyleDirectorNotes: "Steady pace.",
	}
	instr, _ := Compose(in)

	// The instruction must not contain a "Transcript:" section.
	if strings.Contains(strings.ToLower(instr), "transcript:") {
		t.Error("instruction must not include a transcript section")
	}
}

func TestComposeDifferentInputsDifferentHashes(t *testing.T) {
	in1 := Input{StyleName: "Calm Narration", StyleDirectorNotes: "Steady."}
	in2 := Input{StyleName: "Suspense", StyleDirectorNotes: "Tense."}

	_, h1 := Compose(in1)
	_, h2 := Compose(in2)

	if h1 == h2 {
		t.Error("different inputs produced the same hash")
	}
}

func TestComposeOnlySegmentNotes(t *testing.T) {
	in := Input{SegmentNotes: "Speak very softly here."}
	instr, _ := Compose(in)
	if !strings.Contains(instr, "Director's Note") {
		t.Error("segment notes section missing")
	}
	if !strings.Contains(instr, "Speak very softly here.") {
		t.Error("segment note text missing from output")
	}
}
