/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CastContinuityWarnings.tsx — Lightweight banner shown inside CastBoard that
 * flags segments whose speaker_label matches a cast profile name but whose
 * voice_name differs from that profile's voice (manual voice-override drift).
 *
 * Also flags segments whose cast_profile_id references a profile that has
 * since had its voice_name changed (stale resolution).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { listProjectSegments } from '../api';
import { CastProfile, ScriptSegment } from '../types';

interface CastContinuityWarningsProps {
  projectId: number;
  castProfiles: CastProfile[];
}

interface Mismatch {
  segmentId: number;
  segmentPreview: string;
  profileName: string;
  expectedVoice: string;
  actualVoice: string;
  kind: 'label_drift' | 'profile_override';
}

/** Render warnings when a cast profile and segment assignment drift apart. */
const CastContinuityWarnings: React.FC<CastContinuityWarningsProps> = ({
  projectId,
  castProfiles,
}) => {
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    let cancelled = false;
    listProjectSegments(projectId)
      .then(data => { if (!cancelled) setSegments(data); })
      .catch(() => { /* silently ignore */ });
    return () => { cancelled = true; };
  }, [projectId]);

  const mismatches = useMemo<Mismatch[]>(() => {
    if (castProfiles.length === 0 || segments.length === 0) return [];
    const profileByName = new Map(castProfiles.map(p => [p.name.toLowerCase(), p]));
    const profileById   = new Map(castProfiles.map(p => [p.id, p]));

    const results: Mismatch[] = [];
    for (const seg of segments) {
      const preview = seg.script_text.slice(0, 60) + (seg.script_text.length > 60 ? '…' : '');

      // Case 1: speaker_label matches a profile by name, but voice_name differs
      // and the segment does NOT already have a cast_profile_id assignment.
      if (seg.speaker_label && !seg.cast_profile_id && seg.voice_name) {
        const profile = profileByName.get(seg.speaker_label.toLowerCase());
        if (profile?.voice_name && profile.voice_name !== seg.voice_name) {
          results.push({
            segmentId:    seg.id,
            segmentPreview: preview,
            profileName:  profile.name,
            expectedVoice: profile.voice_name,
            actualVoice:  seg.voice_name,
            kind:         'label_drift',
          });
        }
      }

      // Case 2: segment has cast_profile_id, plus an explicit voice_name override
      // that doesn't match the current profile voice.
      if (seg.cast_profile_id && seg.voice_name) {
        const profile = profileById.get(seg.cast_profile_id);
        if (profile?.voice_name && profile.voice_name !== seg.voice_name) {
          results.push({
            segmentId:    seg.id,
            segmentPreview: preview,
            profileName:  profile.name,
            expectedVoice: profile.voice_name,
            actualVoice:  seg.voice_name,
            kind:         'profile_override',
          });
        }
      }
    }
    return results;
  }, [castProfiles, segments]);

  if (mismatches.length === 0 || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={15}
          className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {mismatches.length} voice continuity {mismatches.length === 1 ? 'warning' : 'warnings'}
          </p>
          <ul className="space-y-1">
            {mismatches.map(m => (
              <li key={`${m.kind}-${m.segmentId}`} className="text-[11px] text-amber-700 dark:text-amber-400">
                {m.kind === 'label_drift'
                  ? <>Segment <span className="font-semibold">#{m.segmentId}</span> has speaker label &ldquo;{m.profileName}&rdquo; but voice <span className="font-semibold">{m.actualVoice}</span> (profile uses <span className="font-semibold">{m.expectedVoice}</span>). Consider assigning the cast profile instead.</>
                  : <>Segment <span className="font-semibold">#{m.segmentId}</span> is assigned to &ldquo;{m.profileName}&rdquo; but has a manual voice override <span className="font-semibold">{m.actualVoice}</span> (profile voice: <span className="font-semibold">{m.expectedVoice}</span>).</>
                }
                <span className="ml-1 text-zinc-400 dark:text-zinc-500 italic truncate">&ldquo;{m.segmentPreview}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss warnings"
          className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export default CastContinuityWarnings;
