/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = path.resolve('output/playwright/projects-ui-audit');

const project = {
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
  description: 'A launch-readiness audiobook workspace.',
  client_id: null,
  metadata_json: '{}',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-29T16:00:00Z',
};

const segment = {
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
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-29T16:00:00Z',
};

const take = {
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
  created_at: '2026-04-29T16:00:00Z',
};

function json(data) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

async function setupMocks(page) {
  await page.addInitScript(() => {
    localStorage.setItem('gemini-voice-onboarding-complete', 'true');
  });

  await page.routeWebSocket('**/api/ws/progress', () => {});

  await page.route('**/api/**', route => {
    const method = route.request().method();
    return route.fulfill(json(method === 'DELETE' ? {} : []));
  });

  await page.route('**/api/config', route => route.fulfill(json({})));
  await page.route('**/api/presets', route => route.fulfill(json([])));
  await page.route('**/api/favorites**', route => route.fulfill(json([])));
  await page.route('**/api/voices**', route => route.fulfill(json([])));
  await page.route('**/api/keys**', route => route.fulfill(json([])));
  await page.route('**/api/providers**', route => route.fulfill(json([])));
  await page.route('**/api/styles**', route => route.fulfill(json([])));
  await page.route('**/api/export-profiles**', route => route.fulfill(json([])));
  await page.route('**/api/clients**', route => route.fulfill(json([])));
  await page.route('**/api/jobs**', route => route.fulfill(json([])));
  await page.route('**/api/history**', route => route.fulfill(json({ items: [], total: 0 })));

  await page.route('**/api/projects', route => route.fulfill(json([project])));
  await page.route('**/api/projects/summary', route => route.fulfill(json([{
    project_id: 1,
    section_count: 0,
    segment_count: 1,
    rendered_count: 1,
    approved_count: 0,
    open_qc_count: 0,
    updated_at: project.updated_at,
  }])));
  await page.route('**/api/projects/1', route => route.fulfill(json(project)));
  await page.route('**/api/projects/1/sections**', route => route.fulfill(json([])));
  await page.route('**/api/projects/1/segments', route => route.fulfill(json([segment])));
  await page.route('**/api/projects/1/segments/101/takes**', route => route.fulfill(json([take])));
  await page.route('**/api/projects/1/segments/101/takes/*/audio', route =>
    route.fulfill(json({ audioBase64: Buffer.alloc(480).toString('base64') })),
  );
  await page.route('**/api/projects/1/qc**', route => route.fulfill(json([])));
  await page.route('**/api/cast**', route => route.fulfill(json([])));
  await page.route('**/api/dictionaries**', route => route.fulfill(json([])));
  await page.route('**/api/projects/*/pronunciation**', route => route.fulfill(json([])));
  await page.route('**/api/projects/1/import/preview', route => route.fulfill(json({
    sections: [{ title: 'Chapter One', kind: 'chapter', segments: [{ script_text: 'The story begins here.' }] }],
    unsectioned_segments: [],
    section_count: 1,
    segment_count: 1,
  })));
}

async function openProjects(page) {
  await setupMocks(page);
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Projects' }).first().click();
  if ((page.viewportSize()?.width ?? 1440) < 640) {
    await page.getByTestId('mobile-project-switcher-trigger').waitFor({ state: 'visible' });
  } else {
    await page.waitForSelector('[data-testid="project-list"]');
    await page.getByRole('button', { name: new RegExp(project.title) }).first().click();
  }
  await page.getByRole('tab', { name: 'Script' }).waitFor({ state: 'visible' });
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  if (overflow.doc > overflow.viewport + 1 || overflow.body > overflow.viewport + 1) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(overflow)}`);
  }
}

async function capture(page, fileName) {
  await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: true });
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await openProjects(desktop);
    await expectNoHorizontalOverflow(desktop, 'desktop overview');
    await capture(desktop, 'desktop-overview.png');
    await desktop.close();

    const tablet = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await openProjects(tablet);
    await expectNoHorizontalOverflow(tablet, 'tablet overview');
    await capture(tablet, 'tablet-overview.png');
    await tablet.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openProjects(mobile);
    await mobile.getByTestId('mobile-project-switcher-trigger').waitFor({ state: 'visible' });
    await expectNoHorizontalOverflow(mobile, 'mobile overview');
    await capture(mobile, 'mobile-overview.png');

    await mobile.getByTestId('mobile-project-action-bar').getByRole('button', { name: 'Import' }).click();
    const importSheet = mobile.getByRole('dialog', { name: 'Import script text' });
    await importSheet.waitFor({ state: 'visible' });
    await capture(mobile, 'mobile-import-sheet.png');
    await mobile.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await importSheet.waitFor({ state: 'hidden' });

    await mobile.getByRole('tab', { name: 'Export' }).click();
    await mobile.getByRole('heading', { name: 'Export Project' }).waitFor({ state: 'visible' });
    await expectNoHorizontalOverflow(mobile, 'mobile export');
    await capture(mobile, 'mobile-export-tab.png');
    await mobile.close();
  } finally {
    await browser.close();
  }

  console.log(`Projects UI audit complete: ${OUT_DIR}`);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
