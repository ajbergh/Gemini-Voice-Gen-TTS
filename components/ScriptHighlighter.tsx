/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ScriptHighlighter.tsx — Audio Tag Syntax Highlighting Overlay
 *
 * Renders a transparent overlay that sits behind a textarea to color-code
 * TTS audio tags like [whispers], [excited], [pause: 2s], ## Section Headers,
 * and Speaker: prefixes. The textarea text remains invisible (transparent color)
 * while the overlay shows the styled version underneath. Accepts a scrollTop
 * prop to keep the highlighted text in sync with the textarea scroll position.
 */

import React from 'react';

interface ScriptHighlighterProps {
  text: string;
  scrollTop?: number;
}

/** Escape HTML entities for safe innerHTML rendering. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Apply syntax highlighting to TTS script text. */
function highlightScript(text: string): string {
  const escaped = escapeHtml(text);
  
  return escaped
    // ## Section headers (Audio Profile, Scene, Transcript, Director's Notes)
    .replace(
      /^(##\s+.*)$/gm,
      '<span class="text-indigo-500 dark:text-indigo-400 font-semibold">$1</span>'
    )
    // Audio tags: [whispers], [excited], [softly], [pause: 2s], [chuckles darkly], etc.
    .replace(
      /(\[(?:whispers?|softly|excited|sad|angry|happy|surprised|fearful|disgusted|pause(?::\s*\d+s?)?|chuckles?[^[\]]*|laughs?[^[\]]*|sighs?[^[\]]*|gasps?[^[\]]*|clears?\s*throat|in\s+a\s+[^[\]]*)\])/gi,
      '<span class="text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 rounded px-0.5">$1</span>'
    )
    // Speaker prefixes: "Speaker1:", "Narrator:", etc.
    .replace(
      /^(\w+)(:)/gm,
      '<span class="text-cyan-600 dark:text-cyan-400 font-semibold">$1</span><span class="text-zinc-400">$2</span>'
    );
}

const ScriptHighlighter: React.FC<ScriptHighlighterProps> = ({ text, scrollTop = 0 }) => {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl"
      aria-hidden="true"
    >
      <div
        className="p-3 text-sm leading-normal whitespace-pre-wrap break-words text-zinc-900 dark:text-white"
        style={{ transform: `translateY(-${scrollTop}px)` }}
        dangerouslySetInnerHTML={{ __html: highlightScript(text) + '\n' }}
      />
    </div>
  );
};

export default ScriptHighlighter;
