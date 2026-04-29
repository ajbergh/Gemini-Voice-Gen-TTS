/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectSettingsDrawer.tsx — Right-side slide-in drawer that wraps
 * ProjectSettingsPanel. Replaces the inline panel that pushed script
 * content down. Preserves tab panel scroll position on open/close.
 *
 * On desktop (xl+) the drawer is positioned absolutely within the
 * project workspace grid column. On smaller screens it is fixed to
 * the right viewport edge with a semi-transparent backdrop.
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CustomPreset, PerformanceStyle, ScriptProject, Voice } from '../../types';
import ProjectSettingsPanel from '../ProjectSettingsPanel';

export interface ProjectSettingsDrawerProps {
  open: boolean;
  project: ScriptProject;
  voices: Voice[];
  customPresets?: CustomPreset[];
  styles: PerformanceStyle[];
  settingsVoice: string;
  settingsLang: string;
  settingsModel: string;
  settingsStyleId: number | null;
  savingSettings: boolean;
  onChangeVoice: (v: string) => void;
  onChangeLang: (v: string) => void;
  onChangeModel: (v: string) => void;
  onChangeStyleId: (id: number | null) => void;
  onStyleCreated: (s: PerformanceStyle) => void;
  onSave: () => void;
  onClose: () => void;
  mobile?: boolean;
}

const ProjectSettingsDrawer: React.FC<ProjectSettingsDrawerProps> = ({
  open,
  project,
  voices,
  customPresets = [],
  styles,
  settingsVoice,
  settingsLang,
  settingsModel,
  settingsStyleId,
  savingSettings,
  onChangeVoice,
  onChangeLang,
  onChangeModel,
  onChangeStyleId,
  onStyleCreated,
  onSave,
  onClose,
  mobile = false,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Move focus into drawer when it opens
  useEffect(() => {
    if (open) drawerRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — transparent on xl where drawer sits within the layout */}
      <div
        className="fixed inset-0 z-50 xl:hidden bg-black/20 dark:bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Settings for ${project.title}`}
        className={`fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl focus:outline-none ${mobile ? 'max-w-none' : 'max-w-sm'}`}
      >
        {/* Drawer header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              Project Settings
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
              {project.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project settings"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable settings content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ProjectSettingsPanel
            selectedProject={project}
            voices={voices}
            customPresets={customPresets}
            styles={styles}
            settingsVoice={settingsVoice}
            settingsLang={settingsLang}
            settingsModel={settingsModel}
            settingsStyleId={settingsStyleId}
            savingSettings={savingSettings}
            onChangeVoice={onChangeVoice}
            onChangeLang={onChangeLang}
            onChangeModel={onChangeModel}
            onChangeStyleId={onChangeStyleId}
            onStyleCreated={onStyleCreated}
            onSave={onSave}
            onClose={onClose}
            mobile={mobile}
          />
        </div>
      </div>
    </>
  );
};

export default ProjectSettingsDrawer;
