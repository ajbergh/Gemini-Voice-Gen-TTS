/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CastProfile, QcIssue, ScriptProject, ScriptSegment } from '../../types';
import { getExportReadiness } from './exportReadiness';

export type ProjectHealthStatus =
  | 'empty'
  | 'needs_script'
  | 'needs_cast'
  | 'needs_render'
  | 'needs_review'
  | 'blocked_qc'
  | 'ready_export';

export type ProjectNextAction =
  | { id: 'import_script'; label: 'Import script'; tab: 'script' }
  | { id: 'open_cast'; label: 'Assign cast'; tab: 'cast' }
  | { id: 'render_missing'; label: 'Render missing audio'; tab: 'script' }
  | { id: 'review_takes'; label: 'Review takes'; tab: 'review' }
  | { id: 'resolve_qc'; label: 'Resolve QC'; tab: 'review' }
  | { id: 'start_export'; label: 'Start export'; tab: 'export' };

export interface ProjectHealth {
  status: ProjectHealthStatus;
  label: string;
  detail: string;
  nextAction: ProjectNextAction;
  segmentCount: number;
  renderedCount: number;
  approvedCount: number;
  openQcCount: number;
  missingAudioCount: number;
  draftCount: number;
  castGapCount: number;
  canExport: boolean;
}

export interface ProjectHealthInput {
  project: ScriptProject;
  segments: ScriptSegment[];
  castProfiles: CastProfile[];
  qcIssues?: QcIssue[];
  renderedCount: number;
  approvedCount: number;
  draftCount: number;
  exportProfileSelected?: boolean;
}

export function getProjectHealth({
  project: _project,
  segments,
  castProfiles,
  qcIssues = [],
  renderedCount,
  approvedCount,
  draftCount,
  exportProfileSelected = true,
}: ProjectHealthInput): ProjectHealth {
  const readiness = getExportReadiness({ segments, qcIssues, exportProfileSelected });
  const segmentCount = segments.filter(segment => segment.script_text.trim().length > 0).length;
  const missingAudioCount = readiness.missingAudioSegmentIds.length;
  const openQcCount = readiness.openQcCount;
  const castGapCount = segments.filter(segment =>
    segment.speaker_label &&
    !segment.voice_name &&
    !segment.cast_profile_id &&
    castProfiles.length > 0
  ).length;

  if (segmentCount === 0) {
    return {
      status: 'needs_script',
      label: 'Needs script',
      detail: 'Import a script or add the first segment.',
      nextAction: { id: 'import_script', label: 'Import script', tab: 'script' },
      segmentCount,
      renderedCount,
      approvedCount,
      openQcCount,
      missingAudioCount,
      draftCount,
      castGapCount,
      canExport: false,
    };
  }

  if (castGapCount > 0) {
    return {
      status: 'needs_cast',
      label: 'Needs cast',
      detail: `${castGapCount} speaker${castGapCount === 1 ? '' : 's'} need voice assignment.`,
      nextAction: { id: 'open_cast', label: 'Assign cast', tab: 'cast' },
      segmentCount,
      renderedCount,
      approvedCount,
      openQcCount,
      missingAudioCount,
      draftCount,
      castGapCount,
      canExport: false,
    };
  }

  if (missingAudioCount > 0) {
    return {
      status: 'needs_render',
      label: 'Needs render',
      detail: `${missingAudioCount} segment${missingAudioCount === 1 ? '' : 's'} need audio.`,
      nextAction: { id: 'render_missing', label: 'Render missing audio', tab: 'script' },
      segmentCount,
      renderedCount,
      approvedCount,
      openQcCount,
      missingAudioCount,
      draftCount,
      castGapCount,
      canExport: false,
    };
  }

  if (openQcCount > 0) {
    return {
      status: 'blocked_qc',
      label: 'QC blocked',
      detail: `${openQcCount} open QC issue${openQcCount === 1 ? '' : 's'} before export.`,
      nextAction: { id: 'resolve_qc', label: 'Resolve QC', tab: 'review' },
      segmentCount,
      renderedCount,
      approvedCount,
      openQcCount,
      missingAudioCount,
      draftCount,
      castGapCount,
      canExport: false,
    };
  }

  if (approvedCount < renderedCount) {
    const reviewCount = renderedCount - approvedCount;
    return {
      status: 'needs_review',
      label: 'Needs review',
      detail: `${reviewCount} rendered take${reviewCount === 1 ? '' : 's'} need approval.`,
      nextAction: { id: 'review_takes', label: 'Review takes', tab: 'review' },
      segmentCount,
      renderedCount,
      approvedCount,
      openQcCount,
      missingAudioCount,
      draftCount,
      castGapCount,
      canExport: readiness.canExport,
    };
  }

  return {
    status: 'ready_export',
    label: 'Export ready',
    detail: `${approvedCount}/${segmentCount} approved and no open QC.`,
    nextAction: { id: 'start_export', label: 'Start export', tab: 'export' },
    segmentCount,
    renderedCount,
    approvedCount,
    openQcCount,
    missingAudioCount,
    draftCount,
    castGapCount,
    canExport: readiness.canExport,
  };
}
