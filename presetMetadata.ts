/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * presetMetadata.ts - Helpers for reading structured preset metadata.
 *
 * Keeps casting-director and generated-headshot metadata parsing isolated from
 * UI components so malformed JSON never breaks preset rendering.
 */

import { CustomPreset, PresetHeadshotMetadata, PresetMetadata } from './types';

/** Safely parse a preset's metadata_json payload. */
export function parsePresetMetadata(metadataJson: string | null | undefined): PresetMetadata | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === 'object' ? parsed as PresetMetadata : null;
  } catch {
    return null;
  }
}

/** Return ready-to-render headshot metadata, or null when no usable image exists. */
export function getPresetHeadshotMetadata(preset: Pick<CustomPreset, 'metadata_json'>): PresetHeadshotMetadata | null {
  const metadata = parsePresetMetadata(preset.metadata_json);
  const headshot = metadata?.headshot;
  if (!headshot || headshot.status !== 'ready' || !headshot.path) {
    return null;
  }
  return headshot;
}
