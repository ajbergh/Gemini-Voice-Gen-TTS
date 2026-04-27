/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * BottomSheet.tsx — Responsive Modal / Bottom Sheet
 *
 * On mobile (< 640px), renders as a swipeable bottom sheet that slides up from
 * the bottom. On desktop, renders children as a standard centered modal.
 * Supports drag-to-dismiss with velocity detection, backdrop tap to close,
 * and Escape key handling.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface BottomSheetProps {
  onClose: () => void;
  children: React.ReactNode;
  /** z-index class, e.g. "z-[100]". Default: "z-[100]" */
  zIndex?: string;
  /** Title for aria-labelledby. */
  ariaLabel?: string;
}

const SWIPE_DISMISS_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

/** Render a mobile-friendly modal sheet with backdrop and escape handling. */
const BottomSheet: React.FC<BottomSheetProps> = ({ onClose, children, zIndex = 'z-[100]', ariaLabel }) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const dragStartTime = useRef(0);
  const isDragging = useRef(false);
  const [translateY, setTranslateY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const animateClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') animateClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [animateClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Only allow drag from the handle area or non-scrollable areas
    if (target.closest('[data-bottom-sheet-handle]') || target === sheetRef.current) {
      isDragging.current = true;
      dragStartY.current = e.touches[0].clientY;
      dragCurrentY.current = e.touches[0].clientY;
      dragStartTime.current = Date.now();
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    dragCurrentY.current = e.touches[0].clientY;
    const delta = Math.max(0, dragCurrentY.current - dragStartY.current);
    setTranslateY(delta);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = dragCurrentY.current - dragStartY.current;
    const elapsed = (Date.now() - dragStartTime.current) / 1000;
    const velocity = delta / (elapsed || 1);

    if (delta > SWIPE_DISMISS_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      animateClose();
    } else {
      setTranslateY(0);
    }
  }, [animateClose]);

  if (!isMobile) {
    // Desktop: render as standard centered modal
    return (
      <div
        className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div
          className={`absolute inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity duration-250 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={animateClose}
        />
        <div className={`relative transition-all duration-250 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          {children}
        </div>
      </div>
    );
  }

  // Mobile: render as bottom sheet
  return (
    <div
      className={`fixed inset-0 ${zIndex}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-zinc-900/60 transition-opacity duration-250 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={animateClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden transition-transform duration-250 ease-out ${
          isVisible && translateY === 0 ? 'translate-y-0' : ''
        } ${!isVisible ? 'translate-y-full' : ''}`}
        style={isVisible && translateY > 0 ? { transform: `translateY(${translateY}px)` } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div data-bottom-sheet-handle className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
