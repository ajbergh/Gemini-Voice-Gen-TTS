/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectWorkspace.tsx — Durable script-project shell with inline section and
 * segment editing, text import, and last-project restoration.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Film,
  FileText,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  Wrench,
} from 'lucide-react';
import {
  archiveProject,
  batchRenderProject,
  CONFIG_KEYS,
  createProject,
  createProjectSection,
  createProjectSegment,
  deleteProjectSection,
  deleteProjectSegment,
  getConfig,
  importProjectText,
  listProjectCast,
  listProjectSections,
  listProjectSegments,
  listProjects,
  listStyles,
  reRenderSegment,
  updateConfig,
  updateProject,
  updateProjectSection,
  updateProjectSegment,
} from '../api';
import CastBoard from './CastBoard';
import PronunciationEditor from './PronunciationEditor';
import ReviewMode from './ReviewMode';
import TimelineReview from './TimelineReview';
import { formatJobType, useJobs } from './JobProvider';
import { ProgressEvent } from '../api';
import {
  CastProfile,
  CustomPreset,
  PerformanceStyle,
  ProjectKind,
  ScriptProject,
  ScriptSection,
  ScriptSegment,
  SegmentStatus,
  Voice,
} from '../types';
import { useToast } from './ToastProvider';
import ScriptReaderModal from './ScriptReaderModal';
import ScriptPrepDialog from './ScriptPrepDialog';
import SegmentTakeList from './SegmentTakeList';
import StylePresetPicker from './StylePresetPicker';
import ExportDialog from './ExportDialog';
import { useResponsiveMode } from './useResponsiveMode';

interface ProjectWorkspaceProps {
  voices: Voice[];
  customPresets: CustomPreset[];
  initialVoiceName: string;
  onClose: () => void;
  inline?: boolean;
}

const PROJECT_KINDS: { value: ProjectKind; label: string }[] = [
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'voiceover', label: 'Voiceover' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'training', label: 'Training' },
  { value: 'character_reel', label: 'Character Reel' },
  { value: 'other', label: 'Other' },
];

type WorkspaceMobileTab = 'script' | 'cast' | 'takes' | 'jobs' | 'review';

const MOBILE_TABS: { id: WorkspaceMobileTab; label: string; icon: React.ReactNode }[] = [
  { id: 'script', label: 'Script', icon: <FileText size={15} /> },
  { id: 'cast', label: 'Cast', icon: <Users size={15} /> },
  { id: 'takes', label: 'Takes', icon: <Rows3 size={15} /> },
  { id: 'jobs', label: 'Jobs', icon: <Loader2 size={15} /> },
  { id: 'review', label: 'Review', icon: <ClipboardCheck size={15} /> },
];

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
  changed:   'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  queued:    'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  rendering: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  rendered:  'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  approved:  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  flagged:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  failed:    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  locked:    'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300',
};

function formatKind(kind: string): string {
  return PROJECT_KINDS.find(item => item.value === kind)?.label ?? kind.replace(/_/g, ' ');
}

function statusBadge(status: string): string {
  return STATUS_BADGE[status] ?? STATUS_BADGE.draft;
}

/** Groups segments by section_id (null -> unsectioned). */
function groupBySection(segments: ScriptSegment[]): Map<number | null, ScriptSegment[]> {
  const map = new Map<number | null, ScriptSegment[]>();
  for (const seg of segments) {
    const key = seg.section_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(seg);
  }
  return map;
}

