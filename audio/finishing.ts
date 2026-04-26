/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * audio/finishing.ts — Non-destructive audio finishing operations.
 *
 * All functions take and return Float32Array (normalized -1..1 samples).
 * These are pure utilities; they do not mutate the input array.
 */

import { PCM_SAMPLE_RATE } from './pcm.ts';
import { linearToDbfs } from './analysis.ts';

/** Options for silence trimming. */
export interface TrimOptions {
  /** Silence gate in dBFS below which a sample is considered silent. Default -50 dBFS. */
  silenceThresholdDbfs?: number;
  /** Minimum number of samples that must be silent before trimming. Default 480 (20 ms at 24 kHz). */
  minSilenceSamples?: number;
}

/**
 * Trim leading and trailing silence from a sample buffer.
 *
 * Scans inward from each end, looking for the first non-silent sample.
 * If the entire buffer is silent, returns a zero-length Float32Array.
 */
export function trimSilence(
  samples: Float32Array,
  opts: TrimOptions = {},
): Float32Array {
  const {
    silenceThresholdDbfs = -50,
    minSilenceSamples = Math.round(PCM_SAMPLE_RATE * 0.02), // 20 ms
  } = opts;

  // Linear amplitude threshold
  const linThreshold = Math.pow(10, silenceThresholdDbfs / 20);

  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < linThreshold) {
    start++;
  }

  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < linThreshold) {
    end--;
  }

  // If less than minSilenceSamples were trimmed, don't trim that side
  const trimmedLeading = start;
  const trimmedTrailing = samples.length - 1 - end;
  const actualStart = trimmedLeading >= minSilenceSamples ? start : 0;
  const actualEnd = trimmedTrailing >= minSilenceSamples ? end : samples.length - 1;

  if (actualStart === 0 && actualEnd === samples.length - 1) return samples;
  return samples.slice(actualStart, actualEnd + 1);
}

/**
 * Normalize the peak amplitude to a target dBFS level.
 *
 * If the buffer is silent (peak is 0) it is returned unchanged.
 */
export function normalizePeak(
  samples: Float32Array,
  targetDbfs = -3.0,
): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) return samples;

  const targetLinear = Math.pow(10, targetDbfs / 20);
  const gain = targetLinear / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] to guard against floating-point overshoot
    out[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  return out;
}

/**
 * Pad silence onto the leading and/or trailing edges of a buffer.
 *
 * @param samples       Input sample buffer.
 * @param leadingMs     Milliseconds of silence to prepend.
 * @param trailingMs    Milliseconds of silence to append.
 * @param sampleRate    Sample rate (default 24 kHz).
 */
export function padSilence(
  samples: Float32Array,
  leadingMs: number,
  trailingMs: number,
  sampleRate = PCM_SAMPLE_RATE,
): Float32Array {
  const leadingSamples = Math.round((leadingMs / 1000) * sampleRate);
  const trailingSamples = Math.round((trailingMs / 1000) * sampleRate);
  if (leadingSamples === 0 && trailingSamples === 0) return samples;

  const out = new Float32Array(leadingSamples + samples.length + trailingSamples);
  out.set(samples, leadingSamples);
  return out;
}

/**
 * Concatenate multiple Float32Array sample buffers into one.
 * Optionally insert `gapMs` milliseconds of silence between each buffer.
 */
export function concatAudio(
  buffers: Float32Array[],
  gapMs = 0,
  sampleRate = PCM_SAMPLE_RATE,
): Float32Array {
  if (buffers.length === 0) return new Float32Array(0);
  if (buffers.length === 1) return buffers[0];

  const gapSamples = Math.round((gapMs / 1000) * sampleRate);
  const totalLength =
    buffers.reduce((acc, b) => acc + b.length, 0) +
    gapSamples * (buffers.length - 1);
  const out = new Float32Array(totalLength);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    out.set(buffers[i], offset);
    offset += buffers[i].length;
    if (i < buffers.length - 1) {
      offset += gapSamples; // gap is already zeroed
    }
  }
  return out;
}

/**
 * Apply a complete finishing chain in order:
 *  1. Trim silence
 *  2. Normalize peak
 *  3. Pad leading / trailing silence
 */
export interface FinishingOptions {
  trimSilence?: boolean;
  trimOptions?: TrimOptions;
  normalizePeakDb?: number | null;
  leadingMs?: number;
  trailingMs?: number;
}

export function applyFinishing(
  samples: Float32Array,
  opts: FinishingOptions = {},
): Float32Array {
  const {
    trimSilence: doTrim = true,
    trimOptions,
    normalizePeakDb = -3.0,
    leadingMs = 0,
    trailingMs = 0,
  } = opts;

  let out = samples;
  if (doTrim) out = trimSilence(out, trimOptions);
  if (normalizePeakDb != null) out = normalizePeak(out, normalizePeakDb);
  if (leadingMs > 0 || trailingMs > 0) out = padSilence(out, leadingMs, trailingMs);
  return out;
}

// Re-export linearToDbfs for callers that want consistent dB math
export { linearToDbfs };
