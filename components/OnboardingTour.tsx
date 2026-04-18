/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OnboardingTour.tsx — First-Time Guided Walkthrough
 *
 * Step-by-step tooltip tour highlighting key features for first-time users.
 * Tracks completion via localStorage. Each step highlights a UI area with
 * a spotlight effect and descriptive tooltip.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Mic, FileText, Settings, Command } from 'lucide-react';

const STORAGE_KEY = 'gemini-voice-onboarding-complete';

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Position of the tooltip on screen */
  position: 'center' | 'top-left' | 'top-right' | 'bottom-center';
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to Gemini Voice Library',
    description: 'Browse 30 unique AI voices, test them with custom scripts, and find the perfect voice for your project. Let\'s take a quick tour!',
    icon: <Sparkles size={24} />,
    position: 'center',
  },
  {
    title: 'Voice Browser',
    description: 'Explore voices in a 3D carousel or grid view. Click any voice card to hear a sample, or use the search and filters to narrow down.',
    icon: <Mic size={24} />,
    position: 'center',
  },
  {
    title: 'AI Casting Director',
    description: 'Describe your project and let AI recommend the best voices. Access it from the sidebar or with the sparkle button.',
    icon: <Sparkles size={24} />,
    position: 'center',
  },
  {
    title: 'Script Reader',
    description: 'Test voices with your own scripts. Supports single speaker, multi-speaker dialogue, and A/B voice comparison.',
    icon: <FileText size={24} />,
    position: 'center',
  },
  {
    title: 'Command Palette',
    description: 'Press Ctrl+K (or ⌘K on Mac) to quickly search voices, navigate sections, and trigger actions without leaving the keyboard.',
    icon: <Command size={24} />,
    position: 'center',
  },
  {
    title: 'API Key Setup',
    description: 'To generate speech, add your Gemini API key in Settings. Your key is encrypted and stored locally — never sent to third parties.',
    icon: <Settings size={24} />,
    position: 'center',
  },
];

interface OnboardingTourProps {
  /** Force show the tour even if completed before */
  forceShow?: boolean;
  onComplete?: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ forceShow, onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
      return;
    }
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrev = useCallback(() => {
    setCurrentStep(s => Math.max(0, s - 1));
  }, []);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Escape key to skip
  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isVisible, handleSkip, handleNext, handlePrev]);

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Onboarding tour">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm animate-fade-in" />

      {/* Tooltip card */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slide-up">
        {/* Progress bar */}
        <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Skip tour"
        >
          <X size={16} />
        </button>

        <div className="p-8 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-5">
            {step.icon}
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8">
            {step.description}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStep
                    ? 'w-6 bg-indigo-500'
                    : idx < currentStep
                    ? 'w-1.5 bg-indigo-300 dark:bg-indigo-700'
                    : 'w-1.5 bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isFirst
                  ? 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Skip tour
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm"
            >
              {isLast ? 'Get Started' : 'Next'}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
