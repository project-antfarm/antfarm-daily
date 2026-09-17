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

test('previous day shows the prior date with its own empty lists', async ({ page }) => {
  const today = await page.locator('#today-date').innerText();
  await expect(page.locator('#day-eyebrow')).toHaveText('Today');

  await page.locator('#prev-day').click();

  await expect(page.locator('#day-eyebrow')).toHaveText('Viewing');
  await expect(page.locator('#today-date')).not.toHaveText(today);
  await expect(page.locator('#priorities-empty')).toBeVisible();
  await expect(page.locator('#tasks-empty')).toBeVisible();
});

test('the Today control returns to the current date from a non-today day', async ({ page }) => {
  await page.locator('#prev-day').click();
  await expect(page.locator('#day-eyebrow')).toHaveText('Viewing');

  await page.locator('#today-btn').click();

  await expect(page.locator('#day-eyebrow')).toHaveText('Today');
});

test('items added on one day are absent on another and reappear on navigating back', async ({ page }) => {
  await addItem(page, 'task', 'Only on today');
  await page.locator('#prev-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);

  await page.locator('#next-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(1);
  await expect(page.locator('#tasks-list .item-text')).toHaveText('Only on today');
});

test('the week strip marks the selected day without relying on color alone', async ({ page }) => {
  await expect(page.locator('.week-day')).toHaveCount(7);
  const selected = page.locator('.week-day[aria-current="date"]');
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveClass(/is-selected/);

  await page.locator('#prev-day').click();
  await expect(page.locator('.week-day[aria-current="date"]')).toHaveCount(1);
});

test('a day with planned work carries a marker in the week strip; an empty day does not', async ({ page }) => {
  const selectedBefore = page.locator('.week-day.is-selected');
  await expect(selectedBefore).not.toHaveClass(/has-work/);

  await addItem(page, 'task', 'Marked on the strip');

  const selectedAfter = page.locator('.week-day.is-selected');
  await expect(selectedAfter).toHaveClass(/has-work/);
});

test('navigating before the first day of the week moves the strip to the previous week', async ({ page }) => {
  const firstDayLabel = await page.locator('.week-day').first().getAttribute('aria-label');

  for (let i = 0; i < 7; i++) {
    await page.locator('#prev-day').click();
  }

  await expect(page.locator('.week-day')).toHaveCount(7);
  const newFirstDayLabel = await page.locator('.week-day').first().getAttribute('aria-label');
  expect(newFirstDayLabel).not.toBe(firstDayLabel);
  await expect(page.locator('.week-day[aria-current="date"]')).toHaveCount(1);
});

test('reloading after navigating away returns to today, and the other day keeps its data', async ({ page }) => {
  await page.locator('#prev-day').click();
  await addItem(page, 'task', "Yesterday's task");

  await page.reload();

  await expect(page.locator('#day-eyebrow')).toHaveText('Today');
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);

  await page.locator('#prev-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(1);
  await expect(page.locator('#tasks-list .item-text')).toHaveText("Yesterday's task");
});

test('adding, completing and deleting work on a non-today day and persist across reload', async ({ page }) => {
  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Handled on a past day');
  await page.locator('#tasks-list .item').first().locator('.item-toggle').click();
  await expect(page.locator('#tasks-list .item')).toHaveClass(/is-complete/);

  await page.reload();
  await page.locator('#prev-day').click();

  await expect(page.locator('#tasks-list .item')).toHaveCount(1);
  await expect(page.locator('#tasks-list .item')).toHaveClass(/is-complete/);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#tasks-list .item-delete').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);

  await page.reload();
  await page.locator('#prev-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);
});

test('day navigation and the week strip are fully keyboard-operable', async ({ page }) => {
  await page.locator('#prev-day').focus();
  let outline = await page.locator('#prev-day').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#day-eyebrow')).toHaveText('Viewing');

  await page.locator('#today-btn').focus();
  outline = await page.locator('#today-btn').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Space');
  await expect(page.locator('#day-eyebrow')).toHaveText('Today');

  const weekDay = page.locator('.week-day').first();
  await expect(weekDay).toHaveAccessibleName(/.+/);
  await weekDay.focus();
  outline = await weekDay.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('.week-day[aria-current="date"]')).toHaveCount(1);
});

test('a session that crosses midnight writes new items to the new day, not the stale one', async ({ page }) => {
  const before = new Date('2026-09-17T23:58:00');
  await page.clock.install({ time: before });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#day-eyebrow')).toHaveText('Today');

  await page.clock.setSystemTime(new Date('2026-09-18T00:02:00'));
  await addItem(page, 'task', 'Added after midnight');

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('antfarm.daily.v1')));
  expect(stored.days['2026-09-18']?.tasks?.[0]?.text).toBe('Added after midnight');
  expect(stored.days['2026-09-17']).toBeUndefined();
});

test('no horizontal scroll at 360px with the week strip and a long item visible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves nicely');
  await addItem(page, 'task', 'Another moderately long task description to check wrapping too');
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(fits).toBe(true);
});

test('captures screenshots of the week strip on a non-today day with work across the week', async ({ page }) => {
  await addItem(page, 'priority', 'Today priority');
  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Yesterday task');
  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Two days ago task');

  await expect(page.locator('#day-eyebrow')).toHaveText('Viewing');

  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: 'screenshots/week-strip-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'screenshots/week-strip-desktop-1280.png' });
});
