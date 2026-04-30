/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ProjectProgressMeterProps {
  total: number;
  rendered: number;
  approved: number;
  openQcCount?: number;
}

const ProjectProgressMeter: React.FC<ProjectProgressMeterProps> = ({
  total,
  rendered,
  approved,
  openQcCount = 0,
}) => {
  const safeTotal = Math.max(total, 0);
  const renderedPercent = safeTotal > 0 ? Math.min(100, Math.round((rendered / safeTotal) * 100)) : 0;
  const approvedPercent = safeTotal > 0 ? Math.min(100, Math.round((approved / safeTotal) * 100)) : 0;
  const barColor = openQcCount > 0
    ? 'bg-amber-500'
    : approved >= safeTotal && safeTotal > 0
    ? 'bg-emerald-500'
    : 'bg-[var(--accent-500)]';

  return (
    <div className="space-y-1" aria-label={`${rendered} of ${safeTotal} segments rendered`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${renderedPercent}%` }} />
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${approvedPercent}%` }} />
      </div>
    </div>
  );
};

export default ProjectProgressMeter;
