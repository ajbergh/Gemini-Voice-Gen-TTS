// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"reflect"
	"testing"
)

func TestSplitParagraphs(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  []string
	}{
		{
			name:  "empty input",
			input: "",
			want:  nil,
		},
		{
			name:  "single paragraph",
			input: "Hello, world.",
			want:  []string{"Hello, world."},
		},
		{
			name:  "two paragraphs separated by blank line",
			input: "First paragraph.\n\nSecond paragraph.",
			want:  []string{"First paragraph.", "Second paragraph."},
		},
		{
			name:  "heading followed by body",
			input: "# Chapter One\n\nThe story begins here.",
			want:  []string{"# Chapter One", "The story begins here."},
		},
		{
			name:  "multi-line paragraph treated as one",
			input: "Line one\nLine two\nLine three",
			want:  []string{"Line one\nLine two\nLine three"},
		},
		{
			name:  "multiple blank lines collapse to single separator",
			input: "Para one.\n\n\n\nPara two.",
			want:  []string{"Para one.", "Para two."},
		},
		{
			name:  "leading and trailing whitespace ignored",
			input: "\n\nHello.\n\n",
			want:  []string{"Hello."},
		},
		{
			name:  "full markdown document",
			input: "# Chapter One\n\nThe story begins.\n\n# Chapter Two\n\nThe adventure continues.\n\nA second paragraph in chapter two.",
			want: []string{
				"# Chapter One",
				"The story begins.",
				"# Chapter Two",
				"The adventure continues.",
				"A second paragraph in chapter two.",
			},
		},
		{
			name:  "windows line endings normalised",
			input: "Para one.\r\n\r\nPara two.",
			want:  []string{"Para one.", "Para two."},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := splitParagraphs(tc.input)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("splitParagraphs(%q)\n got  %v\n want %v", tc.input, got, tc.want)
			}
		})
	}
}

func TestParseProjectImport(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  importPreviewResponse
	}{
		{
			name:  "markdown headings",
			input: "# Chapter One\n\nThe story begins.\n\n# Chapter Two\n\nThe adventure continues.",
			want: importPreviewResponse{
				Sections: []importPreviewSection{
					{
						Title: "Chapter One",
						Kind:  "chapter",
						Segments: []importPreviewSegment{
							{ScriptText: "The story begins."},
						},
					},
					{
						Title: "Chapter Two",
						Kind:  "chapter",
						Segments: []importPreviewSegment{
							{ScriptText: "The adventure continues."},
						},
					},
				},
				UnsectionedSegments: []importPreviewSegment{},
				SectionCount:        2,
				SegmentCount:        2,
			},
		},
		{
			name:  "plain text without headings",
			input: "First paragraph.\n\nSecond paragraph.",
			want: importPreviewResponse{
				Sections: []importPreviewSection{},
				UnsectionedSegments: []importPreviewSegment{
					{ScriptText: "First paragraph."},
					{ScriptText: "Second paragraph."},
				},
				SectionCount: 0,
				SegmentCount: 2,
			},
		},
		{
			name:  "empty input",
			input: "",
			want: importPreviewResponse{
				Sections:            []importPreviewSection{},
				UnsectionedSegments: []importPreviewSegment{},
				SectionCount:        0,
				SegmentCount:        0,
			},
		},
		{
			name:  "multiple blank lines",
			input: "# Chapter\n\n\n\nLine one.\n\n\nLine two.",
			want: importPreviewResponse{
				Sections: []importPreviewSection{
					{
						Title: "Chapter",
						Kind:  "chapter",
						Segments: []importPreviewSegment{
							{ScriptText: "Line one."},
							{ScriptText: "Line two."},
						},
					},
				},
				UnsectionedSegments: []importPreviewSegment{},
				SectionCount:        1,
				SegmentCount:        2,
			},
		},
		{
			name:  "empty heading fallback",
			input: "###\n\nBody.",
			want: importPreviewResponse{
				Sections: []importPreviewSection{
					{
						Title: "Untitled Section",
						Kind:  "chapter",
						Segments: []importPreviewSegment{
							{ScriptText: "Body."},
						},
					},
				},
				UnsectionedSegments: []importPreviewSegment{},
				SectionCount:        1,
				SegmentCount:        1,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parseProjectImport(tc.input)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("parseProjectImport(%q)\n got  %#v\n want %#v", tc.input, got, tc.want)
			}
		})
	}
}
