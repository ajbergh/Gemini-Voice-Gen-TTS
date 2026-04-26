/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * audio/wav.ts — WAV (RIFF) encoding utilities.
 *
 * Extracted from AiTtsPreview.tsx so WAV creation can be shared across
 * WaveformCanvas, SegmentTakeList, and any future export pipeline.
 */

/**
 * Encode raw PCM bytes into a WAV Blob with a proper 44-byte RIFF header.
 *
 * @param pcmData       Raw 16-bit signed little-endian PCM bytes.
 * @param sampleRate    Samples per second (default 24 kHz for Gemini TTS).
 * @param numChannels   Channel count (default 1 = mono).
 * @param bitsPerSample Bit depth (default 16).
 */
export function encodeWav(
  pcmData: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Blob {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  // RIFF chunk
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeAscii(8, 'WAVE');

  // fmt sub-chunk
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);           // sub-chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeAscii(36, 'data');
  view.setUint32(40, pcmData.length, true);
  new Uint8Array(buffer, 44).set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Create a temporary object URL for downloading a WAV file.
 * Caller is responsible for calling URL.revokeObjectURL(url) when done.
 */
export function createWavObjectUrl(pcmData: Uint8Array, sampleRate = 24000): string {
  return URL.createObjectURL(encodeWav(pcmData, sampleRate));
}
