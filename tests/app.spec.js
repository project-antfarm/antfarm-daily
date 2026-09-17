import { test, expect } from '@playwright/test';

async function addItem(page, list, text) {
  const input = page.locator(list === 'priority' ? '#priority-input' : '#task-input');
  await input.focus();
  await input.fill(text);
  await input.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('empty state shows a human-readable date with no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.reload();
  await expect(page.locator('#today-date')).not.toBeEmpty();
  await expect(page.locator('#priorities-empty')).toBeVisible();
  await expect(page.locator('#tasks-empty')).toBeVisible();
  expect(errors).toHaveLength(0);
});

test('adds a priority and a task', async ({ page }) => {
  await addItem(page, 'priority', 'Ship the PR');
  await addItem(page, 'task', 'Reply to emails');
  await expect(page.locator('#priorities-list .item')).toHaveCount(1);
  await expect(page.locator('#tasks-list .item')).toHaveCount(1);
  await expect(page.locator('#priorities-list .item-text')).toHaveText('Ship the PR');
  await expect(page.locator('#tasks-list .item-text')).toHaveText('Reply to emails');
});

test('a 4th priority is prevented with a visible message, not a silent drop or an error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await addItem(page, 'priority', 'One');
  await addItem(page, 'priority', 'Two');
  await addItem(page, 'priority', 'Three');
  await expect(page.locator('#priorities-list .item')).toHaveCount(3);
  await expect(page.locator('#priority-limit-msg')).toBeVisible();
  await expect(page.locator('#priority-input')).toBeDisabled();
  expect(errors).toHaveLength(0);
});

test('toggles completion on and off, distinct beyond color', async ({ page }) => {
  await addItem(page, 'task', 'Water the plants');
  const item = page.locator('#tasks-list .item').first();
  const toggle = item.locator('.item-toggle');

  await toggle.click();
  await expect(item).toHaveClass(/is-complete/);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(item.locator('.item-check')).toHaveText('✓');

  await toggle.click();
  await expect(item).not.toHaveClass(/is-complete/);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(item.locator('.item-check')).toHaveText('');
});

test('deleting requires a confirm step; dismissing keeps the item', async ({ page }) => {
  await addItem(page, 'task', 'Temporary task');

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#tasks-list .item-delete').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(1);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#tasks-list .item-delete').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);
});

test('state survives a reload with no data loss', async ({ page }) => {
  await addItem(page, 'priority', 'Persisted priority');
  await addItem(page, 'task', 'Persisted task');
  await addItem(page, 'task', 'Completed task');
  await page.locator('#tasks-list .item', { hasText: 'Completed task' }).locator('.item-toggle').click();

  await page.reload();

  await expect(page.locator('#priorities-list .item')).toHaveCount(1);
  await expect(page.locator('#tasks-list .item')).toHaveCount(2);
  await expect(page.locator('#tasks-list .item', { hasText: 'Completed task' })).toHaveClass(/is-complete/);
  await expect(page.locator('#tasks-list .item', { hasText: 'Persisted task' })).not.toHaveClass(/is-complete/);
});

test('add, toggle and delete are all keyboard-operable with visible focus', async ({ page }) => {
  await page.locator('#task-input').focus();
  await page.keyboard.type('Keyboard task');
  await page.keyboard.press('Enter');
  await expect(page.locator('#tasks-list .item')).toHaveCount(1);

  const toggle = page.locator('#tasks-list .item-toggle');
  await toggle.focus();
  const outline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#tasks-list .item')).toHaveClass(/is-complete/);

  const del = page.locator('#tasks-list .item-delete');
  await del.focus();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Enter');
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);
});

test('no horizontal scroll at a 360px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves');
  await addItem(page, 'task', 'Another moderately long task description to check wrapping');
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(fits).toBe(true);
});

test('captures screenshots of a populated day at mobile and desktop widths', async ({ page }) => {
  await addItem(page, 'priority', 'Ship the daily planner PR');
  await addItem(page, 'priority', 'Review open issues');
  await addItem(page, 'task', 'Reply to emails');
  await addItem(page, 'task', 'Water the office plants');
  await page.locator('#tasks-list .item').first().locator('.item-toggle').click();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: 'screenshots/mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'screenshots/desktop-1280.png' });
});
