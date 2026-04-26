/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ExportProfilePicker — Dropdown for selecting a named export/finishing profile.
 *
 * Loads profiles from /api/export-profiles on mount and renders a native
 * <select> with builtin profiles listed first, then custom ones, then a divider.
 */

import React, { useEffect, useState } from 'react';
import { listExportProfiles } from '../api';
import { ExportProfile } from '../types';

interface ExportProfilePickerProps {
  /** Currently selected profile ID, or null for "none selected". */
  value: number | null;
  /** Called when the user picks a profile (or null to clear). */
  onChange: (profileId: number | null, profile: ExportProfile | null) => void;
  /** Additional CSS classes for the <select> element. */
  className?: string;
  /** Whether the picker should be disabled. */
  disabled?: boolean;
}

export default function ExportProfilePicker({
  value,
  onChange,
  className = '',
  disabled = false,
}: ExportProfilePickerProps) {
  const [profiles, setProfiles] = useState<ExportProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listExportProfiles()
      .then(list => { if (mounted) setProfiles(list); })
      .catch(() => { /* non-fatal */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(null, null);
    } else {
      const id = parseInt(raw, 10);
      const found = profiles.find(p => p.id === id) ?? null;
      onChange(id, found);
    }
  };

  const builtins = profiles.filter(p => p.is_builtin);
  const custom = profiles.filter(p => !p.is_builtin);

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      disabled={disabled || loading}
      aria-label="Export profile"
      className={`h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)] disabled:opacity-50 ${className}`}
    >
      <option value="">No finishing profile</option>
      {builtins.length > 0 && (
        <optgroup label="Built-in profiles">
          {builtins.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      )}
      {custom.length > 0 && (
        <optgroup label="Custom profiles">
          {custom.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
