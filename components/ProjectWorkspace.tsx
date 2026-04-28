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
  ArchiveRestore,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Film,
  FileText,
  Layers,
  Loader2,
  MoreHorizontal,
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
import StylePresetPicker from './StylePresetPicker';
import ExportDialog from './ExportDialog';
import { useResponsiveMode } from './useResponsiveMode';
import ProjectStatsBar from './ProjectStatsBar';
import ProjectSettingsPanel from './ProjectSettingsPanel';
import ProjectImportPanel from './ProjectImportPanel';
import SectionBlock from './SectionBlock';
import SegmentRow from './SegmentRow';

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
type WorkspaceTab = 'script' | 'cast' | 'review' | 'timeline' | 'export';

const MOBILE_TABS: { id: WorkspaceMobileTab; label: string; icon: React.ReactNode }[] = [
  { id: 'script', label: 'Script', icon: <FileText size={15} /> },
  { id: 'cast', label: 'Cast', icon: <Users size={15} /> },
  { id: 'takes', label: 'Takes', icon: <Rows3 size={15} /> },
  { id: 'jobs', label: 'Jobs', icon: <Loader2 size={15} /> },
  { id: 'review', label: 'Review', icon: <ClipboardCheck size={15} /> },
];

const WORKSPACE_TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'script', label: 'Script', icon: <FileText size={13} /> },
  { id: 'cast', label: 'Cast', icon: <Users size={13} /> },
  { id: 'review', label: 'Review', icon: <ClipboardCheck size={13} /> },
  { id: 'timeline', label: 'Timeline', icon: <Film size={13} /> },
  { id: 'export', label: 'Export', icon: <Package size={13} /> },
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

/** Convert project kind identifiers into display text. */
function formatKind(kind: string): string {
  return PROJECT_KINDS.find(item => item.value === kind)?.label ?? kind.replace(/_/g, ' ');
}

/** Return badge color classes for segment/project status values. */
function statusBadge(status: string): string {
  return STATUS_BADGE[status] ?? STATUS_BADGE.draft;
}

function workspaceTabId(tab: WorkspaceTab): string {
  return `project-tab-${tab}`;
}

