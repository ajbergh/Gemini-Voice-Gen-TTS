/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectStatsBar.tsx - Compact counts for the project workspace.
 *
 * Shows section, segment, and draft totals above the script editing surface.
 */

import React from 'react';
import { FileText, Layers, Rows3 } from 'lucide-react';

interface ProjectStatsBarProps {
  sectionCount: number;
  segmentCount: number;
  draftCount: number;
}

/** Render the project section, segment, and draft summary counters. */
const ProjectStatsBar: React.FC<ProjectStatsBarProps> = ({ sectionCount, segmentCount, draftCount }) => (
  <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
    <div className="p-3 sm:p-4">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <Layers size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Sections</span>
      </div>
      <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{sectionCount}</p>
    </div>
    <div className="border-l border-zinc-200 p-3 dark:border-zinc-800 sm:p-4">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <Rows3 size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Segments</span>
      </div>
      <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{segmentCount}</p>
    </div>
    <div className="border-l border-zinc-200 p-3 dark:border-zinc-800 sm:p-4">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <FileText size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Draft</span>
      </div>
      <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{draftCount}</p>
    </div>
  </div>
);

export default ProjectStatsBar;
