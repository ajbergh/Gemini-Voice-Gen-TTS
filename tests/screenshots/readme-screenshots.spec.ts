/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * tests/screenshots/readme-screenshots.spec.ts
 *
 * Captures polished UI screenshots for use in the README and documentation.
 * Run with:
 *   npx playwright test tests/screenshots/readme-screenshots.spec.ts
 *
 * Output files land in assets/screenshots/.
 */

import { test, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { setupApiMocks } from '../helpers/api-mocks';

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../assets/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Rich fixture data for realistic-looking screenshots
// ---------------------------------------------------------------------------

const PROJECTS = [
  {
    id: 1,
    title: 'The Midnight Archive',
    kind: 'audiobook',
    status: 'active',
    default_voice_name: 'Charon',
    default_language_code: 'en-US',
    default_provider: 'gemini',
    default_model: 'gemini-3.1-flash-tts-preview',
    fallback_provider: '',
    fallback_model: '',
    default_style_id: null,
    description: 'A supernatural thriller audiobook with multiple narrators.',
    client_id: 1,
    metadata_json: '{}',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-04-28T14:22:00Z',
  },
  {
    id: 2,
    title: 'Brand Voice Campaign Q2',
    kind: 'voiceover',
    status: 'active',
    default_voice_name: 'Zephyr',
    default_language_code: 'en-US',
    default_provider: 'gemini',
    default_model: 'gemini-3.1-flash-tts-preview',
    fallback_provider: '',
    fallback_model: '',
    default_style_id: null,
    description: 'Corporate voice-over for Q2 marketing videos.',
    client_id: 2,
    metadata_json: '{}',
    created_at: '2026-03-01T09:00:00Z',
    updated_at: '2026-04-29T11:00:00Z',
  },
  {
    id: 3,
    title: 'Deep Dive: AI Weekly',
    kind: 'podcast',
    status: 'active',
    default_voice_name: 'Puck',
    default_language_code: 'en-US',
    default_provider: 'gemini',
    default_model: 'gemini-3.1-flash-tts-preview',
    fallback_provider: '',
    fallback_model: '',
    default_style_id: null,
    description: 'Weekly AI news podcast with two hosts.',
    client_id: null,
    metadata_json: '{}',
    created_at: '2026-02-10T08:00:00Z',
    updated_at: '2026-04-30T09:45:00Z',
  },
];

const SECTIONS = [
  { id: 1, project_id: 1, title: 'Prologue', kind: 'chapter', sort_order: 0, created_at: '2026-01-15T10:00:00Z', updated_at: '2026-01-15T10:00:00Z' },
  { id: 2, project_id: 1, title: 'Chapter 1: The Call', kind: 'chapter', sort_order: 1, created_at: '2026-01-16T10:00:00Z', updated_at: '2026-01-16T10:00:00Z' },
  { id: 3, project_id: 1, title: 'Chapter 2: Into the Dark', kind: 'chapter', sort_order: 2, created_at: '2026-01-17T10:00:00Z', updated_at: '2026-01-17T10:00:00Z' },
];

const SEGMENTS = [
  { id: 101, project_id: 1, section_id: 1, title: '', script_text: 'They say the archive never closes. Not at midnight, not at the solstice, not even when the old caretaker vanished without a trace.', speaker_label: 'Narrator', status: 'approved', voice_name: 'Charon', language_code: 'en-US', provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', render_job_id: null, style_id: null, content_hash: 'abc001', sort_order: 0, created_at: '2026-01-15T10:05:00Z', updated_at: '2026-04-28T09:10:00Z' },
  { id: 102, project_id: 1, section_id: 1, title: '', script_text: '"I\'ve read every entry," she whispered, her fingers trembling over the leather spine. "Every single one since 1887."', speaker_label: 'Elara', status: 'approved', voice_name: 'Aoede', language_code: 'en-US', provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', render_job_id: null, style_id: null, content_hash: 'abc002', sort_order: 1, created_at: '2026-01-15T10:10:00Z', updated_at: '2026-04-28T09:15:00Z' },
  { id: 103, project_id: 1, section_id: 2, title: '', script_text: 'The phone rang at exactly 3:17 AM. Elara knew because she\'d been counting the seconds since midnight, watching the storm roll in off the harbor.', speaker_label: 'Narrator', status: 'rendered', voice_name: 'Charon', language_code: 'en-US', provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', render_job_id: null, style_id: null, content_hash: 'abc003', sort_order: 0, created_at: '2026-01-16T10:05:00Z', updated_at: '2026-04-29T10:30:00Z' },
  { id: 104, project_id: 1, section_id: 2, title: '', script_text: '"Detective Morrow." The voice on the line was neither warm nor cold. "We have a situation."', speaker_label: 'Unknown Caller', status: 'rendered', voice_name: 'Fenrir', language_code: 'en-US', provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', render_job_id: null, style_id: null, content_hash: 'abc004', sort_order: 1, created_at: '2026-01-16T10:10:00Z', updated_at: '2026-04-29T10:35:00Z' },
  { id: 105, project_id: 1, section_id: 3, title: '', script_text: 'The lower levels of the archive smelled of cedar and old copper. Elara\'s lantern threw dancing shadows across vaults that hadn\'t been opened in decades.', speaker_label: 'Narrator', status: 'draft', voice_name: 'Charon', language_code: 'en-US', provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', render_job_id: null, style_id: null, content_hash: '', sort_order: 0, created_at: '2026-01-17T10:05:00Z', updated_at: '2026-01-17T10:05:00Z' },
];

const TAKES = [
  { id: 201, project_id: 1, segment_id: 101, take_number: 1, status: 'approved', audio_path: 'cache/take-201.pcm', content_hash: 'abc001', duration_ms: 4800, provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', created_at: '2026-04-28T09:05:00Z' },
  { id: 202, project_id: 1, segment_id: 102, take_number: 1, status: 'approved', audio_path: 'cache/take-202.pcm', content_hash: 'abc002', duration_ms: 3200, provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', created_at: '2026-04-28T09:10:00Z' },
  { id: 203, project_id: 1, segment_id: 103, take_number: 1, status: 'rendered', audio_path: 'cache/take-203.pcm', content_hash: 'abc003', duration_ms: 5100, provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', created_at: '2026-04-29T10:25:00Z' },
  { id: 204, project_id: 1, segment_id: 104, take_number: 1, status: 'rendered', audio_path: 'cache/take-204.pcm', content_hash: 'abc004', duration_ms: 2900, provider: 'gemini', model: 'gemini-3.1-flash-tts-preview', created_at: '2026-04-29T10:30:00Z' },
];

const CAST_PROFILES = [
  {
    id: 1,
    project_id: 1,
    name: 'Narrator',
    role: 'narrator',
    description: 'The omniscient voice guiding listeners through the story. Deep, measured, and authoritative with an undercurrent of tension.',
    voice_name: 'Charon',
    accent_id: 'en-US',
    language_code: 'en-US',
    age_impression: 'mature',
    emotional_range: 'wide',
    sample_lines_json: JSON.stringify(['They say the archive never closes.', 'The phone rang at exactly 3:17 AM.']),
    pronunciation_notes: 'Archive = AR-kive (not ar-KYVE)',
    sort_order: 0,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-04-28T09:00:00Z',
  },
  {
    id: 2,
    project_id: 1,
    name: 'Elara Morrow',
    role: 'protagonist',
    description: 'A tenacious archivist-turned-detective. Intelligent, slightly world-weary, with a dry wit that surfaces in moments of stress.',
    voice_name: 'Aoede',
    accent_id: 'en-US',
    language_code: 'en-US',
    age_impression: 'mid-30s',
    emotional_range: 'medium-wide',
    sample_lines_json: JSON.stringify(['"I\'ve read every entry," she whispered.', '"We keep running into each other, Detective."']),
    pronunciation_notes: 'Elara = eh-LAR-ah',
    sort_order: 1,
    created_at: '2026-01-15T10:05:00Z',
    updated_at: '2026-04-28T09:05:00Z',
  },
  {
    id: 3,
    project_id: 1,
    name: 'The Caller',
    role: 'antagonist',
    description: 'Mysterious and controlled. Speaks in precise, clipped sentences. Never raises their voice.',
    voice_name: 'Fenrir',
    accent_id: 'en-US',
    language_code: 'en-US',
    age_impression: 'indeterminate',
    emotional_range: 'narrow',
    sample_lines_json: JSON.stringify(['"We have a situation."', '"You already know the answer."']),
    pronunciation_notes: '',
    sort_order: 2,
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-04-28T09:10:00Z',
  },
  {
    id: 4,
    project_id: 1,
    name: 'Archive Spirit',
    role: 'supporting',
    description: 'Ancient, ethereal. The voice of the archive itself — sometimes helpful, sometimes cryptic.',
    voice_name: 'Kore',
    accent_id: 'en-US',
    language_code: 'en-US',
    age_impression: 'ageless',
    emotional_range: 'narrow',
    sample_lines_json: JSON.stringify(['"The records do not lie."', '"Every name here once breathed."']),
    pronunciation_notes: '',
    sort_order: 3,
    created_at: '2026-01-18T10:00:00Z',
    updated_at: '2026-04-20T10:00:00Z',
  },
];

const QC_ISSUES = [
  {
    id: 1,
    project_id: 1,
    segment_id: 103,
    take_id: 203,
    severity: 'medium',
    status: 'open',
    description: 'Slight room noise audible between sentences. Consider re-render or noise gate.',
    notes: '',
    created_at: '2026-04-29T11:00:00Z',
    updated_at: '2026-04-29T11:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

/** Wait for the app to be fully loaded and stable */
async function loadApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('navigation', { name: 'Main navigation' }).first().waitFor({ state: 'visible' });
  // Let animations settle
  await page.waitForTimeout(600);
}

/** Set dark mode — must be called AFTER setupApiMocks so this route takes precedence */
async function applyDarkMode(page: Page): Promise<void> {
  await page.route('**/api/config', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ theme: 'dark' }) }),
  );
}

/** Helper: navigate to a named sidebar section */
async function goToSection(page: Page, name: 'Voices' | 'My Presets' | 'Projects' | 'Script Reader' | 'History'): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  await nav.getByRole('button', { name }).click();
  await page.waitForTimeout(400);
}

/**
 * Add extra route overrides (after setupApiMocks) so the project 1 workspace
 * header reflects the rich fixture project rather than FIXTURE_PROJECT.
 * Must be called AFTER setupApiMocks because Playwright matches the
 * last-registered route first.
 */
async function addProjectRouteOverrides(page: Page): Promise<void> {
  const json = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
  await page.route('**/api/projects/1', route => route.fulfill(json(PROJECTS[0])));
  await page.route('**/api/projects/1/sections**', route => route.fulfill(json(SECTIONS)));
  await page.route('**/api/projects/1/segments', route => {
    if (route.request().method() === 'GET') return route.fulfill(json(SEGMENTS));
    return route.fulfill(json({ ...SEGMENTS[0], id: 999 }));
  });
  await page.route('**/api/projects/1/qc**', route => route.fulfill(json(QC_ISSUES)));
  await page.route('**/api/projects/*/cast', route => route.fulfill(json(CAST_PROFILES)));
  await page.route('**/api/cast**', route => route.fulfill(json(CAST_PROFILES)));
  // Summary for all projects
  await page.route('**/api/projects/summary', route => route.fulfill(json(PROJECTS.map((p, i) => ({
    project_id: p.id,
    section_count: SECTIONS.filter(s => s.project_id === p.id).length,
    segment_count: SEGMENTS.filter(s => s.project_id === p.id).length,
    rendered_count: SEGMENTS.filter(s => s.project_id === p.id && ['rendered', 'approved', 'locked'].includes(s.status)).length,
    approved_count: SEGMENTS.filter(s => s.project_id === p.id && s.status === 'approved').length,
    open_qc_count: QC_ISSUES.filter(q => q.project_id === p.id && q.status === 'open').length,
    updated_at: p.updated_at,
  })))));
}

/** Open a project by clicking it in the project list */
async function openFirstProject(page: Page): Promise<void> {
  await goToSection(page, 'Projects');
  await page.waitForTimeout(400);
  // Click "The Midnight Archive" project row button
  const projectBtn = page.locator('[data-testid="project-list"]').getByText('The Midnight Archive').first();
  await projectBtn.click({ timeout: 5000 });
  await page.waitForTimeout(600);
}

/** Click a workspace tab inside an open project */
async function clickWorkspaceTab(page: Page, tabLabel: string): Promise<void> {
  await page.locator(`[id="project-tab-${tabLabel.toLowerCase()}"]`).click();
  await page.waitForTimeout(400);
}

/** Capture a screenshot to the assets/screenshots directory */
async function capture(page: Page, filename: string): Promise<void> {
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: false,
  });
  console.log(`  ✓ ${filename}`);
}

// ---------------------------------------------------------------------------
// Screenshot tests — each group covers a feature area
// ---------------------------------------------------------------------------

test.use({ viewport: { width: 1440, height: 860 } });

// ---------------------------------------------------------------------------
// 1. Voice Library
// ---------------------------------------------------------------------------
test.describe('Voice Library', () => {
  test('grid view — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    await capture(page, '01-voice-library-grid-dark.png');
  });

  test('grid view — light mode', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await capture(page, '02-voice-library-grid-light.png');
  });

  test('carousel view — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    // Switch to carousel view via the view toggle button
    const carouselBtn = page.getByRole('button', { name: /carousel/i }).first();
    try {
      await carouselBtn.click({ timeout: 3000 });
    } catch {
      // Try title attribute fallback
      await page.locator('button[title*="arousel"]').first().click();
    }
    await page.waitForTimeout(800);
    await capture(page, '03-voice-library-carousel-dark.png');
  });
});

