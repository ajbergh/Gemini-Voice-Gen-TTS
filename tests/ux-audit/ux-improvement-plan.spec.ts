/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * tests/ux-audit/ux-improvement-plan.spec.ts
 *
 * Playwright audit for docs/improvement-suggestions.md.
 *
 * Each test in the "improvement" groups is written as the TARGET STATE —
 * it FAILS now (feature not yet implemented) and will PASS once shipped.
 * The "Baseline" group tests existing behaviour as regression guards.
 *
 * Run:  npx playwright test tests/ux-audit/ux-improvement-plan.spec.ts
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

async function loadApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('navigation', { name: 'Main navigation' }).first().waitFor({ state: 'visible' });
}

/** Click "Script Reader" in the sidebar and wait for its section to render. */
async function openScriptReader(page: Page): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  await nav.getByRole('button', { name: 'Script Reader' }).click();
  // ScriptReaderModal renders with id="script-reader-title" when the section activates
  await page.locator('#script-reader-title').waitFor({ state: 'visible', timeout: 8000 });
}

/** Navigate to Projects, click the fixture project, then activate a workspace tab. */
async function openProjectAndTab(page: Page, tabName: string): Promise<void> {
  await goToProjects(page);
  await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();
  // Workspace tabs are role="tab", not role="button"
  await page.getByRole('tab', { name: tabName, exact: true }).click();
}

/** Open the Settings modal. */
async function openSettings(page: Page): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  await nav.getByRole('button', { name: 'Settings' }).click();
  // Inner SettingsModal has aria-labelledby="settings-title"
  await page.locator('[aria-labelledby="settings-title"]').waitFor({ state: 'visible', timeout: 6000 });
}

// ---------------------------------------------------------------------------
// Baseline — existing behaviour (regression guards, all should PASS now)
// ---------------------------------------------------------------------------

