/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CastBoard.tsx — Project cast bible board.
 *
 * Loads all cast profiles for the active project and displays them grouped
 * by role (Narrator → Protagonist → Antagonist → Supporting → Extras →
 * Brand Voice → Archived).  Each group shows a responsive grid of
 * CastProfileCards with inline Add, Edit, Audition, and Delete flows.
 *
 * Mounts as an inline panel inside ProjectWorkspace (not a standalone modal),
 * consistent with the PronunciationEditor and TimelineReview panels.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Users, X } from 'lucide-react';
import { deleteCastProfile, listProjectCast } from '../api';
import { CastProfile, CastRole, Voice } from '../types';
import { useToast } from './ToastProvider';
import CastProfileCard from './CastProfileCard';
import CastProfileEditor from './CastProfileEditor';
import CastAuditionPanel from './CastAuditionPanel';
import CastContinuityWarnings from './CastContinuityWarnings';

interface CastBoardProps {
  projectId: number;
  voices: Voice[];
  onClose: () => void;
}

type RoleGroup = {
  role: CastRole;
  label: string;
  profiles: CastProfile[];
};

const ROLE_ORDER: CastRole[] = [
  'narrator',
  'protagonist',
  'antagonist',
  'supporting',
  'extra',
  'brand_voice',
  'archived',
];

const ROLE_LABELS: Record<CastRole, string> = {
  narrator:    'Narrator',
  protagonist: 'Protagonist',
  antagonist:  'Antagonist',
  supporting:  'Supporting',
  extra:       'Extras',
  brand_voice: 'Brand Voice',
  archived:    'Archived',
};

// Always show Narrator and Protagonist groups even when empty so new projects
// have obvious entry points.
const ALWAYS_VISIBLE: Set<CastRole> = new Set(['narrator', 'protagonist']);

const CastBoard: React.FC<CastBoardProps> = ({ projectId, voices, onClose }) => {
  const { showToast } = useToast();
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const [profiles, setProfiles]   = useState<CastProfile[]>([]);
  const [loading, setLoading]     = useState(true);

  // 'new' signals create mode; a CastProfile signals edit mode; null = closed
  const [editingProfile, setEditingProfile] = useState<CastProfile | 'new' | null>(null);
  const [editorInitialRole, setEditorInitialRole] = useState<CastRole | undefined>(undefined);

  // null = closed
  const [auditioningProfile, setAuditioningProfile] = useState<CastProfile | null>(null);

  // ---- load profiles ----
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjectCast(projectId);
      if (!isMounted.current) return;
      setProfiles(data);
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Failed to load cast.', 'error');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // ---- delete ----
  async function handleDelete(profile: CastProfile) {
    if (!window.confirm(`Delete "${profile.name}"? This cannot be undone.`)) return;
    try {
      await deleteCastProfile(profile.id);
      if (!isMounted.current) return;
      setProfiles(prev => prev.filter(p => p.id !== profile.id));
      showToast(`Deleted "${profile.name}".`, 'success');
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Delete failed.', 'error');
    }
  }

  // ---- handle save from editor ----
  function handleEditorSave(saved: CastProfile) {
    const isNew = editingProfile === 'new';
    setProfiles(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => (p.id === saved.id ? saved : p)) : [...prev, saved];
    });
    setEditingProfile(null);
    showToast(isNew ? `Created "${saved.name}".` : `Saved "${saved.name}".`, 'success');
  }

  // ---- open editor with a role pre-selected ----
  function openCreate(role: CastRole) {
    setEditorInitialRole(role);
    setEditingProfile('new');
  }

  // ---- group profiles by role ----
  const groups: RoleGroup[] = ROLE_ORDER
    .map(role => ({
      role,
      label:    ROLE_LABELS[role],
      profiles: profiles
        .filter(p => p.role === role)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter(g => g.profiles.length > 0 || ALWAYS_VISIBLE.has(g.role));

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-zinc-500 dark:text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Cast Bible</h3>
          {!loading && (
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              {profiles.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreate('narrator')}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors"
          >
            <Plus size={13} />
            Add character
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
            aria-label="Close cast board"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-8">
        {/* Continuity warnings */}
        <CastContinuityWarnings projectId={projectId} castProfiles={profiles} />
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-zinc-400" />
          </div>
        ) : profiles.length === 0 ? (
          /* Empty state */
          <div className="py-12 text-center">
            <Users size={36} className="mx-auto mb-3 text-zinc-200 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No characters yet</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Add your first narrator or character to build the cast bible.
            </p>
            <button
              type="button"
              onClick={() => openCreate('narrator')}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <Plus size={13} />
              Add first character
            </button>
          </div>
        ) : (
          /* Role groups */
          groups.map(group => (
            <section key={group.role} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {group.label}
                  {group.profiles.length > 0 && (
                    <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-600">
                      ({group.profiles.length})
                    </span>
                  )}
                </h4>
                <button
                  type="button"
                  onClick={() => openCreate(group.role)}
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-800 px-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  title={`Add ${group.label}`}
                >
                  <Plus size={11} />
                  Add
                </button>
              </div>

              {group.profiles.length === 0 ? (
                <p className="py-2 text-xs italic text-zinc-400 dark:text-zinc-600">
                  No {group.label.toLowerCase()} added yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.profiles.map(profile => (
                    <CastProfileCard
                      key={profile.id}
                      profile={profile}
                      onEdit={p => { setEditorInitialRole(undefined); setEditingProfile(p); }}
                      onAudition={p => setAuditioningProfile(p)}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      {/* Editor modal */}
      {editingProfile !== null && (
        <CastProfileEditor
          projectId={projectId}
          profile={editingProfile === 'new' ? undefined : editingProfile}
          voices={voices}
          initialRole={editorInitialRole}
          onSave={handleEditorSave}
          onClose={() => setEditingProfile(null)}
        />
      )}

      {/* Audition modal */}
      {auditioningProfile !== null && (
        <CastAuditionPanel
          profile={auditioningProfile}
          voices={voices}
          onClose={() => setAuditioningProfile(null)}
        />
      )}
    </div>
  );
};

export default CastBoard;