// ---------------------------------------------------------------------------
// 2. AI Casting Director
// ---------------------------------------------------------------------------
test.describe('AI Casting Director', () => {
  test('voice finder modal — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);

    // Open AI Casting via sidebar button
    const castingBtn = page.getByRole('button', { name: /AI Casting/i }).first();
    await castingBtn.click();
    await page.waitForTimeout(500);
    await capture(page, '04-ai-casting-director-dark.png');
  });
});

// ---------------------------------------------------------------------------
// 3. Script Reader
// ---------------------------------------------------------------------------
test.describe('Script Reader', () => {
  test('script reader panel — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    await goToSection(page, 'Script Reader');
    await page.waitForTimeout(600);
    await capture(page, '05-script-reader-dark.png');
  });

  test('script reader panel — light mode', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToSection(page, 'Script Reader');
    await page.waitForTimeout(600);
    await capture(page, '06-script-reader-light.png');
  });
});

// ---------------------------------------------------------------------------
// 4. Projects Workspace
// ---------------------------------------------------------------------------
test.describe('Projects Workspace', () => {
  test('project list — dark mode', async ({ page }) => {
    await setupApiMocks(page, {
      projects: PROJECTS,
      segments: SEGMENTS,
      sections: SECTIONS,
      takes: TAKES,
      castProfiles: CAST_PROFILES,
      qcIssues: QC_ISSUES,
    });
    await applyDarkMode(page);
    await loadApp(page);
    await goToSection(page, 'Projects');
    await page.waitForTimeout(600);
    await capture(page, '07-projects-list-dark.png');
  });

  test('project list — light mode', async ({ page }) => {
    await setupApiMocks(page, {
      projects: PROJECTS,
      segments: SEGMENTS,
      sections: SECTIONS,
      takes: TAKES,
      castProfiles: CAST_PROFILES,
      qcIssues: QC_ISSUES,
    });
    await loadApp(page);
    await goToSection(page, 'Projects');
    await page.waitForTimeout(600);
    await capture(page, '08-projects-list-light.png');
  });

  test('project script tab — dark mode', async ({ page }) => {
    await setupApiMocks(page, {
      projects: PROJECTS,
      segments: SEGMENTS,
      sections: SECTIONS,
      takes: TAKES,
      castProfiles: CAST_PROFILES,
    });
    await applyDarkMode(page);
    await addProjectRouteOverrides(page);
    await loadApp(page);
    await openFirstProject(page);
    await page.waitForTimeout(600);
    await capture(page, '09-project-script-tab-dark.png');
  });

  test('cast bible tab — dark mode', async ({ page }) => {
    await setupApiMocks(page, {
      projects: PROJECTS,
      segments: SEGMENTS,
      sections: SECTIONS,
      takes: TAKES,
      castProfiles: CAST_PROFILES,
    });
    await applyDarkMode(page);
    await addProjectRouteOverrides(page);
    await loadApp(page);
    await openFirstProject(page);
    await clickWorkspaceTab(page, 'cast');
    await capture(page, '10-cast-bible-dark.png');
  });

  test('review tab — dark mode', async ({ page }) => {
    await setupApiMocks(page, {
      projects: PROJECTS,
      segments: SEGMENTS,
      sections: SECTIONS,
      takes: TAKES,
      castProfiles: CAST_PROFILES,
      qcIssues: QC_ISSUES,
    });
    await applyDarkMode(page);
    await addProjectRouteOverrides(page);
    await loadApp(page);
    await openFirstProject(page);
    await clickWorkspaceTab(page, 'review');
    await capture(page, '11-review-qc-dark.png');
  });

  test('export tab — dark mode', async ({ page }) => {
    await setupApiMocks(page, {
      projects: PROJECTS,
      segments: SEGMENTS,
      sections: SECTIONS,
      takes: TAKES,
      castProfiles: CAST_PROFILES,
    });
    await applyDarkMode(page);
    await addProjectRouteOverrides(page);
    await loadApp(page);
    await openFirstProject(page);
    await clickWorkspaceTab(page, 'export');
    await capture(page, '12-export-dark.png');
  });
});