test.describe('Baseline — existing features (regression guards)', () => {

  test('carousel prev/next buttons are present and accessible', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await expect(page.getByRole('button', { name: 'Previous voice' })).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole('button', { name: 'Next voice' })).toBeVisible({ timeout: 6000 });
  });

  test('Projects list shows the fixture project', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);
    // Wait for the project list panel to settle before asserting
    await page.waitForSelector('[data-testid="project-list"], [data-testid="project-list-row"]', { timeout: 8000 }).catch(() => null);
    await expect(page.getByText(FIXTURE_PROJECT.title).first()).toBeVisible({ timeout: 6000 });
  });

  test('all 5 workspace tabs are present (role=tab)', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    // Tabs have role="tab" inside a role="tablist" in ProjectWorkspace
    for (const tab of ['Script', 'Cast', 'Review', 'Timeline', 'Export']) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible({ timeout: 4000 });
    }
  });

  test('Script Reader opens as a dialog section', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await openScriptReader(page);
    // ScriptReaderModal renders an h2 with id="script-reader-title"
    await expect(page.locator('#script-reader-title')).toBeVisible({ timeout: 6000 });
    // And a textarea for script input
    await expect(page.locator('#script-input')).toBeVisible({ timeout: 4000 });
  });

  test('Settings modal opens with tab navigation (already implemented)', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);

    // Click Settings — it's inside the sidebar nav
    const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
    await nav.getByRole('button', { name: 'Settings' }).click();

    // BottomSheet (outer) has aria-label="Settings"; SettingsModal (inner) has aria-labelledby="settings-title"
    // Both have role="dialog" — locate via the inner modal's title to avoid strict mode violation
    await page.locator('[aria-labelledby="settings-title"]').waitFor({ state: 'visible', timeout: 8000 });

    // Settings already has a tablist with ≥5 tabs (SettingsModal.tsx line 1025)
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible({ timeout: 4000 });
    const tabCount = await page.getByRole('tab').count();
    expect(tabCount).toBeGreaterThanOrEqual(5);
  });

  test('empty Projects list shows the "Create a project" message', async ({ page }) => {
    await setupApiMocks(page, { projects: [] });
    await loadApp(page);
    await goToProjects(page);
    await expect(page.getByText('Create a project to start.')).toBeVisible({ timeout: 6000 });
  });

  test('no horizontal overflow at 1440px desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    await setupApiMocks(page);
    await loadApp(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow at 390px mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupApiMocks(page);
    await loadApp(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// 1.1 — Voice Library & Discovery (target-state tests, currently FAIL)
// ---------------------------------------------------------------------------

test.describe('1.1 Voice Library & Discovery', () => {

  // 1.1a — Carousel navigation hint visible on first visit
  test('1.1a carousel shows a keyboard navigation hint on first visit', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('gemini-voice-carousel-hint-seen'));
    await setupApiMocks(page);
    await loadApp(page);

    // After shipping: a tooltip / hint element containing navigation instructions
    // appears near the carousel on the user's first visit.
    await expect(page.getByText(/← → to browse|Drag to jump|keyboard.*navigate/i)).toBeVisible({ timeout: 6000 });
  });

  // 1.1c — "Compare all three" in Casting Director results
  test('1.1c Casting Director results include a "Compare all three" action', async ({ page }) => {
    await setupApiMocks(page);
    // Override the recommend route
    await page.route('**/api/voices/recommend', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { voiceName: 'Puck', confidence: 0.95, prompt: 'Energetic narrator', traits: [] },
        { voiceName: 'Zephyr', confidence: 0.87, prompt: 'Warm guide', traits: [] },
        { voiceName: 'Charon', confidence: 0.79, prompt: 'Authoritative', traits: [] },
      ]),
    }));
    await loadApp(page);

    // Open AI Casting Director (there may be two buttons — sidebar + FilterBar — use first)
    await page.getByRole('button', { name: /AI Casting|Casting Director/i }).first().click();
    const queryBox = page.getByRole('textbox').first();
    await queryBox.fill("energetic children's narrator");
    await page.getByRole('button', { name: /Find|Search|Cast/i }).first().click();

    // After shipping: a "Compare all three" shortcut appears in the results panel
    await expect(page.getByRole('button', { name: /Compare all three/i })).toBeVisible({ timeout: 8000 });
  });

  // 1.1d — Empty favorites state
  test('1.1d empty Presets section shows a guidance message with a Browse Voices link', async ({ page }) => {
    await setupApiMocks(page, { projects: [] });
    await loadApp(page);

    const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
    await nav.getByRole('button', { name: /Presets|My Voices/i }).click();

    // After shipping: empty state message + CTA button to browse voices
    await expect(page.getByText(/Star voices you want to revisit/i)).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole('button', { name: /Browse voices/i })
      .or(page.getByRole('link', { name: /Voice Library|Browse voices/i }))).toBeVisible();
  });

  // 1.1e — "Quick preview" on voice grid cards
  test('1.1e voice cards in grid view show a Quick Preview action', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);

    // Switch to grid view using the toggle button in the FilterBar
    await page.getByRole('button', { name: /Grid view|grid/i }).click();

    // After shipping: each card exposes a "Quick preview" / "Try" button
    await expect(
      page.getByRole('button', { name: /Quick preview|Try with your text/i }).first()
    ).toBeVisible({ timeout: 6000 });
  });

});

// ---------------------------------------------------------------------------
// 1.2 — Script Reader (target-state tests, currently FAIL)
// ---------------------------------------------------------------------------

