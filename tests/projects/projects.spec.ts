/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * tests/projects/projects.spec.ts
 *
 * End-to-end tests for the Projects workspace covering:
 *   - Navigation to the Projects section
 *   - Phase 1 & 2 UI element presence
 *   - Project creation
 *   - Workspace tab switching
 *   - Tab-aware action bar (Script + More menu)
 *   - Project settings drawer (open / close / Escape)
 *   - Review tab: rendered segment, play button, audio request
 */

import { test, expect, Page } from '@playwright/test';
import {
  setupApiMocks,
  goToProjects,
  FIXTURE_PROJECT,
  FIXTURE_SEGMENT,
  FIXTURE_TAKE,
} from '../helpers/api-mocks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to app and wait for it to be ready. */
async function loadApp(page: Page): Promise<void> {
  await page.goto('/');
  // Wait for all initial API calls to settle so React stops re-rendering the nav.
  await page.waitForLoadState('networkidle');
  // Then confirm the nav is present and stable.
  await page.getByRole('navigation', { name: 'Main navigation' }).first().waitFor({ state: 'visible' });
}

/** Navigate to Projects and wait for the project list to load. */
async function openProjectsSection(page: Page): Promise<void> {
  await goToProjects(page);
  // Wait for either the project list or the empty state to appear
  await page.waitForSelector('[data-testid="project-list"], text=Create a project to start', { timeout: 8_000 });
}

// ---------------------------------------------------------------------------
// 1. Navigation
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test('clicking Projects in sidebar shows the workspace', async ({ page }) => {
    await setupApiMocks(page, { projects: [] });
    await loadApp(page);

    await goToProjects(page);

    // The workspace renders — empty state message should appear
    await expect(page.getByText('Create a project to start.')).toBeVisible();
  });

  test('Projects sidebar button is marked as current page when active', async ({ page }) => {
    await setupApiMocks(page, { projects: [] });
    await loadApp(page);
    await goToProjects(page);

    const btn = page.getByRole('button', { name: 'Projects' }).first();
    await expect(btn).toHaveAttribute('aria-current', 'page');
  });
});

// ---------------------------------------------------------------------------
// 2. Project List Panel (Phase 2)
// ---------------------------------------------------------------------------