// ---------------------------------------------------------------------------
// 5. Settings Modal
// ---------------------------------------------------------------------------
test.describe('Settings', () => {
  test('settings modal — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);

    // Open settings via sidebar button
    const settingsBtn = page.getByRole('button', { name: /settings/i }).first();
    await settingsBtn.click();
    await page.waitForTimeout(500);
    await capture(page, '13-settings-dark.png');
  });
});

// ---------------------------------------------------------------------------
// 6. My Presets
// ---------------------------------------------------------------------------
test.describe('My Presets', () => {
  test('presets section — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    await goToSection(page, 'My Presets');
    await page.waitForTimeout(600);
    await capture(page, '14-my-presets-dark.png');
  });
});

// ---------------------------------------------------------------------------
// 7. Mobile viewport — Voice Library
// ---------------------------------------------------------------------------
test.describe('Mobile Views', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('voice library mobile — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    await capture(page, '15-mobile-voice-library-dark.png');
  });

  test('script reader mobile — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    // On mobile, Script Reader is in bottom nav
    const scriptBtn = page.getByRole('button', { name: 'Script Reader' }).first();
    try {
      await scriptBtn.click({ timeout: 3000 });
    } catch {
      await page.getByRole('button', { name: 'Script' }).first().click();
    }
    await page.waitForTimeout(600);
    await capture(page, '16-mobile-script-reader-dark.png');
  });
});

