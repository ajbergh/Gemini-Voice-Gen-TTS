/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * tests/helpers/api-mocks.ts
 *
 * Shared Playwright route mocks for all /api/* calls.
 * Call `setupApiMocks(page)` at the start of each test to avoid hitting
 * the real backend. Additional routes can be added per-test with
 * `page.route()` before calling `setupApiMocks` (Playwright uses the
 * last registered route that matches first).
 */

import { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Minimal WAV: RIFF header for 0 PCM samples (44 bytes).
// ---------------------------------------------------------------------------
function silentWav(): Buffer {
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36, 4);          // file size - 8
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);         // PCM chunk size
  buf.writeUInt16LE(1, 20);          // PCM format
  buf.writeUInt16LE(1, 22);          // mono
  buf.writeUInt32LE(24000, 24);      // sample rate 24 kHz
  buf.writeUInt32LE(48000, 28);      // byte rate
  buf.writeUInt16LE(2, 32);          // block align
  buf.writeUInt16LE(16, 34);         // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(0, 40);          // 0 data bytes
  return buf;
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
export const FIXTURE_PROJECT = {
  id: 1,
  title: 'Test Audiobook',
  kind: 'audiobook',
  status: 'active',
  default_voice_name: 'Puck',
  default_language_code: 'en',
  default_provider: 'gemini',
  default_model: 'gemini-2.5-pro-preview-tts',
  fallback_provider: '',
  fallback_model: '',
  default_style_id: null,
  description: '',
  client_id: null,
  metadata_json: '{}',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

export const FIXTURE_SEGMENT = {
  id: 101,
  project_id: 1,
  section_id: null,
  title: '',
  script_text: 'Hello world, this is a test segment.',
  speaker_label: 'Narrator',
  status: 'rendered',
  voice_name: 'Puck',
  language_code: 'en',
  provider: 'gemini',
  model: 'gemini-2.5-pro-preview-tts',
  render_job_id: null,
  style_id: null,
  content_hash: 'abc123',
  sort_order: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

export const FIXTURE_TAKE = {
  id: 201,
  project_id: 1,
  segment_id: 101,
  take_number: 1,
  status: 'rendered',
  audio_path: 'cache/test-take-201.pcm',
  content_hash: 'abc123',
  duration_ms: 1500,
  provider: 'gemini',
  model: 'gemini-2.5-pro-preview-tts',
  created_at: '2025-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------
export async function setupApiMocks(page: Page, options: {
  projects?: object[];
  segments?: object[];
  takes?: object[];
  sections?: object[];
  castProfiles?: object[];
  qcIssues?: object[];
} = {}): Promise<void> {
  const {
    projects = [FIXTURE_PROJECT],
    segments = [FIXTURE_SEGMENT],
    takes = [FIXTURE_TAKE],
    sections = [],
    castProfiles = [],
    qcIssues = [],
  } = options;

  const json = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });

  await page.addInitScript(() => {
    localStorage.setItem('gemini-voice-onboarding-complete', 'true');
  });

  // --------------------------------------------------------------------------
  // Mock the WebSocket progress endpoint so the app considers itself
  // "connected" and does NOT enter the 3-second reconnect loop.
  // The reconnect loop triggers repeated state updates that detach nav buttons
  // in the middle of a Playwright click attempt.
  // --------------------------------------------------------------------------
  await page.routeWebSocket('**/api/ws/progress', _ws => {
    // Accept the connection and keep it open silently (no messages sent).
    // The page's ws.onopen fires → app sets status = 'connected' → stable sidebar.
  });

  // --------------------------------------------------------------------------
  // Catch-all: any /api/ route not handled below returns an empty-ish response
  // so nothing leaks to the real network (which would cause re-render loops).
  // Must be registered FIRST so that specific routes registered later take
  // precedence (Playwright processes the most-recently-registered match first).
  // --------------------------------------------------------------------------
  await page.route('**/api/**', route => {
    const method = route.request().method();
    // Default: empty array / object depending on method
    const body = method === 'DELETE' ? '{}' : '[]';
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });

  // Config — app-level key-value pairs
  await page.route('**/api/config', route => route.fulfill(json({})));

  // Presets
  await page.route('**/api/presets', route => route.fulfill(json([])));

  // Favorites
  await page.route('**/api/favorites**', route => route.fulfill(json([])));

  // Voices
  await page.route('**/api/voices**', route => route.fulfill(json([])));

  // Keys / providers
  await page.route('**/api/keys**', route => route.fulfill(json([])));
  await page.route('**/api/providers**', route => route.fulfill(json([])));

  // Styles
  await page.route('**/api/styles**', route => route.fulfill(json([])));

  // Export profiles
  await page.route('**/api/export-profiles**', route => route.fulfill(json([])));

  // Clients
  await page.route('**/api/clients**', route => route.fulfill(json([])));

  // Jobs / history
  await page.route('**/api/jobs**', route => route.fulfill(json([])));
  await page.route('**/api/history**', route => route.fulfill(json({ items: [], total: 0 })));

  // Projects list + create
  await page.route('**/api/projects', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill(json(projects));
    }
    return route.fulfill(json({ ...FIXTURE_PROJECT, id: 99, title: 'New Project', kind: 'podcast' }));
  });

  await page.route('**/api/projects/summary', route => route.fulfill(json(projects.map(project => ({
    project_id: (project as any).id,
    section_count: sections.filter((section: any) => section.project_id === (project as any).id).length,
    segment_count: segments.filter((segment: any) => segment.project_id === (project as any).id).length,
    rendered_count: segments.filter((segment: any) => segment.project_id === (project as any).id && ['rendered', 'approved', 'locked'].includes(segment.status)).length,
    approved_count: segments.filter((segment: any) => segment.project_id === (project as any).id && segment.status === 'approved').length,
    open_qc_count: qcIssues.filter((issue: any) => issue.project_id === (project as any).id && issue.status === 'open').length,
    updated_at: (project as any).updated_at,
  })))));

  // Single project
  await page.route('**/api/projects/1', route => route.fulfill(json(FIXTURE_PROJECT)));
  await page.route('**/api/projects/99', route => route.fulfill(json({ ...FIXTURE_PROJECT, id: 99 })));

  // Sections
  await page.route('**/api/projects/1/sections**', route => route.fulfill(json(sections)));
  await page.route('**/api/projects/99/sections**', route => route.fulfill(json([])));

  // Segments
  await page.route('**/api/projects/1/segments', route => {
    if (route.request().method() === 'GET') return route.fulfill(json(segments));
    return route.fulfill(json({ ...FIXTURE_SEGMENT, id: 999 }));
  });
  await page.route('**/api/projects/99/segments**', route => route.fulfill(json([])));

  await page.route('**/api/projects/1/import/preview', route => route.fulfill(json({
    sections: [{ title: 'Chapter One', kind: 'chapter', segments: [{ script_text: 'The story begins here.' }] }],
    unsectioned_segments: [],
    section_count: 1,
    segment_count: 1,
  })));

  // QC issues
  await page.route('**/api/projects/1/qc**', route => route.fulfill(json(qcIssues)));

  // Takes for segment 101
  await page.route('**/api/projects/1/segments/101/takes**', route => route.fulfill(json(takes)));
  await page.route('**/api/projects/1/segments/101/takes/*/audio', route =>
    route.fulfill(json({ audioBase64: Buffer.alloc(480).toString('base64') })),
  );

  // Cast profiles
  await page.route('**/api/cast**', route => route.fulfill(json(castProfiles)));

  // Pronunciation / dictionaries
  await page.route('**/api/dictionaries**', route => route.fulfill(json([])));
  await page.route('**/api/projects/*/pronunciation**', route => route.fulfill(json([])));

  // Audio file — return a minimal silent WAV
  await page.route('**/api/audio/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: silentWav(),
    }),
  );
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/** Click the "Projects" sidebar button to navigate to the Projects workspace. */
export async function goToProjects(page: Page): Promise<void> {
  // Scope to the main navigation so we match the sidebar button uniquely.
  // At 1280×720 the desktop <aside role="navigation"> renders; mobile bottom-nav also
  // has aria-label buttons, so .first() gives us the sidebar (renders earlier in DOM).
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  await nav.getByRole('button', { name: 'Projects' }).click();
}
