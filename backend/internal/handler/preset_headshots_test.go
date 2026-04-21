// Copyright 2026 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"strings"
	"testing"
)

func TestBuildHeadshotPrompt(t *testing.T) {
	prompt := buildHeadshotPrompt("Confident mid-30s narrator with polished wardrobe styling.   ")
	if !strings.HasPrefix(prompt, "1:1 size. Confident mid-30s narrator with polished wardrobe styling.") {
		t.Fatalf("expected prompt prefix with normalized description, got %q", prompt)
	}
	if !strings.Contains(prompt, headshotPromptModifier) {
		t.Fatalf("expected fixed headshot modifier in prompt, got %q", prompt)
	}
}

func TestMergePresetMetadataPreservesAndExtendsCastingDirector(t *testing.T) {
	raw := `{"headshot":{"status":"failed","error":"temporary"}}`
	metadata, err := mergePresetMetadata(&raw, "Warm luxury narrator", "Elegant British woman in her 30s with composed expression")
	if err != nil {
		t.Fatalf("mergePresetMetadata returned error: %v", err)
	}
	if metadata.Headshot == nil || metadata.Headshot.Status != "failed" {
		t.Fatalf("expected existing headshot metadata to be preserved, got %+v", metadata.Headshot)
	}
	if metadata.CastingDirector == nil {
		t.Fatal("expected casting director metadata to be added")
	}
	if metadata.CastingDirector.SourceQuery != "Warm luxury narrator" {
		t.Fatalf("expected source query to be stored, got %q", metadata.CastingDirector.SourceQuery)
	}
	if metadata.CastingDirector.PersonDescription != "Elegant British woman in her 30s with composed expression" {
		t.Fatalf("expected person description to be stored, got %q", metadata.CastingDirector.PersonDescription)
	}
}

func TestPortablePresetMetadataStripsHeadshotAndKeepsCastingDirector(t *testing.T) {
	raw := `{"castingDirector":{"sourceQuery":"Warm narrator","personDescription":"Composed woman with polished wardrobe"},"headshot":{"status":"ready","path":"preset_image_123.png","mimeType":"image/png"}}`
	portable := portablePresetMetadata(&raw)
	if portable == nil {
		t.Fatal("expected portable metadata to remain present")
	}

	metadata, err := parsePresetMetadata(portable)
	if err != nil {
		t.Fatalf("parsePresetMetadata returned error: %v", err)
	}
	if metadata.Headshot != nil {
		t.Fatalf("expected headshot metadata to be stripped, got %+v", metadata.Headshot)
	}
	if metadata.CastingDirector == nil || metadata.CastingDirector.SourceQuery != "Warm narrator" {
		t.Fatalf("expected casting director metadata to remain, got %+v", metadata.CastingDirector)
	}
}

func TestPortablePresetMetadataDropsHeadshotOnlyPayload(t *testing.T) {
	raw := `{"headshot":{"status":"ready","path":"preset_image_123.png","mimeType":"image/png"}}`
	portable := portablePresetMetadata(&raw)
	if portable != nil {
		t.Fatalf("expected headshot-only metadata to be removed, got %q", *portable)
	}
}