// ---------------------------------------------------------------------------
// 8. History Panel
// ---------------------------------------------------------------------------
const HISTORY_ENTRIES = [
  {
    id: 1, type: 'tts', voice_name: 'Charon',
    input_text: 'They say the archive never closes. Not at midnight, not at the solstice, not even when the old caretaker vanished without a trace.',
    result_json: null, audio_path: 'cache/hist-1.pcm', created_at: '2026-04-28T14:00:00Z',
  },
  {
    id: 2, type: 'tts', voice_name: 'Zephyr',
    input_text: 'Welcome to the show, everyone! Tonight we explore the future of AI and what it means for all of us.',
    result_json: null, audio_path: 'cache/hist-2.pcm', created_at: '2026-04-27T10:00:00Z',
  },
  {
    id: 3, type: 'tts', voice_name: 'Aoede',
    input_text: '"I\'ve read every entry," she whispered, her fingers trembling over the leather spine. "Every single one since 1887."',
    result_json: null, audio_path: 'cache/hist-3.pcm', created_at: '2026-04-26T16:30:00Z',
  },
  {
    id: 4, type: 'recommendation', voice_name: null,
    input_text: 'A warm, friendly narrator for children\'s educational content with an upbeat and clear delivery style.',
    result_json: JSON.stringify({ voices: ['Zephyr', 'Aoede', 'Puck'], reasoning: 'These voices have the clarity and warmth suited for children\'s content.' }),
    audio_path: null, created_at: '2026-04-25T09:15:00Z',
  },
];

