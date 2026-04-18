/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SkeletonCard.tsx — Loading Skeleton Placeholder
 *
 * Renders a pulsing skeleton placeholder matching the VoiceCard layout.
 * Used during initial data loading to reduce perceived latency.
 */

import React from 'react';

const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden animate-pulse">
    {/* Image placeholder */}
    <div className="aspect-square bg-zinc-200 dark:bg-zinc-700" />
    {/* Content */}
    <div className="p-4 space-y-3">
      {/* Name */}
      <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full w-24" />
      {/* Gender + pitch */}
      <div className="flex gap-2">
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full w-12" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full w-16" />
      </div>
      {/* Badges */}
      <div className="flex gap-1.5">
        <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full w-14" />
        <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full w-18" />
        <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full w-12" />
      </div>
    </div>
  </div>
);

/** Grid of skeleton cards for loading state. */
export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default SkeletonCard;
