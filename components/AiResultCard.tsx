/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AiRecommendation, Voice } from '../types';
import { Sparkles, Copy, Check, Quote, X } from 'lucide-react';
import AiTtsPreview from './AiTtsPreview';
import ReactMarkdown from 'react-markdown';

interface AiResultCardProps {
  result: AiRecommendation;
  voices: Voice[];
  onClose: () => void;
}

const AiResultCard: React.FC<AiResultCardProps> = ({ result, voices, onClose }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus trap implementation
  useEffect(() => {
    cardRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      if (!cardRef.current) return;

      const focusableElements = cardRef.current.querySelectorAll(
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

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Ensure markdown is properly formatted even if the model returns compact text
  const formattedInstruction = useMemo(() => {
    if (!result.systemInstruction) return '';
    let text = result.systemInstruction;
    text = text.replace(/([^\n])\s*(##)/g, '$1\n\n$2');
    return text;
  }, [result.systemInstruction]);

  return (
    <div 
        ref={cardRef}
        tabIndex={-1}
        className="w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/60 dark:border-zinc-800 shadow-2xl overflow-hidden relative group outline-none h-full flex flex-col"
    >
        
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-3 right-3 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-50"
            aria-label="Close dialog"
        >
            <X size={18} />
        </button>

        {/* Subtle Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/40 via-blue-50/40 to-white/0 dark:from-indigo-900/20 dark:via-blue-900/20 dark:to-transparent -z-10"></div>
        
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 overflow-y-auto max-h-[85vh] md:max-h-[600px] md:h-auto">
            
            {/* Left: Persona Info */}
            <div className="flex-1 space-y-4 min-w-0 flex flex-col">
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                         <Sparkles size={18} />
                    </div>
                    <div>
                        <h2 id="ai-result-title" className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">AI Suggested Persona</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Based on your description</p>
                    </div>
                </div>

                <div className="bg-white/60 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm relative group/code flex-1 flex flex-col min-h-[300px] md:min-h-0 overflow-hidden">
                    <div className="flex justify-between items-center p-4 pb-2 border-b border-zinc-100/50 dark:border-zinc-700/50 flex-shrink-0">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            System Prompt
                        </span>
                        <button 
                            onClick={() => handleCopy(result.systemInstruction, 'sys')} 
                            className="p-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600 transition-all opacity-0 group-hover/code:opacity-100 focus:opacity-100"
                            title="Copy System Prompt"
                        >
                            {copiedSection === 'sys' ? <Check size={14} className="text-green-600 dark:text-green-400"/> : <Copy size={14} />}
                        </button>
                    </div>
                    
                    {/* Markdown Scroll Container */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-zinc-50/30 dark:bg-zinc-900/30">
                         <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-headings:text-zinc-800 dark:prose-headings:text-zinc-100 prose-headings:font-bold prose-headings:mb-2 prose-headings:mt-4 prose-p:text-zinc-600 dark:prose-p:text-zinc-300 prose-p:leading-relaxed prose-strong:text-zinc-900 dark:prose-strong:text-white text-sm">
                            <ReactMarkdown>{formattedInstruction}</ReactMarkdown>
                         </div>
                    </div>
                </div>
            </div>

            {/* Right: Audio Preview */}
            <div className="flex-1 flex flex-col justify-center space-y-5 pt-2">
                 <div className="relative pl-8">
                    <Quote size={24} className="absolute -top-1 left-0 text-indigo-200 dark:text-indigo-800" />
                    <p className="text-lg text-zinc-700 dark:text-zinc-200 italic font-serif leading-relaxed">
                        "{result.sampleText}"
                    </p>
                 </div>
                 
                 <div className="bg-white dark:bg-zinc-800 p-1 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <AiTtsPreview text={result.sampleText} voices={voices} />
                 </div>
            </div>
        </div>
    </div>
  );
};

export default AiResultCard;