/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

export type ResponsiveMode = 'desktop' | 'tablet' | 'phone';

function getMode(width: number): ResponsiveMode {
  if (width < 640) return 'phone';
  if (width < 1280) return 'tablet';
  return 'desktop';
}

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
