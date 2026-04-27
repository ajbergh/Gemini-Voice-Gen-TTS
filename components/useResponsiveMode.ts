/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * useResponsiveMode.ts - Viewport breakpoint hook for dense workspace layouts.
 *
 * Normalizes window width into desktop, tablet, or phone modes so components can
 * switch layout behavior without duplicating breakpoint logic.
 */

import { useEffect, useState } from 'react';

/** Responsive mode buckets used by adaptive components. */
export type ResponsiveMode = 'desktop' | 'tablet' | 'phone';

/** Convert a CSS pixel width into the app's responsive mode bucket. */
function getMode(width: number): ResponsiveMode {
  if (width < 640) return 'phone';
  if (width < 1280) return 'tablet';
  return 'desktop';
}

/** Track the current responsive mode and update it on window resize. */
export function useResponsiveMode(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getMode(window.innerWidth);
  });

  useEffect(() => {
    const update = () => setMode(getMode(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return mode;
}
