/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, ProjectKind, ProjectSummary, ScriptProject } from '../../types';

export type ProjectSort = 'updated_desc' | 'created_desc' | 'title_asc' | 'kind_asc';
export type ProjectView = 'active' | 'needs_review' | 'blocked' | 'recent' | 'archived';

export const PROJECT_KINDS: { value: ProjectKind; label: string }[] = [
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'voiceover', label: 'Voiceover' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'training', label: 'Training' },
  { value: 'character_reel', label: 'Character Reel' },
  { value: 'other', label: 'Other' },
];

export const SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'created_desc', label: 'Recently created' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'kind_asc', label: 'Kind' },
];

export const PROJECT_VIEWS: { value: ProjectView; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'needs_review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'recent', label: 'Recent' },
  { value: 'archived', label: 'Archived' },
];

export function formatKind(kind: string): string {
  return PROJECT_KINDS.find(k => k.value === kind)?.label ?? kind.replace(/_/g, ' ');
}

export function formatUpdatedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function projectMatchesSearch(project: ScriptProject, query: string, client?: Client): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const clientName = client?.name ?? '';
  return (
    project.title.toLowerCase().includes(q) ||
    project.kind.toLowerCase().includes(q) ||
    (project.description ?? '').toLowerCase().includes(q) ||
    clientName.toLowerCase().includes(q)
  );
}

export function projectMatchesView(project: ScriptProject, view: ProjectView, summary?: ProjectSummary): boolean {
  if (view === 'archived') return project.status === 'archived';
  if (project.status === 'archived') return false;
  if (view === 'active' || view === 'recent') return true;
  if (view === 'needs_review') {
    const rendered = summary?.rendered_count ?? 0;
    const approved = summary?.approved_count ?? 0;
    return rendered > approved;
  }
  if (view === 'blocked') {
    const segmentCount = summary?.segment_count ?? 0;
    const rendered = summary?.rendered_count ?? 0;
    return (summary?.open_qc_count ?? 0) > 0 || rendered < segmentCount;
  }
  return true;
}

export function sortProjects(projects: ScriptProject[], sort: ProjectSort): ScriptProject[] {
  const sorted = [...projects];
  switch (sort) {
    case 'updated_desc':
      sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      break;
    case 'created_desc':
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    case 'title_asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'kind_asc':
      sorted.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
      break;
  }
  return sorted;
}
