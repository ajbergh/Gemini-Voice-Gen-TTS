/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WaveformCanvas — Canvas-based waveform renderer for Float32Array PCM samples.
 *
 * Renders a bar/column waveform. If `samples` is null (loading state) or the
 * canvas is too small, a styled placeholder is shown instead.
 */

import { useRef, useEffect, useCallback } from 'react';

// Google brand colors for the waveform bars (cycles through hues)
const GOOGLE_COLORS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335'];

export interface WaveformCanvasProps {
  /** Float32Array of normalized audio samples (-1..1). null = loading/unavailable. */
  samples: Float32Array | null;
  /** Canvas width in CSS pixels. Default: 100% of container (via ResizeObserver). */
  width?: number;
  /** Canvas height in CSS pixels. Default 56. */
  height?: number;
  /** Override bar color. When omitted, Google color cycling is used. */
  color?: string;
  /** Number of bars to render. Default: auto-derived from canvas width. */
  barCount?: number;
  /** CSS class applied to the container div. */
  className?: string;
  /** If true, renders a minimal single-color style (good for inline use). */
  compact?: boolean;
  /** Playback cursor position 0..1. When set, draws a thin vertical line. */
  playbackPosition?: number;
  /** Called when the user clicks the waveform. Receives the clicked position (0..1). */
  onSeek?: (position: number) => void;
}

/**
 * Down-sample Float32Array to `targetBars` peak values (max absolute amplitude
 * per bucket). This ensures the waveform renders at a fixed bar density
 * regardless of sample count.
 */
function downsamplePeaks(samples: Float32Array, targetBars: number): Float32Array {
  const bucketSize = Math.max(1, Math.floor(samples.length / targetBars));
  const peaks = new Float32Array(targetBars);
  for (let i = 0; i < targetBars; i++) {
    let max = 0;
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, samples.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(samples[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

/** Draw a waveform on a canvas element. */
function drawWaveform(
  canvas: HTMLCanvasElement,
  samples: Float32Array,
  color: string | undefined,
  compact: boolean,
  playbackPosition?: number,
): void {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx || width === 0 || height === 0) return;

  ctx.clearRect(0, 0, width, height);

  const barGap = compact ? 1 : 2;
  const barWidth = compact ? 2 : 3;
  const totalBarWidth = barWidth + barGap;
  const numBars = Math.max(1, Math.floor(width / totalBarWidth));

  const peaks = downsamplePeaks(samples, numBars);
  const centerY = height / 2;
  const maxBarHeight = height * 0.9;

  for (let i = 0; i < numBars; i++) {
    const barHeight = Math.max(2, peaks[i] * maxBarHeight);
    const x = i * totalBarWidth;
    const y = centerY - barHeight / 2;

    ctx.fillStyle = color ?? GOOGLE_COLORS[i % GOOGLE_COLORS.length];
    // Rounded rect via clip path if supported; fallback to fillRect
    const radius = Math.min(barWidth / 2, barHeight / 2, 2);
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, radius);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  // Draw playback cursor
  if (playbackPosition !== undefined && playbackPosition >= 0 && playbackPosition <= 1) {
    const cursorX = Math.round(playbackPosition * width);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(cursorX, 0, 2, height);
  }
}

/** Draw a placeholder (horizontal line + faint bars) when no samples are available. */
function drawPlaceholder(canvas: HTMLCanvasElement, isDark: boolean): void {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx || width === 0 || height === 0) return;

  ctx.clearRect(0, 0, width, height);

  const centerY = height / 2;
  const color = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  ctx.fillStyle = color;

  // Draw a row of flat placeholder bars
  const barWidth = 3;
  const barGap = 2;
  const totalBarWidth = barWidth + barGap;
  const numBars = Math.floor(width / totalBarWidth);
  for (let i = 0; i < numBars; i++) {
    const x = i * totalBarWidth;
    ctx.fillRect(x, centerY - 1, barWidth, 2);
  }
}

/** Render an auto-resizing waveform canvas with optional playback seeking. */
export default function WaveformCanvas({
  samples,
  height = 56,
  color,
  barCount: _barCount,
  className = '',
  compact = false,
  playbackPosition,
  onSeek,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef<number>(0);

  const isDark = typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (samples && samples.length > 0) {
      drawWaveform(canvas, samples, color, compact, playbackPosition);
    } else {
      drawPlaceholder(canvas, isDark);
    }
  }, [samples, color, compact, isDark, playbackPosition]);

  // Observe container width and update canvas size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const newWidth = Math.round(entry.contentRect.width);
      if (newWidth === widthRef.current) return;
      widthRef.current = newWidth;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Scale for device pixel ratio to prevent blur
      const dpr = window.devicePixelRatio || 1;
      canvas.width = newWidth * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      redraw();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [height, redraw]);

  // Redraw when samples change
  useEffect(() => {
    redraw();
  }, [redraw]);

  return (
    <div ref={containerRef} className={`w-full overflow-hidden ${className}`} style={{ height }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: onSeek ? 'pointer' : 'default' }}
        aria-label={samples ? 'Audio waveform' : 'No audio available'}
        aria-hidden={!samples}
        onClick={onSeek ? (e) => {
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const pos = (e.clientX - rect.left) / rect.width;
          onSeek(Math.max(0, Math.min(1, pos)));
        } : undefined}
      />
    </div>
  );
}