test.describe('Project list panel (Phase 2)', () => {
  test('shows search input, sort select, and New Project button', async ({ page }) => {
    await setupApiMocks(page, { projects: [FIXTURE_PROJECT] });
    await loadApp(page);
    await goToProjects(page);

    // Search field
    await expect(page.getByPlaceholder('Search projects…')).toBeVisible();

    // Sort select
    await expect(page.getByRole('combobox', { name: /sort/i })).toBeVisible();

    // New project button
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
  });

  test('project appears in the list after load', async ({ page }) => {
    await setupApiMocks(page, { projects: [FIXTURE_PROJECT] });
    await loadApp(page);
    await goToProjects(page);

    await expect(page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first()).toBeVisible();
  });

  test('search filters project list', async ({ page }) => {
    const second = { ...FIXTURE_PROJECT, id: 2, title: 'My Podcast Series' };
    await setupApiMocks(page, { projects: [FIXTURE_PROJECT, second] });
    await loadApp(page);
    await goToProjects(page);

    await expect(page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(second.title) }).first()).toBeVisible();

    await page.getByPlaceholder('Search projects…').fill('Podcast');
    await expect(page.getByRole('button', { name: new RegExp(second.title) }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first()).not.toBeVisible();
  });

  test('shows a hidden-current-project banner when filters hide the selected project', async ({ page }) => {
    const second = { ...FIXTURE_PROJECT, id: 2, title: 'My Podcast Series', kind: 'podcast' };
    await setupApiMocks(page, { projects: [FIXTURE_PROJECT, second] });
    await loadApp(page);
    await goToProjects(page);

    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();
    await page.getByPlaceholder('Search projects…').fill('Podcast');

    await expect(page.getByText('Current project is hidden by filters.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first()).toBeVisible();
  });

  test('saved views filter blocked projects', async ({ page }) => {
    const blockedProject = {
      ...FIXTURE_PROJECT,
      id: 2,
      title: 'Blocked Training Module',
      kind: 'training',
      updated_at: '2025-01-02T00:00:00Z',
    };
    const blockedSegment = {
      ...FIXTURE_SEGMENT,
      id: 202,
      project_id: 2,
      status: 'draft',
      content_hash: 'draft-202',
    };

    await setupApiMocks(page, {
      projects: [FIXTURE_PROJECT, blockedProject],
      segments: [{ ...FIXTURE_SEGMENT, status: 'approved' }, blockedSegment],
      takes: [FIXTURE_TAKE],
    });
    await loadApp(page);
    await goToProjects(page);

    await page.getByRole('button', { name: 'Blocked' }).click();

    await expect(page.getByRole('button', { name: new RegExp(blockedProject.title) }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first()).not.toBeVisible();
  });

  test('New Project button expands the create form', async ({ page }) => {
    await setupApiMocks(page, { projects: [] });
    await loadApp(page);
    await goToProjects(page);

    await page.getByRole('button', { name: /new project/i }).click();

    // Title input appears
    await expect(page.getByPlaceholder(/title|project name/i).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Project creation
// ---------------------------------------------------------------------------

test.describe('Project creation', () => {
  test('creating a project sends POST /api/projects and shows it in the list', async ({ page }) => {
    let createCalled = false;
    await setupApiMocks(page, { projects: [] });

    // Override the POST to track the call and return a new project
    await page.route('**/api/projects', async route => {
      if (route.request().method() === 'POST') {
        createCalled = true;
        const body = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            ...FIXTURE_PROJECT,
            id: 99,
            title: body.title ?? 'New Project',
            kind: body.kind ?? 'podcast',
          }),
        });
      } else {
        // After creation, list includes the new project
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createCalled
            ? [{ ...FIXTURE_PROJECT, id: 99, title: 'My New Podcast', kind: 'podcast' }]
            : []),
        });
      }
    });

    await loadApp(page);
    await goToProjects(page);

    // Open create form
    await page.getByRole('button', { name: /new project/i }).click();

    // Fill title
    await page.getByPlaceholder(/title|project name/i).first().fill('My New Podcast');

    // Submit
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    expect(createCalled).toBe(true);
  });

  test('create and import opens the script import flow after project creation', async ({ page }) => {
    await setupApiMocks(page, { projects: [] });
    await loadApp(page);
    await goToProjects(page);

    await page.getByRole('button', { name: /new project/i }).click();
    await page.getByPlaceholder('Project title').fill('Imported Script Project');
    await page.getByRole('button', { name: 'Create and import script' }).click();

    await expect(page.getByText('Import from text')).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. Project selection & header (Phase 2)
// ---------------------------------------------------------------------------

test.describe('Project header (Phase 2)', () => {
  test('selecting a project shows the project title', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);

    // Project should auto-select (or click it)
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    await expect(
      page.getByRole('heading', { name: FIXTURE_PROJECT.title }).or(
        page.locator('h1, h2, h3').filter({ hasText: FIXTURE_PROJECT.title }).first()
      )
    ).toBeVisible();
  });

  test('stage trail shows all 5 stages', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    const stageTrail = page.getByTestId('project-stage-trail');
    for (const stage of ['Scripted', 'Cast', 'Rendered', 'Reviewed', 'Export ready']) {
      await expect(stageTrail.getByText(stage)).toBeVisible();
    }
  });

  test('empty project health next action opens import', async ({ page }) => {
    await setupApiMocks(page, { segments: [], takes: [] });
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    await page.getByRole('button', { name: 'Import script' }).click();

    await expect(page.getByText('Import from text')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Workspace tabs
// ---------------------------------------------------------------------------

test.describe('Workspace tabs', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();
    // Wait for tabs to appear
    await page.getByRole('tab', { name: 'Script' }).waitFor({ state: 'visible' });
  });

  for (const tabName of ['Script', 'Cast', 'Review', 'Timeline', 'Export']) {
    test(`clicking ${tabName} tab activates it`, async ({ page }) => {
      const tab = page.getByRole('tab', { name: tabName });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    });
  }
});

// ---------------------------------------------------------------------------
// 6. Tab-aware action bar (Phase 2)
// ---------------------------------------------------------------------------

test.describe('Action bar (Phase 2)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();
    await page.getByRole('tab', { name: 'Script' }).waitFor({ state: 'visible' });
  });

  test('Script tab shows Prep, Import, and Render all buttons', async ({ page }) => {
    // Script tab should already be active
    await expect(page.getByRole('button', { name: /prep/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /import/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /render all/i })).toBeVisible();
  });

  test('More button opens overflow menu with Project Settings, Dictionaries, Archive', async ({ page }) => {
    await page.getByRole('button', { name: 'More actions' }).click();

    await expect(page.getByRole('button', { name: /project settings/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dictionaries/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /archive project/i })).toBeVisible();
  });

  test('switching to Cast tab hides Script-only buttons', async ({ page }) => {
    await page.getByRole('tab', { name: 'Cast' }).click();

    await expect(page.getByRole('button', { name: /render all/i })).not.toBeVisible();
  });

  test('More button still shows on non-Script tabs', async ({ page }) => {
    await page.getByRole('tab', { name: 'Cast' }).click();
    await expect(page.getByRole('button', { name: 'More actions' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Project settings drawer (Phase 2)
// ---------------------------------------------------------------------------

test.describe('Settings drawer (Phase 2)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();
    await page.getByRole('tab', { name: 'Script' }).waitFor({ state: 'visible' });
  });

  async function openSettingsDrawer(page: Page) {
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('button', { name: /project settings/i }).click();
  }

  test('opening settings from More menu shows the drawer', async ({ page }) => {
    await openSettingsDrawer(page);

    await expect(
      page.getByRole('dialog', { name: /settings for/i })
    ).toBeVisible();
  });

  test('pressing Escape closes the settings drawer', async ({ page }) => {
    await openSettingsDrawer(page);
    // Verify it opened
    await expect(page.getByText('Project Settings').first()).toBeVisible();

    await page.keyboard.press('Escape');

    // Drawer should unmount — the heading disappears
    await expect(page.getByText('Project Settings').first()).not.toBeVisible({ timeout: 3_000 });
  });

  test('clicking the close button in the drawer closes it', async ({ page }) => {
    await openSettingsDrawer(page);
    await expect(page.getByText('Project Settings').first()).toBeVisible();

    // Close button inside the drawer
    await page.getByRole('button', { name: /close/i }).last().click();

    await expect(page.getByText('Project Settings').first()).not.toBeVisible({ timeout: 3_000 });
  });

  test('opening settings does not shift script content off screen', async ({ page }) => {
    // Script tab content is still visible while drawer is open
    const scriptTabPanel = page.locator('#project-panel-script');
    await expect(scriptTabPanel.getByRole('heading', { name: 'Sections & Segments' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: 'More actions' })).toBeVisible();
    await openSettingsDrawer(page);
    await expect(scriptTabPanel.getByRole('heading', { name: 'Sections & Segments' })).toBeVisible();
    const boxAfter = await scriptTabPanel.boundingBox();

    // Panel should remain visible and usable while the drawer overlays the workspace.
    if (boxAfter) {
      expect(boxAfter.y + boxAfter.height).toBeGreaterThan(0);
      expect(boxAfter.y).toBeLessThan(await page.evaluate(() => window.innerHeight));
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Review tab — audio playback
// ---------------------------------------------------------------------------

test.describe('Review tab — audio playback', () => {
  test('Review tab shows rendered segment with play button', async ({ page }) => {
    await setupApiMocks(page, {
      segments: [{ ...FIXTURE_SEGMENT, status: 'rendered' }],
      takes: [FIXTURE_TAKE],
    });
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    // Switch to Review tab
    await page.getByRole('tab', { name: 'Review' }).click();

    // Review mode should load the segment
    await expect(page.getByRole('button', { name: new RegExp(FIXTURE_SEGMENT.speaker_label) }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('play button triggers take audio request when take has audio_path', async ({ page }) => {
    const audioRequests: string[] = [];

    await setupApiMocks(page, {
      segments: [{ ...FIXTURE_SEGMENT, status: 'rendered' }],
      takes: [FIXTURE_TAKE],
    });

    // Capture audio requests
    page.on('request', req => {
      if (req.url().includes('/api/audio/') || /\/api\/projects\/\d+\/segments\/\d+\/takes\/\d+\/audio$/.test(req.url())) {
        audioRequests.push(req.url());
      }
    });

    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    await page.getByRole('tab', { name: 'Review' }).click();
    await expect(page.getByRole('button', { name: new RegExp(FIXTURE_SEGMENT.speaker_label) }).first()).toBeVisible({ timeout: 8_000 });

    // Click the play button — it should be the first visible play/▶ button in Review
    const playBtn = page.getByRole('button', { name: /play/i }).first();
    await expect(playBtn).toBeEnabled({ timeout: 5_000 });
    await playBtn.click();

    // The take audio request should have been made
    await expect(async () => {
      expect(audioRequests.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });

    // The URL should identify the take that was played
    const encodedPath = encodeURIComponent(FIXTURE_TAKE.audio_path);
    expect(audioRequests.some(u => u.includes(encodedPath) || u.endsWith(`/takes/${FIXTURE_TAKE.id}/audio`))).toBe(true);
  });

  test('Review tab shows no-content state when project has no segments', async ({ page }) => {
    await setupApiMocks(page, { segments: [], takes: [] });
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    await page.getByRole('tab', { name: 'Review' }).click();

    // Should show empty state (no play controls)
    await expect(page.getByRole('button', { name: /play/i })).not.toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// 9. Project list — archive flow
// ---------------------------------------------------------------------------

test.describe('Archive project flow', () => {
  test('Archive Project in More menu calls DELETE /api/projects/:id', async ({ page }) => {
    let archiveCalled = false;

    await setupApiMocks(page);
    await page.route('**/api/projects/1', async route => {
      if (route.request().method() === 'DELETE') {
        archiveCalled = true;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'archived' }) });
        return;
      }
      await route.fallback();
    });

    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();
    await page.getByRole('tab', { name: 'Script' }).waitFor();

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('button', { name: /archive project/i }).click();

    // Allow async call to complete
    await page.waitForTimeout(500);
    expect(archiveCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Mobile projects redesign (Phase 4)
// ---------------------------------------------------------------------------

test.describe('Mobile projects redesign (Phase 4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  async function openMobileProjects(page: Page) {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);
    await page.getByTestId('mobile-project-switcher-trigger').waitFor({ state: 'visible' });
  }

  async function expectNoHorizontalOverflow(page: Page) {
    const hasOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1;
    });
    expect(hasOverflow).toBe(false);
  }

  test('uses global bottom nav and in-content workspace tabs on phone', async ({ page }) => {
    await openMobileProjects(page);

    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Project workspace tabs' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Script' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByTestId('mobile-project-action-bar')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('opens and closes the mobile project switcher sheet', async ({ page }) => {
    await openMobileProjects(page);

    await page.getByTestId('mobile-project-switcher-trigger').click();
    const switcher = page.getByRole('dialog', { name: 'Switch project' });
    await expect(switcher).toBeVisible();
    await expect(switcher.getByPlaceholder('Search projects…')).toBeVisible();
    await expect(switcher.getByRole('button', { name: /new project/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await switcher.getByRole('button', { name: 'Close project switcher' }).click();
    await expect(switcher).not.toBeVisible();
  });

  test('opens import as a focused mobile sheet with preview action', async ({ page }) => {
    await openMobileProjects(page);

    await page.getByTestId('mobile-project-action-bar').getByRole('button', { name: 'Import' }).click();
    const importSheet = page.getByRole('dialog', { name: 'Import script text' });
    await expect(importSheet).toBeVisible();
    await importSheet.getByPlaceholder(/Chapter One/).fill('# Chapter One\n\nThe story begins here.');
    await expect(importSheet.getByRole('button', { name: 'Preview' })).toBeEnabled();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press('Escape');
    await expect(importSheet).not.toBeVisible();
  });

  test('shows export readiness on phone without horizontal overflow', async ({ page }) => {
    await openMobileProjects(page);

    await page.getByRole('tab', { name: 'Export' }).click();
    await expect(page.getByRole('heading', { name: 'Export Project' })).toBeVisible();
    await expect(page.getByText(/rendered, 0 approved/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
