import { test, expect, Page } from '@playwright/test';
import { setupApiMocks } from '../helpers/api-mocks';

test('bare page load', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.screenshot({ path: 'test-results/debug-bare.png', fullPage: true });
  // Just check that SOME text appears
  const body = await page.textContent('body');
  console.log('Body text length:', body?.length);
  console.log('Body first 200 chars:', body?.substring(0, 200));
  await expect(page.locator('body')).not.toBeEmpty();
});

test('with mocks: nav visible', async ({ page }) => {
  await setupApiMocks(page, { projects: [] });
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.screenshot({ path: 'test-results/debug-with-mocks.png', fullPage: true });

  const navs = await page.getByRole('navigation').all();
  console.log('Navigation elements:', navs.length);
  for (const nav of navs) {
    const label = await nav.getAttribute('aria-label');
    const visible = await nav.isVisible();
    console.log(`  nav aria-label="${label}" visible=${visible}`);
  }

  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  const isVisible = await nav.isVisible();
  console.log('Main navigation visible:', isVisible);
  
  const btns = await page.getByRole('button').all();
  console.log('Buttons:', btns.length);
});

test('with mocks + ws.close: nav visible', async ({ page }) => {
  await page.routeWebSocket('**/api/ws/progress', ws => {
    ws.close();
  });
  await page.route('**/api/**', route => {
    const method = route.request().method();
    const body = method === 'DELETE' ? '{}' : '[]';
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await page.goto('/');
  await page.waitForLoadState('load');
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  const isVisible = await nav.isVisible();
  console.log('Main navigation visible (ws.close):', isVisible);
  const body = await page.textContent('body');
  console.log('Body first 200 chars:', body?.substring(0, 200));
});

test('routeWebSocket with no-op handler: nav visible', async ({ page }) => {
  // Test if even registering routeWebSocket with exact URL causes rendering issues
  await page.routeWebSocket('ws://localhost:4000/api/ws/progress', _ws => {
    // no-op
  });
  await page.route('**/api/**', route => {
    const method = route.request().method();
    const body = method === 'DELETE' ? '{}' : '[]';
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await page.goto('/');
  await page.waitForLoadState('load');
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).first();
  const isVisible = await nav.isVisible();
  console.log('Main navigation visible (exact ws url, no-op):', isVisible);
});