test.describe('1.2 Script Reader', () => {

  // 1.2a — Full-panel layout instead of a blocking modal
  test('1.2a Script Reader renders as a slide-in panel with main nav still reachable', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await openScriptReader(page);

    // After shipping: Script Reader is a side-panel (no modal overlay),
    // so the main navigation remains interactive.
    const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();

    // The nav must be visible and not covered by an inert/aria-hidden overlay
    await expect(nav).toBeVisible({ timeout: 4000 });
    const navAriaHidden = await nav.getAttribute('aria-hidden');
    expect(navAriaHidden).toBeNull(); // modal overlays set aria-hidden on background content

    // After shipping: the panel is NOT a blocking dialog (no aria-modal on the Script Reader container)
    const scriptPanel = page.locator('[data-testid="script-reader-panel"]');
    await expect(scriptPanel).toBeVisible({ timeout: 4000 });
  });

  // 1.2b — Word count + estimated duration live counter
  test('1.2b Script Reader shows live word count and estimated duration', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await openScriptReader(page);

    const textarea = page.locator('#script-input');
    await textarea.fill('Hello world. This is a test script to measure word count estimation.');

    // After shipping: a counter element below the textarea shows word/char count and ~duration
    await expect(page.getByText(/\d+\s*words?/i)).toBeVisible({ timeout: 4000 });
    await expect(page.getByText(/~\d+\s*s(?:ec)?|estimated.*duration/i)).toBeVisible({ timeout: 4000 });
  });

  // 1.2c — Templates dropdown (ALREADY IMPLEMENTED — regression guard)
  test('1.2c Script Reader has a Templates button with starter scripts (regression guard)', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await openScriptReader(page);

    // Templates already exists in ScriptReaderModal.tsx (line 479)
    await expect(page.getByRole('button', { name: 'Templates' })).toBeVisible({ timeout: 4000 });
  });

  // 1.2d — Audio Tags toolbar expanded on first visit
  test('1.2d Audio Tags toolbar is expanded by default on first visit', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('gemini-voice-tags-toolbar-seen'));
    await setupApiMocks(page);
    await loadApp(page);
    await openScriptReader(page);

    // AudioTagsToolbar starts collapsed (expanded=false) — after shipping it starts expanded.
    // When expanded, the tag category buttons (Style / Emotion / Sound) are visible.
    await expect(page.getByRole('button', { name: /Style|Emotion|Sound/i }).first())
      .toBeVisible({ timeout: 4000 });
  });

  // 1.2e — Save / load dialogue cast in Dialogue mode
  test('1.2e Dialogue mode allows saving a named Dialogue Cast', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await openScriptReader(page);

    // Switch to Dialogue tab inside Script Reader
    await page.getByRole('tab', { name: /Dialogue/i }).click();

    // After shipping: a "Save cast" button is present in Dialogue mode
    await expect(page.getByRole('button', { name: /Save cast|Load cast|Saved casts/i }))
      .toBeVisible({ timeout: 4000 });
  });

});

// ---------------------------------------------------------------------------
// 1.3 — Projects Workspace (target-state tests, currently FAIL)
// ---------------------------------------------------------------------------

