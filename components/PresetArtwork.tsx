/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PresetArtwork.tsx - Resilient image renderer for saved presets.
 *
 * Prefers generated preset headshots when available and falls back to the voice
 * artwork URL without leaving broken image placeholders in preset cards.
 */

import React, { useEffect, useState } from 'react';
import { getPresetImageUrl } from '../api';

interface PresetArtworkProps {
  presetId: number;
  hasHeadshot: boolean;
  fallbackImageUrl?: string | null;
  alt: string;
  className: string;
}

/** Render the best available image for a preset and hide it if all sources fail. */
const PresetArtwork: React.FC<PresetArtworkProps> = ({ presetId, hasHeadshot, fallbackImageUrl, alt, className }) => {
  const preferredHeadshotUrl = hasHeadshot ? getPresetImageUrl(presetId) : null;
  const [headshotFailed, setHeadshotFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setHeadshotFailed(false);
    setFallbackFailed(false);
  }, [presetId, preferredHeadshotUrl, fallbackImageUrl]);

  const imageSrc = !headshotFailed && preferredHeadshotUrl
    ? preferredHeadshotUrl
    : (!fallbackFailed ? fallbackImageUrl : null);

  if (!imageSrc) {
    return null;
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!headshotFailed && preferredHeadshotUrl) {
          setHeadshotFailed(true);
          return;
        }
        setFallbackFailed(true);
      }}
    />
  );
};

export default PresetArtwork;
