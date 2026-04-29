/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SplitPane.tsx — Resizable Split Pane Layout
 *
 * A horizontal split layout with a draggable divider. Left and right panes
 * can be resized by dragging. Supports min/max width constraints.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Initial width of left pane as percentage (0-100). Default 40. */
  defaultLeftPercent?: number;
  /** Minimum left pane width in px. Default 250. */
  minLeft?: number;
  /** Minimum right pane width in px. Default 300. */
  minRight?: number;
  className?: string;
}

/** Render a resizable two-pane layout with persisted split width. */
const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  defaultLeftPercent = 40,
  minLeft = 250,
  minRight = 300,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const getClientX = (e: MouseEvent | TouchEvent): number => {
      if ('touches' in e) return e.touches[0]?.clientX ?? 0;
      return e.clientX;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = getClientX(e) - rect.left;
      const totalWidth = rect.width;

      // Enforce min widths
      const clampedX = Math.max(minLeft, Math.min(x, totalWidth - minRight));
      setLeftPercent((clampedX / totalWidth) * 100);
    };

    const handleEnd = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [minLeft, minRight]);

  return (
    <div ref={containerRef} className={`flex h-full ${className}`}>
      {/* Left pane */}
      <div className="overflow-auto" style={{ width: `${leftPercent}%` }}>
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        className="flex-shrink-0 w-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-indigo-400 dark:hover:bg-indigo-500 cursor-col-resize transition-colors relative group"
        role="separator"
        aria-orientation="vertical"
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-0.5 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          <div className="w-0.5 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          <div className="w-0.5 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
        </div>
      </div>

      {/* Right pane */}
      <div className="flex-1 overflow-auto min-w-0">
        {right}
      </div>
    </div>
  );
};

export default SplitPane;
