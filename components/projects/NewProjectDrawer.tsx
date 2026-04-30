/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, FileText, Loader2, Mic, PackagePlus, Sparkles, Users, X } from 'lucide-react';
import { Client, ProjectKind, Voice } from '../../types';
import { PROJECT_TEMPLATES, ProjectTemplate } from './projectTemplates';
import { formatKind } from './projectListFilters';

interface NewProjectDrawerProps {
  open: boolean;
  mobile?: boolean;
  title: string;
  kind: ProjectKind;
  description: string;
  clientId: number | null;
  templateId: string;
  defaultVoice: string;
  languageCode: string;
  model: string;
  clients: Client[];
  voices: Voice[];
  creating: boolean;
  onTitleChange: (value: string) => void;
  onKindChange: (value: ProjectKind) => void;
  onDescriptionChange: (value: string) => void;
  onClientIdChange: (value: number | null) => void;
  onTemplateIdChange: (value: string) => void;
  onDefaultVoiceChange: (value: string) => void;
  onLanguageCodeChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onCreate: (options?: { openImport?: boolean }) => void;
  onClose: () => void;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  audiobook_chapters: <BookOpen size={16} />,
  voiceover_spot: <Mic size={16} />,
  podcast_episode: <Users size={16} />,
  training_module: <FileText size={16} />,
  character_reel: <Sparkles size={16} />,
  blank: <PackagePlus size={16} />,
};

const TTS_MODELS = [
  { value: 'gemini-3.1-flash-tts-preview', label: '3.1 Flash' },
  { value: 'gemini-2.5-flash-preview-tts', label: '2.5 Flash' },
  { value: 'gemini-2.5-pro-preview-tts', label: '2.5 Pro' },
];

function templateSummary(template: ProjectTemplate): string {
  if (template.defaultSections.length === 0) return 'Empty structure';
  return `${template.defaultSections.length} default section${template.defaultSections.length === 1 ? '' : 's'}`;
}

const NewProjectDrawer: React.FC<NewProjectDrawerProps> = ({
  open,
  mobile = false,
  title,
  kind,
  description,
  clientId,
  templateId,
  defaultVoice,
  languageCode,
  model,
  clients,
  voices,
  creating,
  onTitleChange,
  onKindChange,
  onDescriptionChange,
  onClientIdChange,
  onTemplateIdChange,
  onDefaultVoiceChange,
  onLanguageCodeChange,
  onModelChange,
  onCreate,
  onClose,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    drawerRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleTemplateSelect = (template: ProjectTemplate) => {
    onTemplateIdChange(template.id);
    onKindChange(template.kind);
    onDescriptionChange(template.description);
    if (template.recommendedDefaults?.language_code) {
      onLanguageCodeChange(template.recommendedDefaults.language_code);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/20 dark:bg-black/45"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Create project"
        className={`fixed z-[60] flex flex-col border-zinc-200 bg-white shadow-2xl focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 ${
          mobile
            ? 'inset-0'
            : 'inset-y-0 right-0 w-full max-w-2xl border-l'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">New production workspace</p>
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white">Create project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new project drawer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <form
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
            onSubmit={event => {
              event.preventDefault();
              onCreate();
            }}
          >
            <div className="space-y-5">
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Choose a template</h3>
                  <span className="text-xs text-zinc-400">Sets starter sections</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PROJECT_TEMPLATES.map(template => {
                    const active = template.id === templateId;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplateSelect(template)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                        }`}
                      >
                        <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {TEMPLATE_ICONS[template.id] ?? <FileText size={16} />}
                        </span>
                        <span className="block text-sm font-semibold text-zinc-900 dark:text-white">{template.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{template.description}</span>
                        <span className="mt-2 inline-flex rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {templateSummary(template)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Project details</h3>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Project title</label>
                  <input
                    autoFocus
                    value={title}
                    onChange={event => onTitleChange(event.target.value)}
                    placeholder="Project title"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Client or brand</label>
                  <select
                    aria-label="Client or brand"
                    value={clientId ?? ''}
                    onChange={event => onClientIdChange(event.target.value ? Number(event.target.value) : null)}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                  >
                    <option value="">No client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Project description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={event => onDescriptionChange(event.target.value)}
                    placeholder="Describe the deliverable, audience, and production notes."
                    className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Summary</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{title.trim() || 'Untitled project'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                    {formatKind(kind)}
                  </span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                    {PROJECT_TEMPLATES.find(template => template.id === templateId)?.label ?? 'Template'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAdvancedOpen(prev => !prev)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
              >
                Production defaults
                <span>{advancedOpen ? 'Hide' : 'Show'}</span>
              </button>

              {advancedOpen && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Default voice</label>
                    <select
                      value={defaultVoice}
                      onChange={event => onDefaultVoiceChange(event.target.value)}
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <option value="">No default voice</option>
                      {voices.map(voice => (
                        <option key={voice.name} value={voice.name}>{voice.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Language code</label>
                    <input
                      value={languageCode}
                      onChange={event => onLanguageCodeChange(event.target.value)}
                      placeholder="en"
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Model</label>
                    <select
                      value={model}
                      onChange={event => onModelChange(event.target.value)}
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      {TTS_MODELS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  aria-label="Create"
                  disabled={creating || !title.trim()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-[var(--accent-600)] dark:hover:bg-[var(--accent-500)]"
                >
                  {creating ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Create project
                </button>
                <button
                  type="button"
                  disabled={creating || !title.trim()}
                  onClick={() => onCreate({ openImport: true })}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Create and import script
                </button>
              </div>
            </aside>
          </form>
        </div>
      </div>
    </>
  );
};

export default NewProjectDrawer;