test.describe('1.3 Projects Workspace', () => {

  // 1.3a — Tab completion indicators
  test('1.3a workspace Script tab shows a completion indicator when all segments are approved', async ({ page }) => {
    await setupApiMocks(page, {
      segments: [{ ...FIXTURE_SEGMENT, status: 'approved' }],
      takes: [{ ...FIXTURE_TAKE, status: 'approved' }],
    });
    await loadApp(page);
    await goToProjects(page);
    await page.getByRole('button', { name: new RegExp(FIXTURE_PROJECT.title) }).first().click();

    // After shipping: the Script tab shows a check/done indicator when all segments are approved.
    const scriptTab = page.getByRole('tab', { name: 'Script', exact: true });
    await expect(scriptTab).toBeVisible({ timeout: 4000 });
    // Expect a completion indicator inside or adjacent to the tab
    await expect(
      scriptTab.locator('svg').or(scriptTab.locator('[data-testid*="check"]'))
        .filter({ has: page.locator('[class*="green"], [class*="complete"], [aria-label*="complete"]') })
    ).toBeVisible({ timeout: 4000 });
  });

  // 1.3b — Segment status legend near batch render button
  test('1.3b Script tab shows a collapsible segment status legend button', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);
    await openProjectAndTab(page, 'Script');

    // After shipping: a legend icon/button near the action bar explains status badge colors
    await expect(
      page.getByRole('button', { name: /Status legend|Legend/i })
        .or(page.locator('[data-testid="status-legend-toggle"]'))
    ).toBeVisible({ timeout: 4000 });
  });

  // 1.3c — Cast profile usage count badges
  test('1.3c Cast tab profile cards show usage count (segments assigned)', async ({ page }) => {
    const castProfile = {
      id: 1, project_id: 1, name: 'Narrator', role: 'narrator',
      description: '', voice_name: 'Puck',
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    };
    await setupApiMocks(page, {
      castProfiles: [castProfile],
      segments: [{ ...FIXTURE_SEGMENT, cast_profile_id: 1 }],
    });
    await loadApp(page);
    await openProjectAndTab(page, 'Cast');

    // After shipping: "Used in 1 segment" or "Unassigned" badge on each profile card
    await expect(page.getByText(/Used in \d+ segment|Unassigned/i)).toBeVisible({ timeout: 6000 });
  });

  // 1.3e — Post-batch render summary notification
  test('1.3e batch render completion shows a summary with counts and total duration', async ({ page }) => {
    await setupApiMocks(page, {
      segments: [
        { ...FIXTURE_SEGMENT, id: 101, status: 'draft' },
        { ...FIXTURE_SEGMENT, id: 102, status: 'draft', content_hash: 'xyz' },
      ],
    });
    await page.route('**/api/projects/1/batch-render', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ job_id: 'j1', rendered: 2, failed: 0, skipped: 0, total_ms: 4500 }),
      }),
    );
    await loadApp(page);
    await openProjectAndTab(page, 'Script');

    await page.getByRole('button', { name: 'Render all' }).click();

    // After shipping: a completion summary (not just a "starting" toast) appears
    // showing final counts — "Batch complete", "rendered", and "failed" in one notification.
    await expect(
      page.getByText(/Batch complete/i)
        .or(page.locator('[role="alert"], [data-testid="batch-summary"]')
          .filter({ hasText: /rendered.*failed|failed.*rendered/i }))
    ).toBeVisible({ timeout: 10000 });
  });

});

// ---------------------------------------------------------------------------
// 1.4 — Review & QC (target-state tests, currently FAIL)
// ---------------------------------------------------------------------------

test.describe('1.4 Review & QC', () => {

  // 1.4b — Inline keyboard shortcut cheat-sheet in Review Mode (ALREADY IMPLEMENTED — regression guard)
  test('1.4b Review tab already shows a hotkey hint strip (regression guard)', async ({ page }) => {
    await setupApiMocks(page, {
      segments: [{ ...FIXTURE_SEGMENT, status: 'rendered' }],
      takes: [FIXTURE_TAKE],
    });
    await loadApp(page);
    await openProjectAndTab(page, 'Review');

    // ReviewTransport already renders hotkey hints (Space, A, F, R, N, P, M) as <kbd> elements
    // This guards that the existing hint strip stays visible after navigation
    await expect(page.locator('kbd').filter({ hasText: /Space|^A$|^F$|^R$/ }).first())
      .toBeVisible({ timeout: 6000 });
  });

  // 1.4c — QC severity chips include an icon (not color-only)
  test('1.4c QC severity chips contain an SVG icon alongside the severity label', async ({ page }) => {
    const qcIssue = {
      id: 1, project_id: 1, segment_id: 101,
      title: 'Clipping detected', description: 'Peak dBFS too high',
      severity: 'high', status: 'open',
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    };
    await setupApiMocks(page, {
      segments: [{ ...FIXTURE_SEGMENT, status: 'rendered' }],
      takes: [FIXTURE_TAKE],
      qcIssues: [qcIssue],
    });
    await loadApp(page);
    await openProjectAndTab(page, 'Review');

    // Find a QC issue row that contains "High" severity text
    const issueRow = page.locator('[data-testid="qc-issue"], .qc-issue-row')
      .or(page.getByText('Clipping detected').locator('xpath=..'));
    await expect(issueRow.first()).toBeVisible({ timeout: 6000 });

    // After shipping: the severity label has an SVG icon next to it (info/triangle/stop)
    const severityLabel = page.locator('[data-testid="qc-severity-high"]')
      .or(page.getByText(/\bHigh\b/i).locator('xpath=..'));
    await expect(severityLabel.first().locator('svg')).toBeVisible({ timeout: 4000 });
  });

});

