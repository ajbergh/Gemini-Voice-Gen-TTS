import React, { useState, useEffect, useRef } from 'react';
import { Voice } from '../types';
import { X, FileText } from 'lucide-react';
import AiTtsPreview from './AiTtsPreview';

interface ScriptReaderModalProps {
  voices: Voice[];
  initialVoiceName?: string;
  onClose: () => void;
}

const ScriptReaderModal: React.FC<ScriptReaderModalProps> = ({ voices, initialVoiceName, onClose }) => {
  const [script, setScript] = useState('Hello! I am ready to read your script. Type something here and click Listen.');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Re-order voices so the initialVoiceName is first, because AiTtsPreview defaults to voices[0]
  const sortedVoices = [...voices].sort((a, b) => {
    if (a.name === initialVoiceName) return -1;
    if (b.name === initialVoiceName) return 1;
    return 0;
  });

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-reader-title"
    >
      <div className="absolute inset-0" onClick={onClose}></div>
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col outline-none animate-slide-up"
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <FileText size={18} />
            </div>
            <h2 id="script-reader-title" className="text-lg font-bold">Test Script</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="script-input" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Enter your script
            </label>
            <textarea
              id="script-input"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full h-32 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              placeholder="Type the script you want the voice to read..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Preview
            </label>
            <div className="bg-white dark:bg-zinc-800 p-1 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700">
              <AiTtsPreview text={script} voices={sortedVoices} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptReaderModal;