function workspacePanelId(tab: WorkspaceTab): string {
  return `project-panel-${tab}`;
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
  const [segmentEditState, setSegmentEditState] = useState({
    text: '',
    speaker: '',
    voice: '',
    castProfileId: null as number | null,
    styleId: null as number | null,
    provider: '',
    model: '',
    fallbackProvider: '',
    fallbackModel: '',
  });
  const [savingSegmentEdit, setSavingSegmentEdit] = useState(false);

  const patchSegmentEditState = (patch: Partial<typeof segmentEditState>) =>
    setSegmentEditState(prev => ({ ...prev, ...patch }));

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

  // ---- workspace content tab (Script / Cast / Review / Timeline / Export) ----
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('script');
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // ---- sidebar: archived visibility + per-project context menu ----
  const [showArchived, setShowArchived] = useState(false);
  const [contextMenuProjectId, setContextMenuProjectId] = useState<number | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

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

  const renderedCount = useMemo(
    () => segments.filter(s => s.status === 'rendered' || s.status === 'approved').length,
    [segments],
  );

  const approvedCount = useMemo(
    () => segments.filter(s => s.status === 'approved').length,
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

  // Dismiss project context menu on outside click.
  useEffect(() => {
    if (contextMenuProjectId === null) return;
    const handler = (e: MouseEvent) => {
      // Don't dismiss if the click was on the ⋯ button or inside the menu.
      const target = e.target as HTMLElement;
      if (target.closest('[role="menu"]') || target.closest('[aria-label="Project options"]')) return;
      setContextMenuProjectId(null);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenuProjectId]);

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
    setActiveWorkspaceTab('script');
    setShowOverflowMenu(false);
    setContextMenuProjectId(null);
    setRenamingProjectId(null);
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

  const handleUnarchiveProject = async (project: ScriptProject) => {
    try {
      await updateProject(project.id, { ...project, status: 'active' });
      await refreshProjects();
      showToast('Project unarchived', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to unarchive project.', 'error');
    }
  };

  const handleSaveRename = async (project: ScriptProject) => {
    const title = renameValue.trim();
    if (!title) return;
    setSavingRename(true);
    try {
      await updateProject(project.id, { ...project, title });
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, title } : p));
      setRenamingProjectId(null);
      showToast('Project renamed', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to rename project.', 'error');
    } finally {
      setSavingRename(false);
    }
  };

  const handleArchiveFromMenu = async (project: ScriptProject) => {
    setContextMenuProjectId(null);
    setArchiving(true);
    try {
      await archiveProject(project.id);
      await refreshProjects();
      if (selectedProjectId === project.id) setSelectedProjectId(null);
      showToast('Project archived', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to archive project.', 'error');
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
      const { id } = await createProjectSection(selectedProjectId, {
        title,
        kind: 'chapter',
        sort_order: sections.length,
      });
      // Optimistic update: immediately add to local state so stats + list update instantly
      const now = new Date().toISOString();
      const newSection: ScriptSection = {
        id,
        project_id: selectedProjectId,
        title,
        kind: 'chapter',
        sort_order: sections.length,
        created_at: now,
        updated_at: now,
      };
      setSections(prev => [...prev, newSection]);
      setExpandedSections(prev => { const n = new Set(prev); n.add(id); return n; });
      setNewSectionTitle('');
      setShowAddSection(false);
      showToast('Section added', 'success');
      // Background sync to pick up any server-side defaults
      loadProjectContents(selectedProjectId).catch(() => {});
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
      const { id } = await createProjectSegment(selectedProjectId, {
        script_text: text,
        section_id: sectionId ?? undefined,
        status: 'draft' as SegmentStatus,
        sort_order: sectionSegments.length,
      });
      // Optimistic update: immediately add to local state so stats update instantly
      const now = new Date().toISOString();
      const newSegment: ScriptSegment = {
        id,
        project_id: selectedProjectId,
        section_id: sectionId ?? undefined,
        title: '',
        script_text: text,
        status: 'draft' as SegmentStatus,
        content_hash: '',
        sort_order: sectionSegments.length,
        created_at: now,
        updated_at: now,
      };
      setSegments(prev => [...prev, newSegment]);
      setNewSegmentText('');
      setAddingToSectionId(null);
      showToast('Segment added', 'success');
      // Background sync to pick up server-side fields (content_hash, etc.)
      loadProjectContents(selectedProjectId).catch(() => {});
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to add segment.', 'error');
    } finally {
      setSavingSegment(false);
    }
  };

  const handleSaveSegmentEdit = async (segment: ScriptSegment) => {
    if (!selectedProjectId) return;
    const { text, speaker, voice, castProfileId, styleId, provider, model, fallbackProvider, fallbackModel } = segmentEditState;
    setSavingSegmentEdit(true);
    try {
      await updateProjectSegment(selectedProjectId, segment.id, {
        ...segment,
        script_text: text.trim(),
        speaker_label: speaker.trim() || undefined,
        voice_name: castProfileId ? undefined : (voice.trim() || undefined),
        cast_profile_id: castProfileId ?? undefined,
        style_id: styleId ?? undefined,
        provider: provider.trim() || undefined,
        model: model.trim() || undefined,
        fallback_provider: fallbackProvider.trim() || undefined,
        fallback_model: fallbackModel.trim() || undefined,
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
  // Segment edit start helper
  // ---------------------------------------------------------------------------

  const handleEditSegmentStart = (segment: ScriptSegment) => {
    setEditingSegmentId(segment.id);
    setSegmentEditState({
      text: segment.script_text,
      speaker: segment.speaker_label ?? '',
      castProfileId: segment.cast_profile_id ?? null,
      voice: segment.cast_profile_id ? '' : (segment.voice_name ?? ''),
      styleId: segment.style_id ?? null,
      provider: segment.provider ?? '',
      model: segment.model ?? '',
      fallbackProvider: segment.fallback_provider ?? '',
      fallbackModel: segment.fallback_model ?? '',
    });
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
                  setActiveWorkspaceTab('cast');
                } else if (tab.id === 'review') {
                  setActiveWorkspaceTab('review');
                } else {
                  setActiveWorkspaceTab('script');
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
  const showProjectSidebar = !isPhone || (mobileTab === 'script' && activeWorkspaceTab === 'script');

  return (
    <div
      className="flex-1 overflow-hidden bg-white dark:bg-zinc-950 flex flex-col"
      style={isPhone ? { paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' } : undefined}
    >
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
              <span className="hidden sm:inline">Quick Script</span>
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
        <aside className={`min-h-0 border-b xl:border-b-0 xl:border-r border-zinc-200 dark:border-zinc-800 flex-col ${showProjectSidebar ? 'flex' : 'hidden'}`}>
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

          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1">
            {loadingProjects ? (
              <div className="flex items-center justify-center py-10 text-zinc-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : projects.filter(p => p.status !== 'archived').length === 0 && projects.filter(p => p.status === 'archived').length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No projects yet.</p>
            ) : (
              <>
                {projects.filter(p => p.status !== 'archived').map(project => {
                  const active = project.id === selectedProjectId;
                  const isRenaming = renamingProjectId === project.id;
                  const hasMenu = contextMenuProjectId === project.id;
                  const segCount = active ? segments.length : null;
                  return (
                    <div key={project.id} className="relative group">
                      <div
                        className={`rounded-lg border transition-colors ${
                          active
                            ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                      >
                        {isRenaming ? (
                          <form
                            onSubmit={e => { e.preventDefault(); handleSaveRename(project); }}
                            className="p-3"
                          >
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Escape') setRenamingProjectId(null); }}
                              className="w-full rounded border border-[var(--accent-400)] bg-white dark:bg-zinc-900 px-2 py-0.5 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent-400)]"
                              disabled={savingRename}
                            />
                            <p className="mt-1 text-[10px] text-zinc-400">Enter to save · Esc to cancel</p>
                          </form>
                        ) : (
                          <div className="flex items-start gap-1">
                            <button
                              onClick={() => { setContextMenuProjectId(null); selectProject(project.id); }}
                              className="min-w-0 flex-1 p-3 text-left"
                              aria-current={active ? 'page' : undefined}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{project.title}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{formatKind(project.kind)}</span>
                                    {segCount !== null && segCount > 0 && (
                                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                        {segCount} seg
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                            <button
                              aria-label="Project options"
                              onClick={e => { e.stopPropagation(); setContextMenuProjectId(hasMenu ? null : project.id); }}
                              className={`mt-2 mr-1.5 shrink-0 rounded p-1 transition-colors ${
                                hasMenu
                                  ? 'text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 focus:opacity-100'
                              }`}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      {hasMenu && (
                        <div
                          className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1"
                          role="menu"
                        >
                          <button
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            onClick={() => { setContextMenuProjectId(null); setRenamingProjectId(project.id); setRenameValue(project.title); }}
                          >
                            <Pencil size={14} />
                            Rename
                          </button>
                          <button
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            onClick={() => handleArchiveFromMenu(project)}
                          >
                            <Archive size={14} />
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Archived projects toggle */}
                {(() => {
                  const archived = projects.filter(p => p.status === 'archived');
                  if (archived.length === 0) return null;
                  return (
                    <div className="pt-2">
                      <button
                        onClick={() => setShowArchived(prev => !prev)}
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <ChevronRight size={12} className={`transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                        {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
                      </button>
                      {showArchived && archived.map(project => {
                        const active = project.id === selectedProjectId;
                        const hasMenu = contextMenuProjectId === project.id;
                        return (
                          <div key={project.id} className="relative group mt-1">
                            <div
                              className={`flex items-start gap-1 w-full rounded-lg border transition-colors opacity-60 hover:opacity-100 ${
                                active
                                  ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
                                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                              }`}
                            >
                              <button
                                onClick={() => { setContextMenuProjectId(null); selectProject(project.id); }}
                                className="min-w-0 flex-1 p-3 text-left"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{project.title}</p>
                                    <p className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">{formatKind(project.kind)}</p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                    archived
                                  </span>
                                </div>
                              </button>
                              <button
                                aria-label="Project options"
                                onClick={e => { e.stopPropagation(); setContextMenuProjectId(hasMenu ? null : project.id); }}
                                className={`mt-2 mr-1.5 shrink-0 rounded p-1 transition-colors ${
                                  hasMenu
                                    ? 'text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 focus:opacity-100'
                                }`}
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </div>
                            {hasMenu && (
                              <div
                                className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1"
                                role="menu"
                              >
                                <button
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  onClick={() => { setContextMenuProjectId(null); handleUnarchiveProject(project); }}
                                >
                                  <ArchiveRestore size={14} />
                                  Unarchive
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </aside>

        {/* Content pane */}
        <main
          className={`min-h-0 overflow-y-auto ${isPhone ? 'pb-32' : ''} ${isPhone && mobileTab === 'script' ? 'border-t border-zinc-200 dark:border-zinc-800' : ''}`}
          style={isPhone ? { scrollPaddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' } : undefined}
        >
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
              {/* Project title */}
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

                {/* Production stage indicator */}
                {segments.length > 0 && (
                  <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-0.5">
                    {[
                      {
                        label: 'Scripted',
                        detail: `${segments.length} seg${segments.length !== 1 ? 's' : ''}`,
                        done: true,
                        active: false,
                      },
                      {
                        label: 'Cast',
                        detail: castProfiles.length > 0 ? `${castProfiles.length}` : null,
                        done: castProfiles.length > 0,
                        active: false,
                      },
                      {
                        label: 'Rendered',
                        detail: `${renderedCount}/${segments.length}`,
                        done: renderedCount === segments.length,
                        active: renderedCount > 0 && renderedCount < segments.length,
                      },
                      {
                        label: 'Reviewed',
                        detail: approvedCount > 0 ? `${approvedCount}/${renderedCount}` : null,
                        done: approvedCount > 0 && approvedCount === renderedCount,
                        active: approvedCount > 0 && approvedCount < renderedCount,
                      },
                      {
                        label: 'Export ready',
                        detail: null,
                        done: draftCount === 0 && segments.length > 0,
                        active: false,
                      },
                    ].map((stage, i, arr) => (
                      <React.Fragment key={stage.label}>
                        {i > 0 && (
                          <ChevronRight size={10} className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                        )}
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                            stage.done
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : stage.active
                              ? 'bg-[var(--accent-100)] dark:bg-[var(--accent-900)]/40 text-[var(--accent-700)] dark:text-[var(--accent-300)]'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                          }`}
                        >
                          {stage.done && <Check size={8} aria-hidden="true" />}
                          {stage.label}
                          {stage.detail && (
                            <span className="opacity-60">{stage.detail}</span>
                          )}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* Content tab bar */}
              <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <nav className="flex -mb-px" role="tablist" aria-label="Project workspace">
                    {WORKSPACE_TABS.map(tab => (
                      <button
                        key={tab.id}
                        id={workspaceTabId(tab.id)}
                        type="button"
                        role="tab"
                        aria-selected={activeWorkspaceTab === tab.id}
                        aria-controls={workspacePanelId(tab.id)}
                        tabIndex={activeWorkspaceTab === tab.id ? 0 : -1}
                        onClick={() => setActiveWorkspaceTab(tab.id)}
                        className={`inline-flex h-9 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold transition-colors ${
                          activeWorkspaceTab === tab.id
                            ? 'border-[var(--accent-500)] text-[var(--accent-700)] dark:text-[var(--accent-300)]'
                            : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                  <div className="flex items-center gap-1.5 pb-1">
                    {activeWorkspaceTab === 'script' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowScriptPrep(true)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                          title="AI script prep"
                        >
                          <Sparkles size={13} />
                          <span className="hidden sm:inline">Prep</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowImport(prev => !prev); setImportText(''); }}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                            showImport
                              ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <Upload size={13} />
                          <span className="hidden sm:inline">Import</span>
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
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                        >
                          {batchRendering ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                          <span className="hidden sm:inline">Render all</span>
                        </button>
                      </>
                    )}
                    {/* Overflow menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowOverflowMenu(prev => !prev)}
                        aria-label="More actions"
                        aria-haspopup="true"
                        aria-expanded={showOverflowMenu}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      {showOverflowMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowOverflowMenu(false)} />
                          <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg py-1">
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
                                setShowPronunciation(false);
                                setActiveWorkspaceTab('script');
                                setShowOverflowMenu(false);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                                showProjectSettings
                                  ? 'text-[var(--accent-700)] dark:text-[var(--accent-300)] bg-[var(--accent-50)] dark:bg-zinc-900'
                                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                              }`}
                            >
                              <Settings size={13} /> Project Settings
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPronunciation(prev => !prev);
                                setShowProjectSettings(false);
                                setActiveWorkspaceTab('script');
                                setShowOverflowMenu(false);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                                showPronunciation
                                  ? 'text-[var(--accent-700)] dark:text-[var(--accent-300)] bg-[var(--accent-50)] dark:bg-zinc-900'
                                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                              }`}
                            >
                              <BookOpen size={13} /> Dictionaries
                            </button>
                            <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                            <button
                              type="button"
                              onClick={() => { setShowOverflowMenu(false); handleArchiveProject(); }}
                              disabled={archiving || selectedProject.status === 'archived'}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                            >
                              {archiving ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
                              Archive Project
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <section
                id={workspacePanelId(activeWorkspaceTab)}
                role="tabpanel"
                aria-labelledby={workspaceTabId(activeWorkspaceTab)}
                className="focus:outline-none"
              >
                {/* ── Script tab ─────────────────────────────────────── */}
                {activeWorkspaceTab === 'script' && (
                  <>
                  {/* Project settings panel */}
                  {showProjectSettings && selectedProject && (
                    <ProjectSettingsPanel
                      selectedProject={selectedProject}
                      voices={voices}
                      styles={styles}
                      settingsVoice={settingsVoice}
                      settingsLang={settingsLang}
                      settingsProvider={settingsProvider}
                      settingsModel={settingsModel}
                      settingsFallbackProvider={settingsFallbackProvider}
                      settingsFallbackModel={settingsFallbackModel}
                      settingsStyleId={settingsStyleId}
                      savingSettings={savingSettings}
                      onChangeVoice={setSettingsVoice}
                      onChangeLang={setSettingsLang}
                      onChangeProvider={setSettingsProvider}
                      onChangeModel={setSettingsModel}
                      onChangeFallbackProvider={setSettingsFallbackProvider}
                      onChangeFallbackModel={setSettingsFallbackModel}
                      onChangeStyleId={setSettingsStyleId}
                      onStyleCreated={s => setStyles(prev => [...prev, s])}
                      onSave={handleSaveProjectSettings}
                      onClose={() => setShowProjectSettings(false)}
                    />
                  )}

                  {/* Pronunciation editor panel */}
                  {showPronunciation && selectedProject && (
                    <PronunciationEditor
                      projectId={selectedProject.id}
                      onClose={() => setShowPronunciation(false)}
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
                    <ProjectImportPanel
                      importText={importText}
                      importing={importing}
                      onChangeText={setImportText}
                      onSubmit={handleImport}
                      onFileImport={handleFileImport}
                      onClose={() => { setShowImport(false); setImportText(''); }}
                    />
                  )}

                  {/* Stats */}
                  <ProjectStatsBar
                    sectionCount={sections.length}
                    segmentCount={segments.length}
                    draftCount={draftCount}
                  />

                  {/* Sections and segments */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Sections &amp; Segments</h4>
                      {loadingProjectData && <Loader2 size={16} className="animate-spin text-zinc-400" />}
                    </div>

                    <div className="space-y-2">
                      {sections.map(section => (
                        <SectionBlock
                          key={section.id}
                          section={section}
                          sectionSegments={segmentsBySection.get(section.id) ?? []}
                          projectId={selectedProjectId!}
                          isExpanded={expandedSections.has(section.id)}
                          editingSectionId={editingSectionId}
                          editingSectionTitle={editingSectionTitle}
                          editingSectionKind={editingSectionKind}
                          savingSectionEdit={savingSectionEdit}
                          addingToSectionId={addingToSectionId}
                          newSegmentText={newSegmentText}
                          savingSegment={savingSegment}
                          editingSegmentId={editingSegmentId}
                          editState={segmentEditState}
                          savingSegmentEdit={savingSegmentEdit}
                          renderingSegmentId={renderingSegmentId}
                          castProfiles={castProfiles}
                          voices={voices}
                          styles={styles}
                          statusBadge={statusBadge}
                          defaultVoiceName={selectedProject?.default_voice_name}
                          onToggle={id => setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                          onEditSection={s => { setEditingSectionId(s.id); setEditingSectionTitle(s.title); setEditingSectionKind(s.kind ?? 'chapter'); }}
                          onCancelSectionEdit={() => setEditingSectionId(null)}
                          onSaveSectionEdit={handleSaveSectionEdit}
                          onDeleteSection={handleDeleteSection}
                          onSectionTitleChange={setEditingSectionTitle}
                          onSectionKindChange={setEditingSectionKind}
                          onSetAddingToSection={setAddingToSectionId}
                          onNewSegmentTextChange={setNewSegmentText}
                          onAddSegment={handleAddSegment}
                          onEditSegment={handleEditSegmentStart}
                          onCancelSegmentEdit={() => setEditingSegmentId(null)}
                          onSaveSegmentEdit={handleSaveSegmentEdit}
                          onDeleteSegment={handleDeleteSegment}
                          onReRenderSegment={async (seg) => {
                            if (!selectedProjectId) return;
                            setRenderingSegmentId(seg.id);
                            try {
                              await reRenderSegment(selectedProjectId, seg.id);
                              showToast('Segment rendered', 'success');
                              loadProjectContents(selectedProjectId);
                            } catch (err: any) {
                              showToast(err?.message ?? 'Render failed.', 'error');
                            } finally {
                              if (isMounted.current) setRenderingSegmentId(null);
                            }
                          }}
                          onTakesChanged={() => loadProjectContents(selectedProjectId!)}
                          onSegmentEditStateChange={patchSegmentEditState}
                          onStyleCreated={s => setStyles(prev => [...prev, s])}
                        />
                      ))}
                    </div>

                    {/* Unsectioned segments */}
                    {(unsectionedSegments.length > 0 || addingToSectionId === 'unsectioned') && (
                      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Unsectioned</p>
                        {unsectionedSegments.map(seg => (
                          <SegmentRow
                            key={seg.id}
                            segment={seg}
                            projectId={selectedProjectId!}
                            isEditing={editingSegmentId === seg.id}
                            editState={segmentEditState}
                            savingEdit={savingSegmentEdit}
                            renderingId={renderingSegmentId}
                            castProfiles={castProfiles}
                            voices={voices}
                            styles={styles}
                            statusBadge={statusBadge}
                            defaultVoiceName={selectedProject?.default_voice_name}
                            onEdit={handleEditSegmentStart}
                            onCancelEdit={() => setEditingSegmentId(null)}
                            onSaveEdit={handleSaveSegmentEdit}
                            onDelete={handleDeleteSegment}
                            onReRender={async (s) => {
                              if (!selectedProjectId) return;
                              setRenderingSegmentId(s.id);
                              try {
                                await reRenderSegment(selectedProjectId, s.id);
                                showToast('Segment rendered', 'success');
                                loadProjectContents(selectedProjectId);
                              } catch (err: any) {
                                showToast(err?.message ?? 'Render failed.', 'error');
                              } finally {
                                if (isMounted.current) setRenderingSegmentId(null);
                              }
                            }}
                            onTakesChanged={() => loadProjectContents(selectedProjectId!)}
                            onEditStateChange={patchSegmentEditState}
                            onStyleCreated={s => setStyles(prev => [...prev, s])}
                          />
                        ))}
                        {/* Add unsectioned segment */}
                        {addingToSectionId === 'unsectioned' ? (
                          <form onSubmit={e => handleAddSegment(e, null)} className="mt-2 space-y-2">
                            <textarea
                              autoFocus rows={3} value={newSegmentText}
                              onChange={e => setNewSegmentText(e.target.value)}
                              placeholder="Enter segment text..."
                              className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                            />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setAddingToSectionId(null)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                                Cancel
                              </button>
                              <button type="submit" disabled={savingSegment || !newSegmentText.trim()}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50">
                                {savingSegment ? <Loader2 size={12} className="animate-spin" /> : null} Add
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button type="button"
                            onClick={() => { setAddingToSectionId('unsectioned'); setNewSegmentText(''); }}
                            className="w-full flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                            <Plus size={12} /> Add segment
                          </button>
                        )}
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
                  </>
                )}

                {/* ── Cast tab ─────────────────────────────────────── */}
                {activeWorkspaceTab === 'cast' && selectedProject && (
                  <CastBoard
                    projectId={selectedProject.id}
                    voices={voices}
                    customPresets={customPresets}
                  />
                )}

                {/* ── Review tab ───────────────────────────────────── */}
                {activeWorkspaceTab === 'review' && selectedProject && (
                  <ReviewMode
                    project={selectedProject}
                    isDarkMode={document.documentElement.classList.contains('dark')}
                    inline
                  />
                )}

                {/* ── Timeline tab ─────────────────────────────────── */}
                {activeWorkspaceTab === 'timeline' && selectedProject && (
                  <TimelineReview
                    projectId={selectedProject.id}
                    sections={sections}
                    segments={segments}
                  />
                )}

                {/* ── Export tab ───────────────────────────────────── */}
                {activeWorkspaceTab === 'export' && selectedProject && (
                  <ExportDialog
                    projectId={selectedProject.id}
                    totalSegments={segments.length}
                    renderedSegments={renderedCount}
                    inline
                  />
                )}
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
