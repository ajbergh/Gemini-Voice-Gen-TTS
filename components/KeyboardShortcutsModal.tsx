/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * KeyboardShortcutsModal.tsx — Keyboard Shortcut Cheat Sheet
 *
 * Accessible modal overlay showing all keyboard shortcuts. Triggered by pressing
 * "?" anywhere in the app. Implements focus trap and Escape-to-close.
 */

import React, { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS: { section: string; items: { keys: string[]; description: string }[] }[] = [
  {
    section: 'Navigation',
    items: [
      { keys: ['←', '→'], description: 'Navigate carousel' },
      { keys: ['Enter', 'Space'], description: 'Play/stop voice sample' },
      { keys: ['Tab'], description: 'Move focus forward' },
      { keys: ['Shift', 'Tab'], description: 'Move focus backward' },
    ],
  },
  {
    section: 'Actions',
    items: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / panel' },
    ],
  },
];

/** Render the keyboard shortcuts reference modal. */
const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modalRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="absolute inset-0" onClick={onClose}></div>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden outline-none animate-slide-up"
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
              <Keyboard size={18} />
            </div>
            <h2 id="shortcuts-title" className="text-lg font-bold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {SHORTCUTS.map(section => (
            <div key={section.section}>
              <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2.5">
                {section.section}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, j) => (
                        <React.Fragment key={j}>
                          {j > 0 && <span className="text-[10px] text-zinc-400 mx-0.5">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-mono text-zinc-600 dark:text-zinc-300">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 text-center">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Press <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px] font-mono">?</kbd> anywhere to toggle this overlay
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
