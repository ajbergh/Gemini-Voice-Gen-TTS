/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CustomPreset, PresetHeadshotMetadata, PresetMetadata } from './types';

export function parsePresetMetadata(metadataJson: string | null | undefined): PresetMetadata | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === 'object' ? parsed as PresetMetadata : null;
  } catch {
    return null;
  }
}

export function getPresetHeadshotMetadata(preset: Pick<CustomPreset, 'metadata_json'>): PresetHeadshotMetadata | null {
  const metadata = parsePresetMetadata(preset.metadata_json);
  const headshot = metadata?.headshot;
  if (!headshot || headshot.status !== 'ready' || !headshot.path) {
    return null;
  }
  return headshot;
}