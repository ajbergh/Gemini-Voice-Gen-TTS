/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * audio/analysis.ts — Client-side audio analysis utilities.
 *
 * Operates on Float32Array sample data (normalized range -1.0 to +1.0).
 * These metrics match the backend schema fields: peak_dbfs, rms_dbfs,
 * clipping_detected.
 */

import { PCM_SAMPLE_RATE } from './pcm.ts';

/** Full analysis result for a single audio buffer. */
export interface AudioAnalysis {
  /** Peak level in dBFS (0 dBFS = full scale). Negative values. */
  peakDbfs: number;
  /** RMS level in dBFS. */
  rmsDbfs: number;
  /** True if any sample exceeds the clipping threshold. */
  clippingDetected: boolean;
  /** Duration in seconds derived from sample count and sample rate. */
  durationSeconds: number;
}

/** Clipping threshold as a linear amplitude (≈ -0.09 dBFS). */
const CLIPPING_THRESHOLD = 0.9999;

/** -Infinity dBFS sentinel for silence. */
const NEG_INF_DBFS = -Infinity;

/**
 * Convert a linear amplitude (0..1) to dBFS.
 * Returns -Infinity for zero amplitude.
 */
export function linearToDbfs(linear: number): number {
  if (linear <= 0) return NEG_INF_DBFS;
  return 20 * Math.log10(linear);
}

/**
 * Calculate the peak (maximum absolute amplitude) in dBFS.
 */
export function calcPeakDbfs(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  return linearToDbfs(peak);
}

/**
 * Calculate the RMS (root mean square) amplitude in dBFS.
 */
export function calcRmsDbfs(samples: Float32Array): number {
  if (samples.length === 0) return NEG_INF_DBFS;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / samples.length);
  return linearToDbfs(rms);
}

/**
 * Detect whether any sample exceeds the clipping threshold.
 */
export function detectClipping(
  samples: Float32Array,
  threshold = CLIPPING_THRESHOLD,
): boolean {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= threshold) return true;
  }
  return false;
}

/**
 * Run a full analysis pass over the samples, returning all metrics.
 */
export function analyzeAudio(
  samples: Float32Array,
  sampleRate = PCM_SAMPLE_RATE,
): AudioAnalysis {
  return {
    peakDbfs: calcPeakDbfs(samples),
    rmsDbfs: calcRmsDbfs(samples),
    clippingDetected: detectClipping(samples),
    durationSeconds: samples.length / sampleRate,
  };
}
