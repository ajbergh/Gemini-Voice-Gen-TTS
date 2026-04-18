/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VoiceFinder.tsx — AI Casting Director Modal
 *
 * Modal dialog that lets users describe their ideal voice in natural language.
 * Sends the query plus the full voice catalogue to the Go backend, which
 * proxies it to Gemini (gemini-3-flash-preview) for structured JSON output.
 * Returns voice recommendations with a system instruction and sample text.
 * Implements focus trap and Escape-to-close for accessibility.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, X, ArrowRight, Wand2 } from 'lucide-react';
import { Voice, AiRecommendation } from '../types';
import { recommendVoices } from '../api';
import BottomSheet from './BottomSheet';

interface VoiceFinderProps {
  voices: Voice[];
  onRecommendation: (rec: AiRecommendation | null) => void;
  onClose: () => void;
}

const VoiceFinder: React.FC<VoiceFinderProps> = ({ voices, onRecommendation, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap implementation
  useEffect(() => {
    textAreaRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      if (!modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const examples = [
    { label: "Irish male", text: "A high pitch male with a strong Irish accent." },
    { label: "Singaporean female", text: "An energetic Singaporean female with a strong Singlish accent." }
  ];

  /**
   * Send the user's voice description to the backend for AI-powered matching.
   * Includes simplified voice data so Gemini can select from the catalogue.
   */
  const handleAnalyze = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);

    try {
      const simplifiedVoices = voices.map(v => ({
        name: v.name,
        gender: v.analysis.gender,
        pitch: v.analysis.pitch,
        characteristics: v.analysis.characteristics,
      }));

      const result = await recommendVoices(query, simplifiedVoices);
      
      if (result.voiceNames && result.voiceNames.length > 0) {
        onRecommendation({ ...result, sourceQuery: query });
      } else {
        setError("No matching voices found.");
      }

    } catch (err) {
      console.error("AI Error:", err);
      setError("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} ariaLabel="AI Casting Director">
      {/* Modal Content */}
      <div ref={modalRef} className="relative w-full max-w-2xl mx-auto bg-white dark:bg-zinc-900 sm:rounded-3xl shadow-2xl overflow-hidden sm:animate-slide-up ring-1 ring-zinc-900/5">
        
        {/* Decorative Header Background */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-50/50 to-white/0 dark:from-indigo-900/30 dark:to-zinc-900/0 pointer-events-none"></div>

        <div className="relative p-6 sm:p-8">
          <div className="flex justify-between items-start mb-6">
             <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                    <Wand2 size={18} />
                    <span className="text-xs font-bold tracking-wider uppercase">AI Casting Director</span>
                </div>
                <h2 id="casting-title" className="text-3xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">Describe your character.</h2>
                <p className="text-base text-zinc-500 dark:text-zinc-400 font-light">Gemini will analyze the library and find the perfect match.</p>
             </div>
             <button 
               onClick={onClose}
               className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
               aria-label="Close"
             >
               <X size={20} />
             </button>
          </div>

          <div className="relative group">
            <textarea
              ref={textAreaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. A friendly, energetic narrator for a children's book about space exploration..."
              className="w-full h-28 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-base font-sans text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-600 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-600 focus:bg-white dark:focus:bg-zinc-900 resize-none transition-all leading-relaxed"
              disabled={loading}
              autoFocus
            />

            {/* Examples */}
            <div className="flex flex-wrap items-center gap-2 mt-3 px-1">
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Try:</span>
                {examples.map((ex) => (
                    <button
                        key={ex.label}
                        onClick={() => {
                            setQuery(ex.text);
                            textAreaRef.current?.focus();
                        }}
                        className="px-3 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                    >
                        {ex.label}
                    </button>
                ))}
            </div>
            
            <div className="flex justify-between items-center mt-4">
              <span className="text-zinc-400 dark:text-zinc-500 text-sm font-medium flex items-center gap-2">
                  {error ? (
                    <span className="text-red-500 dark:text-red-400 flex items-center gap-1"><X size={14}/> {error}</span>
                  ) : (
                    <>Powered by <span className="text-indigo-500 dark:text-indigo-400">Gemini 3 Flash Preview</span></>
                  )}
              </span>
              
              <button
                onClick={handleAnalyze}
                disabled={loading || !query.trim()}
                className="flex items-center gap-2 pl-5 pr-5 py-2.5 bg-zinc-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-full transition-all duration-300 transform active:scale-95 shadow-lg hover:shadow-indigo-500/25 dark:shadow-indigo-900/25 text-sm"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                <span>Find Voices</span>
                {!loading && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        {loading && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full bg-indigo-600 dark:bg-indigo-500 animate-google-colors"></div>
            </div>
        )}

      </div>
    </BottomSheet>
  );
};

export default VoiceFinder;