test.describe('History', () => {
  test('history panel — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    // Override history route with fixture entries (registered after catch-all so it takes precedence)
    await page.route('**/api/history**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HISTORY_ENTRIES) }),
    );
    await applyDarkMode(page);
    await loadApp(page);
    await goToSection(page, 'History');
    await page.waitForTimeout(800);
    await capture(page, '17-history-panel-dark.png');
  });
});

// ---------------------------------------------------------------------------
// 9. Script Reader — Compare A/B + Audio Tags expanded
// ---------------------------------------------------------------------------
test.describe('Script Reader Extended', () => {
  test('compare A/B tab — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    await goToSection(page, 'Script Reader');
    await page.waitForTimeout(400);
    // Click the "Compare A/B" mode tab
    await page.getByRole('button', { name: /compare/i }).first().click();
    await page.waitForTimeout(500);
    await capture(page, '18-script-compare-dark.png');
  });

  test('audio tags toolbar expanded — dark mode', async ({ page }) => {
    await setupApiMocks(page);
    await applyDarkMode(page);
    await loadApp(page);
    await goToSection(page, 'Script Reader');
    await page.waitForTimeout(400);
    // Click the Audio Tags collapsible section to expand it
    await page.getByText('Audio Tags').first().click();
    await page.waitForTimeout(500);
    await capture(page, '19-audio-tags-dark.png');
  });
});
