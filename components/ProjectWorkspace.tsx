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
  BookOpen,
  Check,
  CheckCircle,
  ChevronDown,
  ClipboardCheck,
  Film,
  FileText,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Trash2,
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
  listClients,
  listProjectCast,
  listProjectQcIssues,
  listProjectSections,
  listProjectSegments,
  listProjectSummaries,
  listProjects,
  listStyles,
  previewProjectImport,
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
import { useJobs } from './JobProvider';
import { ProgressEvent } from '../api';
import {
  CastProfile,
  Client,
  CustomPreset,
  ImportPreview,
  PerformanceStyle,
  ProjectKind,
  ProjectSummary,
  QcIssue,
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
import ProjectImportPanel from './ProjectImportPanel';
import SectionBlock from './SectionBlock';
import SegmentRow from './SegmentRow';
import ProjectListPanel from './projects/ProjectListPanel';
import ProjectHeader from './projects/ProjectHeader';
import ProjectActionBar from './projects/ProjectActionBar';
import ProjectSettingsDrawer from './projects/ProjectSettingsDrawer';
import MobileProjectSwitcher from './projects/MobileProjectSwitcher';
import NewProjectDrawer from './projects/NewProjectDrawer';
import { DEFAULT_PROJECT_TEMPLATE_ID, getProjectTemplate } from './projects/projectTemplates';
import { getExportReadiness, isSegmentAudioReady } from './projects/exportReadiness';
import { getProjectHealth, ProjectNextAction } from './projects/projectHealth';

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

type WorkspaceTab = 'script' | 'cast' | 'review' | 'timeline' | 'export';

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

function mapProjectSummaries(summaries: ProjectSummary[]): Record<number, ProjectSummary> {
  return Object.fromEntries(summaries.map(summary => [summary.project_id, summary]));
}

// ---------------------------------------------------------------------------

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  voices,
  customPresets,
  initialVoiceName,
  onClose,
}) => {
  const { showToast } = useToast();
  const { subscribeToProgress } = useJobs();
  const responsiveMode = useResponsiveMode();
  const isPhone = responsiveMode === 'phone';
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ---- project list ----
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [projectSummaries, setProjectSummaries] = useState<Record<number, ProjectSummary>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<ProjectKind>('audiobook');
  const [newDescription, setNewDescription] = useState(getProjectTemplate(DEFAULT_PROJECT_TEMPLATE_ID).description);
  const [newClientId, setNewClientId] = useState<number | null>(null);
  const [newTemplateId, setNewTemplateId] = useState(DEFAULT_PROJECT_TEMPLATE_ID);
  const [newDefaultVoice, setNewDefaultVoice] = useState(initialVoiceName);
  const [newLanguageCode, setNewLanguageCode] = useState(getProjectTemplate(DEFAULT_PROJECT_TEMPLATE_ID).recommendedDefaults?.language_code ?? 'en');
  const [newModel, setNewModel] = useState('gemini-3.1-flash-tts-preview');

  // ---- project contents ----
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [qcIssues, setQcIssues] = useState<QcIssue[]>([]);
  const [loadingProjectData, setLoadingProjectData] = useState(false);

  // ---- UI state ----
  const [error, setError] = useState<string | null>(null);
  const [showCompactTool, setShowCompactTool] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [showMobileProjectSwitcher, setShowMobileProjectSwitcher] = useState(false);
  const [showNewProjectDrawer, setShowNewProjectDrawer] = useState(false);

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
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importPreviewSource, setImportPreviewSource] = useState('');
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const [previewingImport, setPreviewingImport] = useState(false);
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
  const [settingsModel, setSettingsModel] = useState('gemini-3.1-flash-tts-preview');
  const [settingsStyleId, setSettingsStyleId] = useState<number | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // ---------------------------------------------------------------------------

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedClient = useMemo(
    () => selectedProject?.client_id ? clients.find(c => c.id === selectedProject.client_id) ?? null : null,
    [clients, selectedProject],
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

  const openQcCount = useMemo(
    () => qcIssues.filter(issue => issue.status === 'open').length,
    [qcIssues],
  );

  const exportReadiness = useMemo(
    () => getExportReadiness({ segments, qcIssues }),
    [segments, qcIssues],
  );

  const completedWorkspaceTabs = useMemo<Record<WorkspaceTab, boolean>>(() => {
    const hasSegments = segments.length > 0;
    return {
      script: hasSegments && renderedCount === segments.length,
      cast: false,
      review: hasSegments && approvedCount === segments.length && openQcCount === 0,
      timeline: false,
      export: exportReadiness.canExport,
    };
  }, [segments.length, renderedCount, approvedCount, openQcCount, exportReadiness.canExport]);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadProjectContents = useCallback(async (projectId: number) => {
    setLoadingProjectData(true);
    setError(null);
    try {
      const [nextSections, nextSegments, nextCastProfiles, nextStyles, nextQcIssues] = await Promise.all([
        listProjectSections(projectId),
        listProjectSegments(projectId),
        listProjectCast(projectId).catch(() => [] as CastProfile[]),
        listStyles(projectId).catch(() => [] as PerformanceStyle[]),
        listProjectQcIssues(projectId).catch(() => [] as QcIssue[]),
      ]);
      if (!isMounted.current) return;
      setSections(nextSections);
      setSegments(nextSegments);
      setCastProfiles(nextCastProfiles);
      setStyles(nextStyles);
      setQcIssues(nextQcIssues);
      setExpandedSections(new Set(nextSections.map(s => s.id)));
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err?.message ?? 'Failed to load project contents.');
    } finally {
      if (isMounted.current) setLoadingProjectData(false);
    }
  }, []);

  const refreshProjectSummaries = useCallback(async () => {
    try {
      const summaries = await listProjectSummaries();
      if (!isMounted.current) return;
      setProjectSummaries(mapProjectSummaries(summaries));
    } catch {
      // Summary metadata is additive; core project loading still works without it.
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError(null);
    try {
      const [data, summaries] = await Promise.all([
        listProjects(),
        listProjectSummaries().catch(() => [] as ProjectSummary[]),
      ]);
      if (!isMounted.current) return;
      setProjects(data);
      setProjectSummaries(mapProjectSummaries(summaries));
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
        const [data, summaries, nextClients] = await Promise.all([
          listProjects(),
          listProjectSummaries().catch(() => [] as ProjectSummary[]),
          listClients().catch(() => [] as Client[]),
        ]);
        if (!mounted) return;
        setProjects(data);
        setProjectSummaries(mapProjectSummaries(summaries));
        setClients(nextClients);
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
      setQcIssues([]);
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
        if (isMounted.current) {
          loadProjectContents(selectedProjectId);
          refreshProjectSummaries();
        }
      }
    });
  }, [selectedProjectId, subscribeToProgress, loadProjectContents, refreshProjectSummaries]);

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
    setImportPreview(null);
    setImportPreviewSource('');
    setImportPreviewError(null);
    setShowProjectSettings(false);
    setShowScriptPrep(false);
    setShowAddSection(false);
    setAddingToSectionId(null);
    setEditingSegmentId(null);
    setEditingSectionId(null);
    setActiveWorkspaceTab('script');
    setShowMobileProjectSwitcher(false);
    setShowOverflowMenu(false);
    setContextMenuProjectId(null);
    setRenamingProjectId(null);
    updateConfig({ [CONFIG_KEYS.LAST_OPEN_PROJECT_ID]: String(id) }).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  const createProjectFromState = async (options: { openImport?: boolean } = {}) => {
    const title = newTitle.trim();
    if (!title) return false;
    setCreating(true);
    setError(null);
    try {
      const template = getProjectTemplate(newTemplateId);
      const metadata = {
        ...(template.recommendedDefaults?.metadata ?? {}),
        template_id: template.id,
      };
      const project = await createProject({
        title,
        kind: newKind,
        status: 'active',
        description: newDescription.trim(),
        client_id: newClientId ?? undefined,
        default_voice_name: newDefaultVoice.trim() || undefined,
        default_language_code: newLanguageCode.trim() || template.recommendedDefaults?.language_code,
        default_model: newModel,
        default_style_id: template.recommendedDefaults?.style_id,
        metadata_json: JSON.stringify(metadata),
      });

      let failedSections = 0;
      for (let i = 0; i < template.defaultSections.length; i++) {
        const section = template.defaultSections[i];
        try {
          await createProjectSection(project.id, {
            title: section.title,
            kind: section.kind,
            sort_order: i,
          });
        } catch {
          failedSections++;
        }
      }

      setProjects(prev => [project, ...prev]);
      selectProject(project.id);
      setNewTitle('');
      setNewDescription(getProjectTemplate(DEFAULT_PROJECT_TEMPLATE_ID).description);
      setNewClientId(null);
      setNewTemplateId(DEFAULT_PROJECT_TEMPLATE_ID);
      setNewKind(getProjectTemplate(DEFAULT_PROJECT_TEMPLATE_ID).kind);
      setNewDefaultVoice(initialVoiceName);
      setNewLanguageCode(getProjectTemplate(DEFAULT_PROJECT_TEMPLATE_ID).recommendedDefaults?.language_code ?? 'en');
      setNewModel('gemini-3.1-flash-tts-preview');
      setShowNewProjectDrawer(false);
      if (options.openImport) {
        setShowImport(true);
      }
      refreshProjectSummaries();
      if (failedSections > 0) {
        showToast('Project created, but some template sections could not be added.', 'warning');
      } else {
        showToast('Project created', 'success');
      }
      return true;
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create project.';
      setError(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setCreating(false);
    }
  };

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    await createProjectFromState();
  };

  const handleCreateProjectFromDrawer = (options: { openImport?: boolean } = {}) => {
    void createProjectFromState(options);
  };

  const handleNewProjectTemplateChange = (templateId: string) => {
    const template = getProjectTemplate(templateId);
    setNewTemplateId(templateId);
    setNewKind(template.kind);
    setNewDescription(template.description);
    setNewLanguageCode(template.recommendedDefaults?.language_code ?? 'en');
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
        default_model: settingsModel || undefined,
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

  const handleImportTextChange = (value: string) => {
    setImportText(value);
    setImportPreviewError(null);
  };

  const handlePreviewImport = async () => {
    const text = importText.trim();
    if (!text || !selectedProjectId) return;
    setPreviewingImport(true);
    setImportPreviewError(null);
    try {
      const preview = await previewProjectImport(selectedProjectId, text);
      setImportPreview(preview);
      setImportPreviewSource(text);
    } catch (err: any) {
      setImportPreview(null);
      setImportPreviewSource('');
      setImportPreviewError(err?.message ?? 'Preview failed.');
    } finally {
      setPreviewingImport(false);
    }
  };

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = importText.trim();
    if (!text || !selectedProjectId) return;
    if (!importPreview || importPreviewSource !== text) {
      showToast('Preview the current import text before importing.', 'warning');
      return;
    }
    setImporting(true);
    try {
      const result = await importProjectText(selectedProjectId, text);
      await loadProjectContents(selectedProjectId);
      await refreshProjectSummaries();
      setImportText('');
      setImportPreview(null);
      setImportPreviewSource('');
      setImportPreviewError(null);
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
      setImportPreview(null);
      setImportPreviewSource('');
      setImportPreviewError(null);
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

  const showBatchRenderToast = useCallback((res: Awaited<ReturnType<typeof batchRenderProject>>, label: string = 'segment') => {
    const hasSummary = typeof res.rendered === 'number' || typeof res.failed === 'number';
    if (hasSummary) {
      const rendered = res.rendered ?? 0;
      const failed = res.failed ?? 0;
      const skipped = res.skipped ?? 0;
      const duration = typeof res.total_ms === 'number' && res.total_ms > 0
        ? ` in ${(res.total_ms / 1000).toFixed(1)}s`
        : '';
      const skippedText = skipped > 0 ? `, ${skipped} skipped` : '';
      showToast(`Batch complete - ${rendered} rendered, ${failed} failed${skippedText}${duration}`, failed > 0 ? 'warning' : 'success');
      return;
    }
    const count = res.segment_count ?? 0;
    showToast(`Rendering ${count} ${label}${count === 1 ? '' : 's'} (job ${res.job_id})`, 'success');
  }, [showToast]);

  const handleRenderMissingAudio = async () => {
    if (!selectedProject) return;
    const missingSegmentIds = segments
      .filter(segment => segment.script_text.trim() && !isSegmentAudioReady(segment))
      .map(segment => segment.id);
    if (missingSegmentIds.length === 0) {
      showToast('No missing audio to render.', 'info');
      return;
    }

    setBatchRendering(true);
    try {
      const res = await batchRenderProject(selectedProject.id, { segmentIds: missingSegmentIds });
      showBatchRenderToast(res, 'missing segment');
    } catch (err: any) {
      showToast(err?.message ?? 'Render missing audio failed.', 'error');
    } finally {
      setBatchRendering(false);
    }
  };

  const handleProjectNextAction = (action: ProjectNextAction) => {
    setShowOverflowMenu(false);
    setShowProjectSettings(false);
    setShowPronunciation(false);

    switch (action.id) {
      case 'import_script':
        setActiveWorkspaceTab('script');
        setShowImport(true);
        setImportText('');
        setImportPreview(null);
        setImportPreviewSource('');
        setImportPreviewError(null);
        break;
      case 'open_cast':
        setActiveWorkspaceTab('cast');
        break;
      case 'render_missing':
        setActiveWorkspaceTab('script');
        void handleRenderMissingAudio();
        break;
      case 'review_takes':
      case 'resolve_qc':
        setActiveWorkspaceTab('review');
        break;
      case 'start_export':
        setActiveWorkspaceTab('export');
        break;
    }
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const unsectionedSegments = segmentsBySection.get(null) ?? [];
  const showProjectSidebar = !isPhone || !selectedProject;
  const sidebarSegmentCounts = selectedProjectId !== null ? { [selectedProjectId]: segments.length } : {};
  const importPreviewStale = !!importPreview && importPreviewSource !== importText.trim();
  const selectedProjectKindLabel = selectedProject
    ? PROJECT_KINDS.find(kind => kind.value === selectedProject.kind)?.label ?? selectedProject.kind.replace(/_/g, ' ')
    : '';
  const mobileStageSummary = segments.length === 0
    ? 'No script yet'
    : renderedCount < segments.length
    ? `Rendered ${renderedCount}/${segments.length}`
    : approvedCount < renderedCount
    ? `Reviewed ${approvedCount}/${renderedCount}`
    : 'Export ready';
  const projectHealth = selectedProject
    ? getProjectHealth({
        project: selectedProject,
        segments,
        castProfiles,
        qcIssues,
        renderedCount,
        approvedCount,
        draftCount,
      })
    : null;
  const settingsDirty = !!selectedProject && (
    settingsVoice.trim() !== (selectedProject.default_voice_name ?? '') ||
    settingsLang.trim() !== (selectedProject.default_language_code ?? '') ||
    settingsModel !== (selectedProject.default_model ?? 'gemini-3.1-flash-tts-preview') ||
    settingsStyleId !== (selectedProject.default_style_id ?? null)
  );
  const closeProjectSettings = () => {
    if (settingsDirty && !window.confirm('Discard unsaved project settings?')) return;
    setShowProjectSettings(false);
  };
  const emptyStateTemplates = [
    {
      id: 'audiobook_chapters',
      title: 'Audiobook',
      description: 'Chapter-based narration with room for long-form sections.',
      icon: <BookOpen size={16} />,
    },
    {
      id: 'podcast_episode',
      title: 'Podcast',
      description: 'Episode structure for intro, body, and outro reads.',
      icon: <Users size={16} />,
    },
    {
      id: 'voiceover_spot',
      title: 'Voiceover',
      description: 'Commercial copy with main reads and alternate takes.',
      icon: <FileText size={16} />,
    },
  ];
  const openProjectTemplate = (templateId: string) => {
    handleNewProjectTemplateChange(templateId);
    setNewTitle('');
    setShowNewProjectDrawer(true);
  };

  return (
    <div
      className="flex-1 overflow-hidden bg-white dark:bg-zinc-950 flex flex-col"
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
          <ProjectListPanel
            projects={projects}
            selectedProjectId={selectedProjectId}
            clients={clients}
            projectSummaries={projectSummaries}
            segmentCounts={sidebarSegmentCounts}
            loadingProjects={loadingProjects}
            creating={creating}
            newTitle={newTitle}
            newKind={newKind}
            newDescription={newDescription}
            newClientId={newClientId}
            newTemplateId={newTemplateId}
            showArchived={showArchived}
            contextMenuProjectId={contextMenuProjectId}
            renamingProjectId={renamingProjectId}
            renameValue={renameValue}
            savingRename={savingRename}
            newProjectOpen={showNewProjectDrawer}
            onNewTitleChange={setNewTitle}
            onNewKindChange={setNewKind}
            onNewDescriptionChange={setNewDescription}
            onNewClientIdChange={setNewClientId}
            onNewTemplateIdChange={handleNewProjectTemplateChange}
            onCreateProject={handleCreateProject}
            onOpenNewProject={() => setShowNewProjectDrawer(true)}
            onCloseNewProject={() => setShowNewProjectDrawer(false)}
            onSelectProject={selectProject}
            onArchive={handleArchiveFromMenu}
            onUnarchive={handleUnarchiveProject}
            onStartRename={p => { setContextMenuProjectId(null); setRenamingProjectId(p.id); setRenameValue(p.title); }}
            onRenameValueChange={setRenameValue}
            onSaveRename={handleSaveRename}
            onCancelRename={() => setRenamingProjectId(null)}
            onSetContextMenu={setContextMenuProjectId}
            onSetShowArchived={setShowArchived}
          />
        </aside>

        {/* Content pane */}
        <main
          className={`min-h-0 overflow-y-auto ${isPhone ? 'border-t border-zinc-200 pb-36 dark:border-zinc-800' : ''}`}
          style={isPhone ? { paddingBottom: 'calc(9rem + env(safe-area-inset-bottom))', scrollPaddingBottom: 'calc(9rem + env(safe-area-inset-bottom))' } : undefined}
        >
          {error && (
            <div className="m-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {showCompactTool ? (
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
              {isPhone && (
                <div className="sticky top-0 z-30 bg-white/95 pb-2 backdrop-blur dark:bg-zinc-950/95">
                  <MobileProjectSwitcher
                    project={selectedProject}
                    client={selectedClient}
                    kindLabel={selectedProjectKindLabel}
                    stageSummary={mobileStageSummary}
                    open={showMobileProjectSwitcher}
                    onOpenChange={setShowMobileProjectSwitcher}
                  >
                    <ProjectListPanel
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    clients={clients}
                    projectSummaries={projectSummaries}
                    segmentCounts={sidebarSegmentCounts}
                    loadingProjects={loadingProjects}
                    creating={creating}
                    newTitle={newTitle}
                    newKind={newKind}
                    newDescription={newDescription}
                    newClientId={newClientId}
                    newTemplateId={newTemplateId}
                    showArchived={showArchived}
                    contextMenuProjectId={contextMenuProjectId}
                    renamingProjectId={renamingProjectId}
                    renameValue={renameValue}
                    savingRename={savingRename}
                    newProjectOpen={showNewProjectDrawer}
                    onNewTitleChange={setNewTitle}
                    onNewKindChange={setNewKind}
                    onNewDescriptionChange={setNewDescription}
                    onNewClientIdChange={setNewClientId}
                    onNewTemplateIdChange={handleNewProjectTemplateChange}
                    onCreateProject={handleCreateProject}
                    onOpenNewProject={() => {
                      setShowMobileProjectSwitcher(false);
                      setShowNewProjectDrawer(true);
                    }}
                    onCloseNewProject={() => setShowNewProjectDrawer(false)}
                    onSelectProject={id => {
                      selectProject(id);
                      setShowMobileProjectSwitcher(false);
                    }}
                    onArchive={handleArchiveFromMenu}
                    onUnarchive={handleUnarchiveProject}
                    onStartRename={p => { setContextMenuProjectId(null); setRenamingProjectId(p.id); setRenameValue(p.title); }}
                    onRenameValueChange={setRenameValue}
                    onSaveRename={handleSaveRename}
                    onCancelRename={() => setRenamingProjectId(null)}
                    onSetContextMenu={setContextMenuProjectId}
                    onSetShowArchived={setShowArchived}
                    />
                  </MobileProjectSwitcher>
                </div>
              )}

              {/* Project header */}
              <ProjectHeader
                project={selectedProject}
                client={selectedClient}
                segments={segments}
                castProfiles={castProfiles}
                qcIssues={qcIssues}
                renderedCount={renderedCount}
                approvedCount={approvedCount}
                draftCount={draftCount}
                compactStage={isPhone}
                hideTitle={isPhone}
                health={projectHealth ?? undefined}
                onNextAction={handleProjectNextAction}
              />

              {/* Content tab bar */}
              <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className={isPhone ? 'space-y-3 py-3' : 'flex items-center justify-between gap-2'}>
                  <nav
                    className={isPhone ? 'flex w-full gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50' : 'flex -mb-px'}
                    role="tablist"
                    aria-label="Project workspace"
                  >
                    {WORKSPACE_TABS.map(tab => (
                      <button
                        key={tab.id}
                        id={workspaceTabId(tab.id)}
                        type="button"
                        role="tab"
                        data-tour-step={`project-${tab.id}-tab`}
                        aria-selected={activeWorkspaceTab === tab.id}
                        aria-controls={workspacePanelId(tab.id)}
                        tabIndex={activeWorkspaceTab === tab.id ? 0 : -1}
                        onClick={() => setActiveWorkspaceTab(tab.id)}
                        className={isPhone
                          ? `inline-flex h-10 min-w-[5.25rem] items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors ${
                              activeWorkspaceTab === tab.id
                                ? 'bg-white text-[var(--accent-700)] shadow-sm dark:bg-zinc-950 dark:text-[var(--accent-300)]'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`
                          : `inline-flex h-9 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold transition-colors ${
                              activeWorkspaceTab === tab.id
                                ? 'border-[var(--accent-500)] text-[var(--accent-700)] dark:text-[var(--accent-300)]'
                                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`
                        }
                      >
                        {tab.icon}
                        <span className={isPhone ? 'whitespace-nowrap' : 'hidden sm:inline'}>{tab.label}</span>
                        {completedWorkspaceTabs[tab.id] && (
                          <span data-testid={`check-${tab.id}-complete`} className="inline-flex items-center" aria-hidden="true">
                            <CheckCircle size={11} className="text-green-500 dark:text-green-400" />
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                  <ProjectActionBar
                    activeTab={activeWorkspaceTab}
                    selectedProject={selectedProject}
                    archiving={archiving}
                    batchRendering={batchRendering}
                    showImport={showImport}
                    showProjectSettings={showProjectSettings}
                    showPronunciation={showPronunciation}
                    showOverflowMenu={showOverflowMenu}
                    mobile={isPhone}
                    onPrep={() => setShowScriptPrep(true)}
                    onToggleImport={() => {
                      setShowImport(prev => !prev);
                      setImportText('');
                      setImportPreview(null);
                      setImportPreviewSource('');
                      setImportPreviewError(null);
                    }}
                    onRenderAll={async () => {
                      if (!selectedProject) return;
                      setBatchRendering(true);
                      try {
                        const res = await batchRenderProject(selectedProject.id);
                        showBatchRenderToast(res);
                      } catch (err: any) {
                        showToast(err?.message ?? 'Batch render failed.', 'error');
                      } finally {
                        setBatchRendering(false);
                      }
                    }}
                    onToggleSettings={() => {
                      setSettingsVoice(selectedProject.default_voice_name ?? '');
                      setSettingsLang(selectedProject.default_language_code ?? '');
                      setSettingsModel(selectedProject.default_model ?? 'gemini-3.1-flash-tts-preview');
                      setSettingsStyleId(selectedProject.default_style_id ?? null);
                      setShowProjectSettings(prev => !prev);
                      setShowPronunciation(false);
                      setShowOverflowMenu(false);
                    }}
                    onTogglePronunciation={() => {
                      setShowPronunciation(prev => !prev);
                      setShowProjectSettings(false);
                      setShowOverflowMenu(false);
                    }}
                    onArchiveProject={() => { setShowOverflowMenu(false); handleArchiveProject(); }}
                    onSetShowOverflowMenu={setShowOverflowMenu}
                  />
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
                      previewing={previewingImport}
                      preview={importPreview}
                      previewStale={importPreviewStale}
                      previewError={importPreviewError}
                      mobile={isPhone}
                      onChangeText={handleImportTextChange}
                      onPreview={handlePreviewImport}
                      onSubmit={handleImport}
                      onFileImport={handleFileImport}
                      onClose={() => {
                        setShowImport(false);
                        setImportText('');
                        setImportPreview(null);
                        setImportPreviewSource('');
                        setImportPreviewError(null);
                      }}
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
                    segments={segments}
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
                    qcIssues={qcIssues}
                    renderingMissingAudio={batchRendering}
                    onRenderMissingAudio={handleRenderMissingAudio}
                    onGoToReview={() => setActiveWorkspaceTab('review')}
                  />
                )}

                {/* ── Export tab ───────────────────────────────────── */}
                {activeWorkspaceTab === 'export' && selectedProject && (
                  <ExportDialog
                    projectId={selectedProject.id}
                    totalSegments={segments.length}
                    renderedSegments={renderedCount}
                    segments={segments}
                    qcIssues={qcIssues}
                    renderingMissingAudio={batchRendering}
                    onRenderMissingAudio={handleRenderMissingAudio}
                    onGoToReview={() => setActiveWorkspaceTab('review')}
                    inline
                  />
                )}
              </section>
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center p-6 text-center">
              <div className="w-full max-w-2xl">
                <BookOpen size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Create a project to start.</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                  Pick a production template or start from a blank workspace.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {emptyStateTemplates.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      data-testid="empty-state-template"
                      onClick={() => openProjectTemplate(template.id)}
                      className="template-card flex h-full flex-col items-start rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 text-left shadow-sm transition-colors hover:border-[var(--accent-300)] dark:hover:border-[var(--accent-600)] hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-50)] dark:bg-zinc-900 text-[var(--accent-600)] dark:text-[var(--accent-200)]">
                        {template.icon}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">{template.title}</span>
                      <span className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{template.description}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => openProjectTemplate(DEFAULT_PROJECT_TEMPLATE_ID)}
                  className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)]"
                >
                  <Plus size={13} />
                  Create your first project
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <NewProjectDrawer
        open={showNewProjectDrawer}
        mobile={isPhone}
        title={newTitle}
        kind={newKind}
        description={newDescription}
        clientId={newClientId}
        templateId={newTemplateId}
        defaultVoice={newDefaultVoice}
        languageCode={newLanguageCode}
        model={newModel}
        clients={clients}
        voices={voices}
        creating={creating}
        onTitleChange={setNewTitle}
        onKindChange={setNewKind}
        onDescriptionChange={setNewDescription}
        onClientIdChange={setNewClientId}
        onTemplateIdChange={handleNewProjectTemplateChange}
        onDefaultVoiceChange={setNewDefaultVoice}
        onLanguageCodeChange={setNewLanguageCode}
        onModelChange={setNewModel}
        onCreate={handleCreateProjectFromDrawer}
        onClose={() => setShowNewProjectDrawer(false)}
      />

      {/* Project settings drawer — rendered outside the main grid so it doesn't shift layout */}
      {selectedProject && (
        <ProjectSettingsDrawer
          open={showProjectSettings}
          project={selectedProject}
          voices={voices}
          customPresets={customPresets}
          styles={styles}
          settingsVoice={settingsVoice}
          settingsLang={settingsLang}
          settingsModel={settingsModel}
          settingsStyleId={settingsStyleId}
          savingSettings={savingSettings}
          dirty={settingsDirty}
          onChangeVoice={setSettingsVoice}
          onChangeLang={setSettingsLang}
          onChangeModel={setSettingsModel}
          onChangeStyleId={setSettingsStyleId}
          onStyleCreated={s => setStyles(prev => [...prev, s])}
          onSave={handleSaveProjectSettings}
          onClose={closeProjectSettings}
          mobile={isPhone}
        />
      )}
    </div>
  );
};

export default ProjectWorkspace;
