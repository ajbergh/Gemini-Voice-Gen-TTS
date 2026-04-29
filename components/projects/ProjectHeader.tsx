/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectHeader.tsx — Project title, kind/status badges, default voice label,
 * and data-backed production stage trail. Purely presentational.
 */

import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { CastProfile, Client, QcIssue, ScriptProject, ScriptSegment } from '../../types';
import { getExportReadiness } from './exportReadiness';

interface StageInfo {
  label: string;
  detail: string | null;
  done: boolean;
  active: boolean;
}

export interface ProjectHeaderProps {
  project: ScriptProject;
  client?: Client | null;
  segments: ScriptSegment[];
  castProfiles: CastProfile[];
  qcIssues?: QcIssue[];
  renderedCount: number;
  approvedCount: number;
  draftCount: number;
  compactStage?: boolean;
  hideTitle?: boolean;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  client,
  segments,
  castProfiles,
  qcIssues = [],
  renderedCount,
  approvedCount,
  draftCount,
  compactStage = false,
  hideTitle = false,
}) => {
  const readiness = getExportReadiness({ segments, qcIssues, exportProfileSelected: true });
  const castRequiredSegments = segments.filter(segment => segment.speaker_label && !segment.voice_name && !segment.cast_profile_id);
  const stages: StageInfo[] = [
    {
      label: 'Scripted',
      detail: `${segments.length} seg${segments.length !== 1 ? 's' : ''}`,
      done: segments.length > 0,
      active: segments.length === 0,
    },
    {
      label: 'Cast',
      detail: castProfiles.length > 0 ? `${castProfiles.length}` : null,
      done: castRequiredSegments.length === 0,
      active: castRequiredSegments.length > 0 && castProfiles.length > 0,
    },
    {
      label: 'Rendered',
      detail: `${renderedCount}/${segments.length}`,
      done: renderedCount === segments.length && segments.length > 0,
      active: renderedCount > 0 && renderedCount < segments.length,
    },
    {
      label: 'Reviewed',
      detail: approvedCount > 0 ? `${approvedCount}/${renderedCount}` : null,
      done: approvedCount > 0 && approvedCount === renderedCount,
      active: approvedCount > 0 && approvedCount < renderedCount,
    },
    {
      label: 'Export ready',
      detail: null,
      done: readiness.canExport,
      active: segments.length > 0 && !readiness.canExport && draftCount === 0,
    },
  ];
  const currentStage = stages.find(stage => !stage.done) ?? stages[stages.length - 1];
  const compactStageText = segments.length === 0
    ? 'No script yet'
    : currentStage.label === 'Export ready' && readiness.canExport
    ? 'Ready for export'
    : currentStage.detail
    ? `${currentStage.label} ${currentStage.detail}`
    : currentStage.label;

  return (
    <div className="min-w-0">
      {/* Kind and status badges */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 capitalize">
          {project.kind.replace(/_/g, ' ')}
        </span>
        <span className="rounded-full bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          {project.status}
        </span>
      </div>

      {!hideTitle && (
        <h3 className="text-2xl font-serif font-medium text-zinc-900 dark:text-white">
          {project.title}
        </h3>
      )}

      {project.default_voice_name && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Default voice: {project.default_voice_name}
        </p>
      )}
      {client && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Client: {client.name}
        </p>
      )}

      {/* Stage trail - compact on phones, full trail elsewhere. */}
      {compactStage ? (
        <div data-testid="project-stage-trail" className="mt-3 flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex max-w-[42vw] shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              readiness.canExport
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : currentStage.active
                ? 'bg-[var(--accent-100)] dark:bg-[var(--accent-900)]/40 text-[var(--accent-700)] dark:text-[var(--accent-300)]'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {readiness.canExport && <Check size={9} aria-hidden="true" />}
            <span className="truncate">{readiness.canExport ? 'Export ready' : currentStage.label}</span>
          </span>
          <span className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {compactStageText}
          </span>
        </div>
      ) : segments.length > 0 ? (
        <div data-testid="project-stage-trail" className="mt-3 flex items-center gap-1 overflow-x-auto pb-0.5">
          {stages.map((stage, i) => (
            <React.Fragment key={stage.label}>
              {i > 0 && (
                <ChevronRight
                  size={10}
                  className="shrink-0 text-zinc-300 dark:text-zinc-600"
                  aria-hidden="true"
                />
              )}
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  stage.done
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : stage.active
                    ? 'bg-[var(--accent-100)] dark:bg-[var(--accent-900)]/40 text-[var(--accent-700)] dark:text-[var(--accent-300)]'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {stage.done && <Check size={8} aria-hidden="true" />}
                {stage.label}
                {stage.detail && (
                  <span className="opacity-60">{stage.detail}</span>
                )}
              </span>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ProjectHeader;
