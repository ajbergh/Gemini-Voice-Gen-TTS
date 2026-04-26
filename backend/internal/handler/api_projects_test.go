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
