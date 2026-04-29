/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QcIssue, ScriptSegment } from '../../types';

export type ExportReadinessItem = {
  id: string;
  label: string;
  action?: 'render_missing' | 'go_review' | 'open_qc';
};

export type ExportReadiness = {
  canExport: boolean;
  blockers: ExportReadinessItem[];
  warnings: ExportReadinessItem[];
  renderedCount: number;
  approvedCount: number;
  missingAudioSegmentIds: number[];
  openQcCount: number;
};

export type ExportReadinessInput = {
  segments: ScriptSegment[];
  qcIssues?: QcIssue[];
  exportProfileSelected?: boolean;
};

const AUDIO_READY_STATUSES = new Set(['rendered', 'approved', 'locked']);

export function isSegmentAudioReady(segment: ScriptSegment): boolean {
  return AUDIO_READY_STATUSES.has(String(segment.status).toLowerCase());
}

export function getExportReadiness({
  segments,
  qcIssues = [],
  exportProfileSelected = true,
}: ExportReadinessInput): ExportReadiness {
  const requiredSegments = segments.filter(segment => segment.script_text.trim().length > 0);
  const missingAudioSegments = requiredSegments.filter(segment => !isSegmentAudioReady(segment));
  const renderedCount = requiredSegments.filter(isSegmentAudioReady).length;
  const approvedCount = requiredSegments.filter(segment => String(segment.status).toLowerCase() === 'approved').length;
  const unapprovedRenderedCount = requiredSegments.filter(segment =>
    isSegmentAudioReady(segment) && String(segment.status).toLowerCase() !== 'approved',
  ).length;
  const openQcCount = qcIssues.filter(issue => issue.status === 'open').length;

  const blockers: ExportReadinessItem[] = [];
  const warnings: ExportReadinessItem[] = [];

  if (requiredSegments.length === 0) {
    blockers.push({
      id: 'no_segments',
      label: 'Add at least one script segment before exporting.',
    });
  }

  if (missingAudioSegments.length > 0) {
    blockers.push({
      id: 'missing_audio',
      label: `${missingAudioSegments.length} segment${missingAudioSegments.length === 1 ? '' : 's'} need rendered audio.`,
      action: 'render_missing',
    });
  }

  if (openQcCount > 0) {
    blockers.push({
      id: 'open_qc',
      label: `${openQcCount} open QC issue${openQcCount === 1 ? '' : 's'} must be resolved or waived.`,
      action: 'open_qc',
    });
  }

  if (unapprovedRenderedCount > 0 && missingAudioSegments.length === 0) {
    warnings.push({
      id: 'unapproved_audio',
      label: `${unapprovedRenderedCount} rendered segment${unapprovedRenderedCount === 1 ? '' : 's'} are not approved.`,
      action: 'go_review',
    });
  }

  if (!exportProfileSelected) {
    warnings.push({
      id: 'no_profile',
      label: 'No finishing profile is selected; default export settings will be used.',
    });
  }

  return {
    canExport: blockers.length === 0,
    blockers,
    warnings,
    renderedCount,
    approvedCount,
    missingAudioSegmentIds: missingAudioSegments.map(segment => segment.id),
    openQcCount,
  };
}