// ---------------------------------------------------------------------------

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  voices,
  customPresets,
  initialVoiceName,
  onClose,
}) => {
  const { showToast } = useToast();
  const { subscribeToProgress, jobs, activeJobs } = useJobs();
  const responsiveMode = useResponsiveMode();
  const isPhone = responsiveMode === 'phone';
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // ---- project list ----
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<ProjectKind>('audiobook');

  // ---- project contents ----
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [loadingProjectData, setLoadingProjectData] = useState(false);

  // ---- UI state ----
  const [error, setError] = useState<string | null>(null);
  const [showCompactTool, setShowCompactTool] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [mobileTab, setMobileTab] = useState<WorkspaceMobileTab>('script');

  // ---- add section ----
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  // ---- edit section inline ----
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [editingSectionKind, setEditingSectionKind] = useState<string>('chapter');
  const [savingSectionEdit, setSavingSectionEdit] = useState(false);

  // ---- add segment ----
  const [addingToSectionId, setAddingToSectionId] = useState<number | 'unsectioned' | null>(null);
  const [newSegmentText, setNewSegmentText] = useState('');
  const [savingSegment, setSavingSegment] = useState(false);

  // ---- cast profiles (loaded per project) ----
  const [castProfiles, setCastProfiles] = useState<CastProfile[]>([]);

  // ---- performance styles (loaded per project) ----
  const [styles, setStyles] = useState<PerformanceStyle[]>([]);

  // ---- edit segment inline ----
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
  const [editingSegmentText, setEditingSegmentText] = useState('');
  const [editingSegmentSpeaker, setEditingSegmentSpeaker] = useState('');
  const [editingSegmentVoice, setEditingSegmentVoice] = useState('');
  const [editingSegmentCastProfileId, setEditingSegmentCastProfileId] = useState<number | null>(null);
  const [editingSegmentStyleId, setEditingSegmentStyleId] = useState<number | null>(null);
  const [editingSegmentProvider, setEditingSegmentProvider] = useState('');
  const [editingSegmentModel, setEditingSegmentModel] = useState('');
  const [editingSegmentFallbackProvider, setEditingSegmentFallbackProvider] = useState('');
  const [editingSegmentFallbackModel, setEditingSegmentFallbackModel] = useState('');
  const [savingSegmentEdit, setSavingSegmentEdit] = useState(false);

  // ---- import ----
  const [showImport, setShowImport] = useState(false);
  const [showScriptPrep, setShowScriptPrep] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [batchRendering, setBatchRendering] = useState(false);

  // ---- per-segment re-render ----
  const [renderingSegmentId, setRenderingSegmentId] = useState<number | null>(null);

  // ---- pronunciation editor panel ----
  const [showPronunciation, setShowPronunciation] = useState(false);

  // ---- cast board panel ----
  const [showCastBoard, setShowCastBoard] = useState(false);

  // ---- review / QC panel ----
  const [showReview, setShowReview] = useState(false);

  // ---- timeline review panel ----
  const [showTimeline, setShowTimeline] = useState(false);

  // ---- export dialog ----
  const [showExport, setShowExport] = useState(false);

  // ---- project settings panel ----
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [settingsVoice, setSettingsVoice] = useState('');
  const [settingsLang, setSettingsLang] = useState('');
  const [settingsProvider, setSettingsProvider] = useState('');
  const [settingsModel, setSettingsModel] = useState('');
  const [settingsFallbackProvider, setSettingsFallbackProvider] = useState('');
  const [settingsFallbackModel, setSettingsFallbackModel] = useState('');
  const [settingsStyleId, setSettingsStyleId] = useState<number | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // ---------------------------------------------------------------------------

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const segmentsBySection = useMemo(() => groupBySection(segments), [segments]);

  const draftCount = useMemo(
    () => segments.filter(s => s.status === 'draft').length,
    [segments],
  );

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadProjectContents = useCallback(async (projectId: number) => {
    setLoadingProjectData(true);
    setError(null);
    try {
      const [nextSections, nextSegments, nextCastProfiles, nextStyles] = await Promise.all([
        listProjectSections(projectId),
        listProjectSegments(projectId),
        listProjectCast(projectId).catch(() => [] as CastProfile[]),
        listStyles(projectId).catch(() => [] as PerformanceStyle[]),
      ]);
      if (!isMounted.current) return;
      setSections(nextSections);
      setSegments(nextSegments);
      setCastProfiles(nextCastProfiles);
      setStyles(nextStyles);
      setExpandedSections(new Set(nextSections.map(s => s.id)));
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err?.message ?? 'Failed to load project contents.');
    } finally {
      if (isMounted.current) setLoadingProjectData(false);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError(null);
    try {
      const data = await listProjects();
      if (!isMounted.current) return;
      setProjects(data);
      return data;
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err?.message ?? 'Failed to load projects.');
    } finally {
      if (isMounted.current) setLoadingProjects(false);
    }
  }, []);

  // On mount: restore last_open_project_id from config, then load projects.
  useEffect(() => {
    let mounted = true;
    (async () => {
      let lastId: number | null = null;
      try {
        const cfg = await getConfig();
        const raw = cfg[CONFIG_KEYS.LAST_OPEN_PROJECT_ID];
        if (raw) {
          const parsed = parseInt(raw, 10);
          if (!Number.isNaN(parsed)) lastId = parsed;
        }
      } catch {
        // Config is non-critical; continue without it.
      }
      if (!mounted) return;

      setLoadingProjects(true);
      try {
        const data = await listProjects();
        if (!mounted) return;
        setProjects(data);
        const active = data.filter(p => p.status !== 'archived');
        const preferred = lastId ? data.find(p => p.id === lastId) : null;
        const chosen = preferred ?? active[0] ?? data[0] ?? null;
        setSelectedProjectId(chosen?.id ?? null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? 'Failed to load projects.');
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load project contents when selection changes.
  useEffect(() => {
    if (!selectedProjectId) {
      setSections([]);
      setSegments([]);
      return;
    }
    loadProjectContents(selectedProjectId);
  }, [selectedProjectId, loadProjectContents]);

  // Real-time segment status updates from WebSocket progress events.
  useEffect(() => {
    if (!selectedProjectId) return;
    const FINISHED = new Set(['complete', 'completed', 'done', 'failed', 'cancelled', 'canceled']);
    return subscribeToProgress((event: ProgressEvent) => {
      if (event.type !== 'batch_render') return;
      if (event.project_id !== String(selectedProjectId)) return;
      if (event.segment_id) {
        const segId = parseInt(event.segment_id, 10);
        if (!Number.isNaN(segId)) {
          setSegments(prev =>
            prev.map(s => s.id === segId ? { ...s, status: 'rendering' as SegmentStatus } : s)
          );
        }
      } else if (FINISHED.has((event.status ?? '').toLowerCase())) {
        // Batch finished — reload to get accurate final statuses for every segment.
        if (isMounted.current) loadProjectContents(selectedProjectId);
      }
    });
  }, [selectedProjectId, subscribeToProgress, loadProjectContents]);

  // ---------------------------------------------------------------------------
  // Project selection with config persistence
  // ---------------------------------------------------------------------------

  const selectProject = useCallback((id: number) => {
    setSelectedProjectId(id);
    setShowImport(false);
    setShowProjectSettings(false);
    setShowScriptPrep(false);
    setShowAddSection(false);
    setAddingToSectionId(null);
    setEditingSegmentId(null);
    setEditingSectionId(null);
    setMobileTab('script');
    updateConfig({ [CONFIG_KEYS.LAST_OPEN_PROJECT_ID]: String(id) }).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        title,
        kind: newKind,
        status: 'active',
        description: '',
        default_voice_name: initialVoiceName || undefined,
      });
      setProjects(prev => [project, ...prev]);
      selectProject(project.id);
      setNewTitle('');
      showToast('Project created', 'success');
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create project.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleArchiveProject = async () => {
    if (!selectedProject) return;
    setArchiving(true);
    setError(null);
    try {
      await archiveProject(selectedProject.id);
      await refreshProjects();
      setSelectedProjectId(null);
      showToast('Project archived', 'success');
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to archive project.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setArchiving(false);
    }
  };

  const handleSaveProjectSettings = async () => {
    if (!selectedProject) return;
    setSavingSettings(true);
    try {
      await updateProject(selectedProject.id, {
        ...selectedProject,
        default_voice_name: settingsVoice.trim() || undefined,
        default_language_code: settingsLang.trim() || undefined,
        default_provider: settingsProvider.trim() || undefined,
        default_model: settingsModel.trim() || undefined,
        fallback_provider: settingsFallbackProvider.trim() || undefined,
        fallback_model: settingsFallbackModel.trim() || undefined,
        default_style_id: settingsStyleId ?? undefined,
      });
      const updated = await listProjects();
      if (!isMounted.current) return;
      setProjects(updated);
      setShowProjectSettings(false);
      showToast('Project settings saved', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to save settings.', 'error');
    } finally {
      if (isMounted.current) setSavingSettings(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Section CRUD
  // ---------------------------------------------------------------------------

  const handleAddSection = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newSectionTitle.trim();
    if (!title || !selectedProjectId) return;
    setSavingSection(true);
    try {
      await createProjectSection(selectedProjectId, {
        title,
        kind: 'chapter',
        sort_order: sections.length,
      });
      await loadProjectContents(selectedProjectId);
      setNewSectionTitle('');
      setShowAddSection(false);
      showToast('Section added', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to add section.', 'error');
    } finally {
      setSavingSection(false);
    }
  };

  const handleSaveSectionEdit = async (section: ScriptSection) => {
    const title = editingSectionTitle.trim();
    if (!title || !selectedProjectId) return;
    setSavingSectionEdit(true);
    try {
      await updateProjectSection(selectedProjectId, section.id, { ...section, title, kind: editingSectionKind });
      await loadProjectContents(selectedProjectId);
      setEditingSectionId(null);
      showToast('Section updated', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to update section.', 'error');
    } finally {
      setSavingSectionEdit(false);
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (!selectedProjectId) return;
    try {
      await deleteProjectSection(selectedProjectId, sectionId);
      await loadProjectContents(selectedProjectId);
      showToast('Section deleted', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to delete section.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Segment CRUD
  // ---------------------------------------------------------------------------

  const handleAddSegment = async (event: React.FormEvent, sectionId: number | null) => {
    event.preventDefault();
    const text = newSegmentText.trim();
    if (!text || !selectedProjectId) return;
    setSavingSegment(true);
    try {
      const sectionSegments = segmentsBySection.get(sectionId) ?? [];
      await createProjectSegment(selectedProjectId, {
        script_text: text,
        section_id: sectionId ?? undefined,
        status: 'draft' as SegmentStatus,
        sort_order: sectionSegments.length,
      });
      await loadProjectContents(selectedProjectId);
      setNewSegmentText('');
      setAddingToSectionId(null);
      showToast('Segment added', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to add segment.', 'error');
    } finally {
      setSavingSegment(false);
    }
  };

  const handleSaveSegmentEdit = async (segment: ScriptSegment) => {
    const text = editingSegmentText.trim();
    if (!selectedProjectId) return;
    setSavingSegmentEdit(true);
    try {
      await updateProjectSegment(selectedProjectId, segment.id, {
        ...segment,
        script_text: text,
        speaker_label: editingSegmentSpeaker.trim() || undefined,
        voice_name: editingSegmentCastProfileId ? undefined : (editingSegmentVoice.trim() || undefined),
        cast_profile_id: editingSegmentCastProfileId ?? undefined,
        style_id: editingSegmentStyleId ?? undefined,
        provider: editingSegmentProvider.trim() || undefined,
        model: editingSegmentModel.trim() || undefined,
        fallback_provider: editingSegmentFallbackProvider.trim() || undefined,
        fallback_model: editingSegmentFallbackModel.trim() || undefined,
      });
      await loadProjectContents(selectedProjectId);
      setEditingSegmentId(null);
      showToast('Segment saved', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to save segment.', 'error');
    } finally {
      setSavingSegmentEdit(false);
    }
  };

  const handleDeleteSegment = async (segmentId: number) => {
    if (!selectedProjectId) return;
    try {
      await deleteProjectSegment(selectedProjectId, segmentId);
      await loadProjectContents(selectedProjectId);
      showToast('Segment deleted', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to delete segment.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = importText.trim();
    if (!text || !selectedProjectId) return;
    setImporting(true);
    try {
      const result = await importProjectText(selectedProjectId, text);
      await loadProjectContents(selectedProjectId);
      setImportText('');
      setShowImport(false);
      showToast(
        `Imported ${result.sections_created} section${result.sections_created !== 1 ? 's' : ''} and ${result.segments_created} segment${result.segments_created !== 1 ? 's' : ''}.`,
        'success',
      );
    } catch (err: any) {
      showToast(err?.message ?? 'Import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setImportText(text ?? '');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // ---------------------------------------------------------------------------
  // Section expand/collapse
  // ---------------------------------------------------------------------------

  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderSegmentRow = (segment: ScriptSegment) => {
    const isEditing = editingSegmentId === segment.id;
    return (
      <div
        key={segment.id}
        className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3"
      >
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              rows={4}
              value={editingSegmentText}
              onChange={e => setEditingSegmentText(e.target.value)}
              className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
            />
            {/* Metadata row: speaker label + voice/cast-profile assignment */}
            <div className="flex flex-wrap gap-2">
              <input
                value={editingSegmentSpeaker}
                onChange={e => setEditingSegmentSpeaker(e.target.value)}
                placeholder="Speaker label (optional)"
                className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              />
              <select
                value={
                  editingSegmentCastProfileId
                    ? `cast:${editingSegmentCastProfileId}`
                    : editingSegmentVoice
                      ? `voice:${editingSegmentVoice}`
                      : ''
                }
                onChange={e => {
                  const val = e.target.value;
                  if (val.startsWith('cast:')) {
                    const id = parseInt(val.slice(5), 10);
                    setEditingSegmentCastProfileId(id);
                    setEditingSegmentVoice('');
                    if (!editingSegmentSpeaker.trim()) {
                      const p = castProfiles.find(cp => cp.id === id);
                      if (p) setEditingSegmentSpeaker(p.name);
                    }
                  } else if (val.startsWith('voice:')) {
                    setEditingSegmentCastProfileId(null);
                    setEditingSegmentVoice(val.slice(6));
                  } else {
                    setEditingSegmentCastProfileId(null);
                    setEditingSegmentVoice('');
                  }
                }}
                className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              >
                <option value="">— No voice override —</option>
                {castProfiles.length > 0 && (
                  <optgroup label="Cast Profiles">
                    {castProfiles.map(p => (
                      <option key={`cast:${p.id}`} value={`cast:${p.id}`}>
                        {p.name}{p.voice_name ? ` (${p.voice_name})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Individual Voices">
                  {voices.map(v => (
                    <option key={`voice:${v.name}`} value={`voice:${v.name}`}>{v.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            {/* Style preset picker */}
            <StylePresetPicker
              styles={styles}
              value={editingSegmentStyleId}
              onChange={setEditingSegmentStyleId}
              projectId={selectedProjectId ?? undefined}
              onStyleCreated={s => setStyles(prev => [...prev, s])}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={editingSegmentProvider}
                onChange={e => setEditingSegmentProvider(e.target.value)}
                placeholder="Provider override"
                className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              />
              <input
                value={editingSegmentModel}
                onChange={e => setEditingSegmentModel(e.target.value)}
                placeholder="Model override"
                className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              />
              <input
                value={editingSegmentFallbackProvider}
                onChange={e => setEditingSegmentFallbackProvider(e.target.value)}
                placeholder="Fallback provider"
                className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              />
              <input
                value={editingSegmentFallbackModel}
                onChange={e => setEditingSegmentFallbackModel(e.target.value)}
                placeholder="Fallback model"
                className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingSegmentId(null)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <X size={12} /> Cancel
              </button>
              <button
                type="button"
                disabled={savingSegmentEdit}
                onClick={() => handleSaveSegmentEdit(segment)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
              >
                {savingSegmentEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{segment.script_text}</p>
              {(segment.speaker_label || segment.voice_name || segment.cast_profile_id || segment.style_id || segment.provider || segment.fallback_provider) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {segment.speaker_label && (
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {segment.speaker_label}
                    </span>
                  )}
                  {segment.cast_profile_id && (
                    <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-700 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                      ◈ {castProfiles.find(p => p.id === segment.cast_profile_id)?.name ?? `Profile #${segment.cast_profile_id}`}
                    </span>
                  )}
                  {segment.voice_name && !segment.cast_profile_id && (
                    <span className="rounded-full bg-[var(--accent-50)] dark:bg-zinc-900 border border-[var(--accent-100)] dark:border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-700)] dark:text-[var(--accent-300)]">
                      {segment.voice_name}
                    </span>
                  )}
                  {segment.provider && (
                    <span className="rounded-full bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-700 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                      {segment.provider}{segment.model ? ` / ${segment.model}` : ''}
                    </span>
                  )}
                  {segment.fallback_provider && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      fallback {segment.fallback_provider}{segment.fallback_model ? ` / ${segment.fallback_model}` : ''}
                    </span>
                  )}
                  {segment.style_id && (
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      ✦ {styles.find(s => s.id === segment.style_id)?.name ?? `Style #${segment.style_id}`}
                    </span>
                  )}
                </div>
              )}
              <SegmentTakeList
                projectId={selectedProjectId!}
                segment={segment}
                onTakesChanged={() => loadProjectContents(selectedProjectId!)}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(segment.status)}`}>
                {segment.status}
              </span>
              {/* Re-render button — only when a voice is available */}
              {(segment.voice_name || segment.cast_profile_id || selectedProject?.default_voice_name) && (
                <button
                  type="button"
                  title="Re-render segment"
                  disabled={renderingSegmentId === segment.id}
                  onClick={async () => {
                    if (!selectedProjectId) return;
                    setRenderingSegmentId(segment.id);
                    try {
                      await reRenderSegment(selectedProjectId, segment.id);
                      showToast('Segment rendered', 'success');
                      loadProjectContents(selectedProjectId);
                    } catch (err: any) {
                      showToast(err?.message ?? 'Render failed.', 'error');
                    } finally {
                      if (isMounted.current) setRenderingSegmentId(null);
                    }
                  }}
                  className="hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-[var(--accent-500)] transition-colors disabled:opacity-50"
                >
                  {renderingSegmentId === segment.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />}
                </button>
              )}
              <button
                type="button"
                title="Edit segment"
                onClick={() => {
                  setEditingSegmentId(segment.id);
                  setEditingSegmentText(segment.script_text);
                  setEditingSegmentSpeaker(segment.speaker_label ?? '');
                  setEditingSegmentCastProfileId(segment.cast_profile_id ?? null);
                  setEditingSegmentVoice(segment.cast_profile_id ? '' : (segment.voice_name ?? ''));
                  setEditingSegmentStyleId(segment.style_id ?? null);
                  setEditingSegmentProvider(segment.provider ?? '');
                  setEditingSegmentModel(segment.model ?? '');
                  setEditingSegmentFallbackProvider(segment.fallback_provider ?? '');
                  setEditingSegmentFallbackModel(segment.fallback_model ?? '');
                }}
                className="hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                title="Delete segment"
                onClick={() => handleDeleteSegment(segment.id)}
                className="hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAddSegmentForm = (sectionId: number | null) => {
    const addingKey = sectionId === null ? 'unsectioned' : sectionId;
    const isAdding = addingToSectionId === addingKey;
    if (!isAdding) {
      return (
        <button
          type="button"
          onClick={() => {
            setAddingToSectionId(addingKey);
            setNewSegmentText('');
          }}
          className="mt-2 w-full flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <Plus size={12} /> Add segment
        </button>
      );
    }
    return (
      <form
        onSubmit={e => handleAddSegment(e, sectionId)}
        className="mt-2 space-y-2"
      >
        <textarea
          autoFocus
          rows={3}
          value={newSegmentText}
          onChange={e => setNewSegmentText(e.target.value)}
          placeholder="Enter segment text..."
          className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setAddingToSectionId(null)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <X size={12} /> Cancel
          </button>
          <button
            type="submit"
            disabled={savingSegment || !newSegmentText.trim()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
          >
            {savingSegment ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add
          </button>
        </div>
      </form>
    );
  };

  const renderSection = (section: ScriptSection) => {
    const isExpanded = expandedSections.has(section.id);
    const sectionSegments = segmentsBySection.get(section.id) ?? [];
    const isEditingTitle = editingSectionId === section.id;

    return (
      <div key={section.id} className="group/section rounded-xl border border-zinc-200 dark:border-zinc-800">
        {/* Section header */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => toggleSection(section.id)}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            {isExpanded
              ? <ChevronDown size={14} className="shrink-0 text-zinc-400" />
              : <ChevronRight size={14} className="shrink-0 text-zinc-400" />}
            {isEditingTitle ? (
              <div className="flex min-w-0 flex-1 items-center gap-2" onClick={e => e.stopPropagation()}>
                <select
                  value={editingSectionKind}
                  onChange={e => setEditingSectionKind(e.target.value)}
                  className="h-7 shrink-0 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                >
                  <option value="chapter">Chapter</option>
                  <option value="scene">Scene</option>
                  <option value="folder">Folder</option>
                </select>
                <input
                  autoFocus
                  value={editingSectionTitle}
                  onChange={e => setEditingSectionTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSaveSectionEdit(section); }
                    if (e.key === 'Escape') setEditingSectionId(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-0.5 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                />
              </div>
            ) : (
              <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{section.title}</span>
            )}
            <span className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              {sectionSegments.length}
            </span>
          </button>

          {isEditingTitle ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={savingSectionEdit}
                onClick={() => handleSaveSectionEdit(section)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
              >
                {savingSectionEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </button>
              <button
                type="button"
                onClick={() => setEditingSectionId(null)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover/section:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                title="Rename section"
                onClick={() => {
                  setEditingSectionId(section.id);
                  setEditingSectionTitle(section.title);
                  setEditingSectionKind(section.kind ?? 'chapter');
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                title="Delete section"
                onClick={() => handleDeleteSection(section.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Section body */}
        {isExpanded && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 pb-3 pt-2 space-y-2">
            {sectionSegments.length === 0 && addingToSectionId !== section.id ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No segments yet.</p>
            ) : (
              sectionSegments.map(seg => renderSegmentRow(seg))
            )}
            {renderAddSegmentForm(section.id)}
          </div>
        )}
      </div>
    );
  };

  const renderMobileTabs = () => {
    if (!isPhone || !selectedProject) return null;
    return (
      <nav className="fixed inset-x-0 bottom-14 z-30 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur" aria-label="Project workspace tabs">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMobileTab(tab.id);
                if (tab.id === 'cast') {
                  setShowCastBoard(true);
                  setShowReview(false);
                } else if (tab.id === 'review') {
                  setShowReview(true);
                  setShowCastBoard(false);
                } else {
                  setShowCastBoard(false);
                  setShowReview(false);
                }
              }}
              className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                mobileTab === tab.id
                  ? 'text-[var(--accent-600)] dark:text-[var(--accent-300)]'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
              aria-current={mobileTab === tab.id ? 'page' : undefined}
            >
              {tab.id === 'jobs' && activeJobs.length > 0 ? <Loader2 size={15} className="animate-spin" /> : tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    );
  };

  const renderMobileJobsPanel = () => (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Jobs</h4>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{activeJobs.length} active</span>
      </div>
      <div className="space-y-2">
        {jobs.slice(0, 12).map(job => (
          <div key={job.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-white">{formatJobType(job.type)}</p>
              <span className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{job.status}</span>
            </div>
            {job.message && <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{job.message}</p>}
            <div className="mt-2 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent-500)]" style={{ width: `${Math.max(0, Math.min(100, job.percent || 0))}%` }} />
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No jobs yet.</p>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const unsectionedSegments = segmentsBySection.get(null) ?? [];

  return (
    <div className={`flex-1 overflow-hidden bg-white dark:bg-zinc-950 flex flex-col ${isPhone ? 'pb-28' : ''}`}>
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-50)] dark:bg-zinc-900 border border-[var(--accent-100)] dark:border-zinc-800 text-[var(--accent-600)] dark:text-[var(--accent-100)]">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-zinc-900 dark:text-white">Projects</h2>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {projects.length} saved production workspace{projects.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompactTool(prev => !prev)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <Wrench size={14} />
              <span className="hidden sm:inline">Script Reader</span>
            </button>
            <button
              type="button"
              onClick={() => refreshProjects()}
              disabled={loadingProjects}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
            >
              {loadingProjects ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main layout: sidebar + content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className={`min-h-0 border-b xl:border-b-0 xl:border-r border-zinc-200 dark:border-zinc-800 flex-col ${isPhone && mobileTab !== 'script' ? 'hidden' : 'flex'}`}>
          <form onSubmit={handleCreateProject} className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="New project title"
              className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
            />
            <div className="flex gap-2">
              <select
                value={newKind}
                onChange={e => setNewKind(e.target.value as ProjectKind)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              >
                {PROJECT_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] text-white hover:bg-zinc-800 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                aria-label="Create project"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>
          </form>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
            {loadingProjects ? (
              <div className="flex items-center justify-center py-10 text-zinc-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No projects yet.</p>
            ) : (
              projects.map(project => {
                const active = project.id === selectedProjectId;
                return (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{project.title}</p>
                        <p className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">{formatKind(project.kind)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                        {project.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Content pane */}
        <main className={`min-h-0 overflow-y-auto ${isPhone && mobileTab === 'script' ? 'border-t border-zinc-200 dark:border-zinc-800' : ''}`}>
          {error && (
            <div className="m-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {isPhone && mobileTab === 'jobs' ? (
            renderMobileJobsPanel()
          ) : showCompactTool ? (
            <div className="min-h-full">
              <ScriptReaderModal
                voices={voices}
                customPresets={customPresets}
                initialVoiceName={initialVoiceName}
                onClose={() => setShowCompactTool(false)}
                inline
              />
            </div>
          ) : selectedProject ? (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Project header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {formatKind(selectedProject.kind)}
                    </span>
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {selectedProject.status}
                    </span>
                  </div>
                  <h3 className="text-2xl font-serif font-medium text-zinc-900 dark:text-white">{selectedProject.title}</h3>
                  {selectedProject.default_voice_name && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Default voice: {selectedProject.default_voice_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsVoice(selectedProject.default_voice_name ?? '');
                      setSettingsLang(selectedProject.default_language_code ?? '');
                      setSettingsProvider(selectedProject.default_provider ?? '');
                      setSettingsModel(selectedProject.default_model ?? '');
                      setSettingsFallbackProvider(selectedProject.fallback_provider ?? '');
                      setSettingsFallbackModel(selectedProject.fallback_model ?? '');
                      setSettingsStyleId(selectedProject.default_style_id ?? null);
                      setShowProjectSettings(prev => !prev);
                      if (showPronunciation) setShowPronunciation(false);
                      if (showTimeline) setShowTimeline(false);
                      if (showCastBoard) setShowCastBoard(false);
                    }}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      showProjectSettings
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <Settings size={14} />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPronunciation(prev => !prev); if (showProjectSettings) setShowProjectSettings(false); if (showTimeline) setShowTimeline(false); if (showCastBoard) setShowCastBoard(false); }}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      showPronunciation
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                    title="Pronunciation dictionaries"
                  >
                    <BookOpen size={14} />
                    Dicts
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowTimeline(prev => !prev); if (showProjectSettings) setShowProjectSettings(false); if (showPronunciation) setShowPronunciation(false); if (showCastBoard) setShowCastBoard(false); if (showReview) setShowReview(false); }}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      showTimeline
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                    title="Timeline review and export"
                  >
                    <Film size={14} />
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCastBoard(prev => !prev); if (showProjectSettings) setShowProjectSettings(false); if (showPronunciation) setShowPronunciation(false); if (showTimeline) setShowTimeline(false); if (showReview) setShowReview(false); }}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      showCastBoard
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                    title="Cast bible"
                  >
                    <Users size={14} />
                    Cast
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReview(prev => !prev); if (showProjectSettings) setShowProjectSettings(false); if (showPronunciation) setShowPronunciation(false); if (showTimeline) setShowTimeline(false); if (showCastBoard) setShowCastBoard(false); }}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      showReview
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                    title="Review & QC"
                  >
                    <ClipboardCheck size={14} />
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExport(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    title="Export deliverable ZIP"
                  >
                    <Package size={14} />
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScriptPrep(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    title="AI script prep"
                  >
                    <Sparkles size={14} />
                    Prep
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowImport(prev => !prev); setImportText(''); }}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      showImport
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <Upload size={14} />
                    Import text
                  </button>
                  <button
                    type="button"
                    disabled={batchRendering}
                    onClick={async () => {
                      if (!selectedProject) return;
                      setBatchRendering(true);
                      try {
                        const res = await batchRenderProject(selectedProject.id);
                        showToast(`Rendering ${res.segment_count} segment${res.segment_count === 1 ? '' : 's'} (job ${res.job_id})`, 'success');
                      } catch (err: any) {
                        showToast(err?.message ?? 'Batch render failed.', 'error');
                      } finally {
                        setBatchRendering(false);
                      }
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                  >
                    {batchRendering ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Render all
                  </button>
                  <button
                    type="button"
                    onClick={handleArchiveProject}
                    disabled={archiving || selectedProject.status === 'archived'}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                  >
                    {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                    Archive
                  </button>
                </div>
              </div>

              {/* Project settings panel */}
              {showProjectSettings && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Project defaults</p>
                    <button
                      type="button"
                      onClick={() => setShowProjectSettings(false)}
                      className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Default voice
                      </label>
                      <select
                        value={settingsVoice}
                        onChange={e => setSettingsVoice(e.target.value)}
                        className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                      >
                        <option value="">— None —</option>
                        {voices.map(v => (
                          <option key={v.name} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Language code
                      </label>
                      <input
                        value={settingsLang}
                        onChange={e => setSettingsLang(e.target.value)}
                        placeholder="e.g. en-US"
                        className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Provider
                      </label>
                      <input
                        value={settingsProvider}
                        onChange={e => setSettingsProvider(e.target.value)}
                        placeholder="e.g. google"
                        className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Model
                      </label>
                      <input
                        value={settingsModel}
                        onChange={e => setSettingsModel(e.target.value)}
                        placeholder="e.g. gemini-2.5-pro-preview-tts"
                        className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Fallback provider
                      </label>
                      <input
                        value={settingsFallbackProvider}
                        onChange={e => setSettingsFallbackProvider(e.target.value)}
                        placeholder="e.g. gemini"
                        className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Fallback model
                      </label>
                      <input
                        value={settingsFallbackModel}
                        onChange={e => setSettingsFallbackModel(e.target.value)}
                        placeholder="e.g. tts-1"
                        className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Default performance style
                      </label>
                      <StylePresetPicker
                        styles={styles}
                        value={settingsStyleId}
                        onChange={setSettingsStyleId}
                        projectId={selectedProjectId ?? undefined}
                        onStyleCreated={s => setStyles(prev => [...prev, s])}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowProjectSettings(false)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={handleSaveProjectSettings}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-4 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                    >
                      {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Save settings
                    </button>
                  </div>
                </div>
              )}

              {/* Pronunciation editor panel */}
              {showPronunciation && selectedProject && (
                <PronunciationEditor
                  projectId={selectedProject.id}
                  onClose={() => setShowPronunciation(false)}
                />
              )}

              {/* Timeline review panel */}
              {showTimeline && selectedProject && (
                <TimelineReview
                  projectId={selectedProject.id}
                  sections={sections}
                  segments={segments}
                />
              )}

              {/* Cast bible panel */}
              {showCastBoard && selectedProject && (
                <CastBoard
                  projectId={selectedProject.id}
                  voices={voices}
                  onClose={() => setShowCastBoard(false)}
                />
              )}

              {/* Review / QC panel */}
              {showReview && selectedProject && (
                <ReviewMode
                  project={selectedProject}
                  onClose={() => setShowReview(false)}
                  isDarkMode={document.documentElement.classList.contains('dark')}
                />
              )}

              {/* Export dialog */}
              {showExport && selectedProject && (
                <ExportDialog
                  projectId={selectedProject.id}
                  onClose={() => setShowExport(false)}
                />
              )}

              {showScriptPrep && selectedProject && (
                <ScriptPrepDialog
                  projectId={selectedProject.id}
                  projectKind={selectedProject.kind}
                  onClose={() => setShowScriptPrep(false)}
                  onApplied={async summary => {
                    await loadProjectContents(selectedProject.id);
                    showToast(
                      `Applied ${summary.sections_created} section${summary.sections_created === 1 ? '' : 's'} and ${summary.segments_created} segment${summary.segments_created === 1 ? '' : 's'}.`,
                      'success',
                    );
                  }}
                />
              )}

              {/* Import panel */}
              {showImport && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Import from text</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        Paste Markdown or plain text. Lines starting with{' '}
                        <code className="rounded bg-zinc-200 dark:bg-zinc-800 px-1 text-[11px]">#</code>{' '}
                        become sections; paragraphs become segments.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowImport(false)}
                      className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
                    <FileText size={13} />
                    Load from file (.txt / .md)
                    <input
                      type="file"
                      accept=".txt,.md,.markdown"
                      className="sr-only"
                      onChange={handleFileImport}
                    />
                  </label>

                  <form onSubmit={handleImport} className="space-y-2">
                    <textarea
                      rows={10}
                      value={importText}
                      onChange={e => setImportText(e.target.value)}
                      placeholder={"# Chapter One\n\nThe story begins here...\n\n# Chapter Two\n\nThe adventure continues..."}
                      className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowImport(false); setImportText(''); }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={importing || !importText.trim()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-4 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                      >
                        {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        Import
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <Layers size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Sections</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{sections.length}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <Rows3 size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Segments</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{segments.length}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <FileText size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Draft</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{draftCount}</p>
                </div>
              </div>

              {/* Sections and segments */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Sections &amp; Segments</h4>
                  {loadingProjectData && <Loader2 size={16} className="animate-spin text-zinc-400" />}
                </div>

                <div className="space-y-2">
                  {sections.map(section => renderSection(section))}
                </div>

                {/* Unsectioned segments */}
                {(unsectionedSegments.length > 0 || addingToSectionId === 'unsectioned') && (
                  <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Unsectioned</p>
                    {unsectionedSegments.map(seg => renderSegmentRow(seg))}
                    {renderAddSegmentForm(null)}
                  </div>
                )}

                {/* Add section / add unsectioned segment buttons */}
                <div className="flex flex-wrap gap-2">
                  {showAddSection ? (
                    <form onSubmit={handleAddSection} className="flex w-full gap-2">
                      <input
                        autoFocus
                        value={newSectionTitle}
                        onChange={e => setNewSectionTitle(e.target.value)}
                        placeholder="Section title"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddSection(false)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="submit"
                        disabled={savingSection || !newSectionTitle.trim()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                      >
                        {savingSection ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowAddSection(true); setNewSectionTitle(''); }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    >
                      <Plus size={12} /> Add section
                    </button>
                  )}
                  {!showAddSection && unsectionedSegments.length === 0 && addingToSectionId !== 'unsectioned' && (
                    <button
                      type="button"
                      onClick={() => { setAddingToSectionId('unsectioned'); setNewSegmentText(''); }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    >
                      <Plus size={12} /> Add segment
                    </button>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center p-6 text-center">
              <div>
                <BookOpen size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Create a project to start.</p>
              </div>
            </div>
          )}
        </main>
      </div>
      {renderMobileTabs()}
    </div>
  );
};

export default ProjectWorkspace;