// ---------------------------------------------------------------------------
// 1.5 — Global & Cross-Cutting (target-state tests, currently FAIL)
// ---------------------------------------------------------------------------

test.describe('1.5 Global & Cross-Cutting', () => {

  // 1.5a — Onboarding tour includes a Projects pipeline chapter
  test('1.5a onboarding tour contains a Projects/production pipeline step', async ({ page }) => {
    await setupApiMocks(page);
    await page.addInitScript(() => localStorage.removeItem('gemini-voice-onboarding-complete'));
    await loadApp(page);

    // Tour appears on first visit
    const tourContainer = page.locator('[data-testid="onboarding-tour"]')
      .or(page.getByRole('dialog', { name: /tour|welcome/i }));
    await expect(tourContainer).toBeVisible({ timeout: 6000 });

    // Advance through steps looking for a Projects-related step
    const nextBtn = tourContainer.getByRole('button', { name: /Next|Continue/i });
    let foundProjectsStep = false;
    for (let i = 0; i < 14; i++) {
      const bodyText = await page.locator('body').textContent() ?? '';
      if (/projects.*pipeline|batch render|section.*segment|production workflow/i.test(bodyText)) {
        foundProjectsStep = true;
        break;
      }
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(250);
      } else {
        break;
      }
    }
    expect(foundProjectsStep, 'Tour must include a Projects pipeline step').toBe(true);
  });

  // 1.5b — ⌘K discovery hint in sidebar
  test('1.5b sidebar shows a ⌘K / Ctrl+K command palette hint', async ({ page }) => {
    await setupApiMocks(page);
    await loadApp(page);

    const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
    // After shipping: a visible ⌘K chip in the sidebar bottom area
    await expect(
      nav.getByText(/⌘K|Ctrl\+K/i)
        .or(nav.locator('[data-testid="cmd-palette-hint"]'))
    ).toBeVisible({ timeout: 4000 });
  });

  // 1.5d — Failed render shows a persistent, dismissible error toast
  test('1.5d failed render shows a persistent error toast with a dismiss button', async ({ page }) => {
    await setupApiMocks(page, {
      segments: [{ ...FIXTURE_SEGMENT, status: 'draft' }],
    });
    // Make the render endpoint return a 500
    await page.route('**/api/projects/1/segments/101/render', route =>
      route.fulfill({
        status: 500, contentType: 'application/json',
        body: JSON.stringify({ error: 'API quota exceeded' }),
      }),
    );
    await loadApp(page);
    await openProjectAndTab(page, 'Script');

    // Click the render button on the draft segment
    await page.getByRole('button', { name: /^Render$/i }).first().click();

    // After shipping: a persistent error alert/toast appears
    const errorToast = page.locator('[role="alert"]').filter({ hasText: /error|failed|quota/i })
      .or(page.locator('[data-testid="error-toast"]'));
    await expect(errorToast).toBeVisible({ timeout: 8000 });

    // It must have a dismiss/close button (persistent — not auto-dismissing)
    await expect(errorToast.getByRole('button', { name: /Dismiss|Close|×/i })).toBeVisible({ timeout: 4000 });

    // Still visible 4 s later — confirms it did NOT auto-dismiss
    await page.waitForTimeout(4000);
    await expect(errorToast).toBeVisible();
  });

  // 1.5e — Empty Projects list shows template preview cards
  test('1.5e empty Projects list shows template preview cards as a rich empty state', async ({ page }) => {
    await setupApiMocks(page, { projects: [] });
    await loadApp(page);
    await goToProjects(page);

    // Baseline text is already there — after shipping, template cards are added
    await expect(page.getByText(/Create a project to start|Get started/i)).toBeVisible({ timeout: 6000 });

    // After shipping: named template cards (Audiobook / Podcast / Voiceover) are visible
    await expect(
      page.locator('[data-testid="empty-state-template"], .template-card').first()
        .or(page.getByText(/Audiobook/i).and(page.locator('[class*="card"], [class*="template"]')).first())
    ).toBeVisible({ timeout: 4000 });
  });

});
