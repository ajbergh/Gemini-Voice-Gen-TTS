// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package promptbuilder composes the final TTS system instruction from
// layered inputs: cast profile persona, voice preset character, performance
// style delivery notes, accent guidance, and segment-level notes.
//
// Merge order (outer → inner, earlier layers set the persona context):
//
//  1. Cast profile role/description  — who is speaking
//  2. Preset system instruction      — detailed voice character
//  3. Performance style notes        — how they perform right now
//  4. Accent instruction             — phonetic guidance
//  5. Segment notes                  — one-off director's note for this line
//
// Audio tags are preserved in the transcript; they are not included in
// the composed system instruction.
package promptbuilder

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

// Input holds all context available for composing a TTS system instruction.
// All fields are optional; empty strings are silently skipped.
type Input struct {
	// CastRole is the character's role (e.g. "narrator", "protagonist").
	CastRole string
	// CastDescription is the cast profile's character description.
	CastDescription string
	// CastPronunciationNotes are per-character pronunciation hints.
	CastPronunciationNotes string

	// PresetInstruction is the custom preset's system_instruction.
	PresetInstruction string

	// StyleName is the human-readable name of the performance style.
	StyleName string
	// StyleDirectorNotes are the style's delivery notes.
	StyleDirectorNotes string
	// StylePacing, StyleEnergy, StyleEmotion, StyleArticulation, StylePauseDensity
	// are the style's descriptor fields, included as concise hints.
	StylePacing       string
	StyleEnergy       string
	StyleEmotion      string
	StyleArticulation string
	StylePauseDensity string

	// AccentInstruction is a free-form accent / dialect note.
	AccentInstruction string

	// SegmentNotes are the per-segment director's override note.
	SegmentNotes string
}

// Compose returns the system instruction string for the TTS call and a
// hex-encoded SHA-256 hash of the input (for de-duplication / change detection).
// The hash is over all non-empty fields so identical inputs yield identical hashes.
func Compose(in Input) (instruction string, hash string) {
	var b strings.Builder

	// Section 1: Persona — who is speaking.
	if in.CastDescription != "" || in.CastRole != "" {
		b.WriteString("## Character\n")
		if in.CastRole != "" {
			b.WriteString("Role: ")
			b.WriteString(in.CastRole)
			b.WriteString("\n")
		}
		if in.CastDescription != "" {
			b.WriteString(in.CastDescription)
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	// Section 2: Voice character (preset).
	if in.PresetInstruction != "" {
		b.WriteString("## Voice Character\n")
		b.WriteString(strings.TrimSpace(in.PresetInstruction))
		b.WriteString("\n\n")
	}

	// Section 3: Performance style delivery.
	if in.StyleDirectorNotes != "" || in.StyleName != "" {
		b.WriteString("## Performance Style")
		if in.StyleName != "" {
			b.WriteString(" — ")
			b.WriteString(in.StyleName)
		}
		b.WriteString("\n")

		// Compact descriptor line when at least one field is set.
		var descriptors []string
		if in.StylePacing != "" {
			descriptors = append(descriptors, "Pacing: "+in.StylePacing)
		}
		if in.StyleEnergy != "" {
			descriptors = append(descriptors, "Energy: "+in.StyleEnergy)
		}
		if in.StyleEmotion != "" {
			descriptors = append(descriptors, "Emotion: "+in.StyleEmotion)
		}
		if in.StyleArticulation != "" {
			descriptors = append(descriptors, "Articulation: "+in.StyleArticulation)
		}
		if in.StylePauseDensity != "" {
			descriptors = append(descriptors, "Pauses: "+in.StylePauseDensity)
		}
		if len(descriptors) > 0 {
			b.WriteString(strings.Join(descriptors, " · "))
			b.WriteString("\n")
		}

		if in.StyleDirectorNotes != "" {
			b.WriteString(strings.TrimSpace(in.StyleDirectorNotes))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	// Section 4: Accent / phonetic guidance.
	if in.AccentInstruction != "" {
		b.WriteString("## Accent\n")
		b.WriteString(strings.TrimSpace(in.AccentInstruction))
		b.WriteString("\n\n")
	}

	// Section 5: Pronunciation notes (from cast profile).
	if in.CastPronunciationNotes != "" {
		b.WriteString("## Pronunciation Notes\n")
		b.WriteString(strings.TrimSpace(in.CastPronunciationNotes))
		b.WriteString("\n\n")
	}

	// Section 6: Per-segment director's note.
	if in.SegmentNotes != "" {
		b.WriteString("## Director's Note (this segment)\n")
		b.WriteString(strings.TrimSpace(in.SegmentNotes))
		b.WriteString("\n\n")
	}

	instruction = strings.TrimSpace(b.String())

	// Hash over all input fields for change detection.
	h := sha256.New()
	fmt.Fprintf(h, "%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
		in.CastRole, in.CastDescription, in.CastPronunciationNotes,
		in.PresetInstruction,
		in.StyleName, in.StyleDirectorNotes,
		in.StylePacing, in.StyleEnergy, in.StyleEmotion,
		in.StyleArticulation, in.StylePauseDensity,
		in.AccentInstruction+"|"+in.SegmentNotes,
	)
	hash = fmt.Sprintf("%x", h.Sum(nil))

	return instruction, hash
}
