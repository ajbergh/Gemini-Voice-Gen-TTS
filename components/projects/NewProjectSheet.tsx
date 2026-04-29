/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Client, ProjectKind } from '../../types';
import { PROJECT_TEMPLATES } from './projectTemplates';

interface NewProjectSheetProps {
  title: string;
  kind: ProjectKind;
  description: string;
  clientId: number | null;
  templateId: string;
  clients: Client[];
  creating: boolean;
  onTitleChange: (value: string) => void;
  onKindChange: (value: ProjectKind) => void;
  onDescriptionChange: (value: string) => void;
  onClientIdChange: (value: number | null) => void;
  onTemplateIdChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

const PROJECT_KINDS: { value: ProjectKind; label: string }[] = [
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'voiceover', label: 'Voiceover' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'training', label: 'Training' },
  { value: 'character_reel', label: 'Character Reel' },
  { value: 'other', label: 'Other' },
];

const NewProjectSheet: React.FC<NewProjectSheetProps> = ({
  title,
  kind,
  description,
  clientId,
  templateId,
  clients,
  creating,
  onTitleChange,
  onKindChange,
  onDescriptionChange,
  onClientIdChange,
  onTemplateIdChange,
  onSubmit,
}) => (
  <form onSubmit={onSubmit} className="space-y-2 pt-1">
    <select
      aria-label="Project template"
      value={templateId}
      onChange={e => onTemplateIdChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
    >
      {PROJECT_TEMPLATES.map(template => (
        <option key={template.id} value={template.id}>{template.label}</option>
      ))}
    </select>

    <input
      autoFocus
      value={title}
      onChange={e => onTitleChange(e.target.value)}
      placeholder="Project title"
      className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
    />

    <textarea
      rows={2}
      value={description}
      onChange={e => onDescriptionChange(e.target.value)}
      placeholder="Description"
      className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
    />

    <select
      aria-label="Client or brand"
      value={clientId ?? ''}
      onChange={e => onClientIdChange(e.target.value ? Number(e.target.value) : null)}
      className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
    >
      <option value="">No client</option>
      {clients.map(client => (
        <option key={client.id} value={client.id}>{client.name}</option>
      ))}
    </select>

    <div className="flex gap-2">
      <select
        aria-label="Project kind"
        value={kind}
        onChange={e => onKindChange(e.target.value as ProjectKind)}
        className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
      >
        {PROJECT_KINDS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={creating || !title.trim()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white hover:bg-zinc-800 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
      >
        {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Create
      </button>
    </div>
  </form>
);

export default NewProjectSheet;
