/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * audio/pcm.ts — Low-level PCM decoding and duration utilities.
 *
 * All Gemini TTS audio is 24 kHz, 16-bit, signed, little-endian, mono PCM.
 */

export const PCM_SAMPLE_RATE = 24000;
/** Gemini TTS PCM bit depth. */
export const PCM_BIT_DEPTH = 16;
/** Gemini TTS channel count; generated audio is mono. */
export const PCM_CHANNELS = 1;
/** Bytes per sample (16-bit = 2 bytes). */
export const PCM_BYTES_PER_SAMPLE = 2;

/**
 * Decode a base64-encoded PCM byte string to a raw Uint8Array.
 */
export function decodePcmBase64(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode raw 16-bit little-endian PCM bytes to a normalized Float32Array
 * (range -1.0 to +1.0).
 */
export function pcmBytesToFloat32(pcmBytes: Uint8Array): Float32Array {
  const numSamples = Math.floor(pcmBytes.length / PCM_BYTES_PER_SAMPLE);
  const samples = new Float32Array(numSamples);
  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
  for (let i = 0; i < numSamples; i++) {
    // 16-bit signed integer, little-endian
    const int16 = view.getInt16(i * 2, true);
    samples[i] = int16 / 32768.0;
  }
  return samples;
}

/**
 * Calculate duration in seconds from raw PCM byte length.
 * Formula: bytes / (sampleRate * bytesPerSample * channels)
 */
export function calcDurationSeconds(
  byteLength: number,
  sampleRate = PCM_SAMPLE_RATE,
  bytesPerSample = PCM_BYTES_PER_SAMPLE,
  channels = PCM_CHANNELS,
): number {
  return byteLength / (sampleRate * bytesPerSample * channels);
}

/**
 * Decode a base64 PCM string directly to Float32 samples.
 * Convenience wrapper combining decodePcmBase64 + pcmBytesToFloat32.
 */
export function decodePcmBase64ToFloat32(base64: string): Float32Array {
  return pcmBytesToFloat32(decodePcmBase64(base64));
}
