import { test, expect } from '@playwright/test';

async function addItem(page, list, text) {
  const input = page.locator(list === 'priority' ? '#priority-input' : '#task-input');
  await input.focus();
  await input.fill(text);
  await input.press('Enter');
}

async function addCommitment(page, text, time) {
  if (time !== undefined) await page.locator('#commitment-time-input').fill(time);
  const input = page.locator('#commitment-input');
  await input.focus();
  await input.fill(text);
  await input.press('Enter');
}

async function addGoal(page, text) {
  const input = page.locator('#goal-input');
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

test('adds a commitment with its time visible, surviving a reload', async ({ page }) => {
  await addCommitment(page, 'Standup', '09:30');
  await expect(page.locator('#commitments-list .item')).toHaveCount(1);
  await expect(page.locator('#commitments-list .item-text')).toHaveText('Standup');
  await expect(page.locator('#commitments-list .item-time')).toHaveText('09:30');

  await page.reload();

  await expect(page.locator('#commitments-list .item')).toHaveCount(1);
  await expect(page.locator('#commitments-list .item-time')).toHaveText('09:30');
});

test('commitments render sorted by time regardless of add order', async ({ page }) => {
  await addCommitment(page, 'Afternoon', '15:00');
  await addCommitment(page, 'Morning', '09:00');
  await addCommitment(page, 'Midday', '12:00');

  await expect(page.locator('#commitments-list .item-time')).toHaveText(['09:00', '12:00', '15:00']);
  await expect(page.locator('#commitments-list .item-text')).toHaveText(['Morning', 'Midday', 'Afternoon']);
});

test('a commitment can be completed, un-completed and deleted, each surviving a reload', async ({ page }) => {
  await addCommitment(page, 'Dentist', '14:00');
  const item = page.locator('#commitments-list .item').first();
  const toggle = item.locator('.item-toggle');

  await toggle.click();
  await expect(item).toHaveClass(/is-complete/);
  await page.reload();
  await expect(page.locator('#commitments-list .item')).toHaveClass(/is-complete/);

  await page.locator('#commitments-list .item-toggle').click();
  await expect(page.locator('#commitments-list .item')).not.toHaveClass(/is-complete/);
  await page.reload();
  await expect(page.locator('#commitments-list .item')).not.toHaveClass(/is-complete/);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#commitments-list .item-delete').click();
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);
});

test('submitting a commitment with empty text, or text but no time, adds nothing and shows a message', async ({
  page,
}) => {
  await page.locator('#commitment-input').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);
  await expect(page.locator('#commitment-msg')).toBeVisible();

  await addCommitment(page, 'No time set');
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);
  await expect(page.locator('#commitment-msg')).toBeVisible();
});

test('commitments belong to the selected day', async ({ page }) => {
  await addCommitment(page, 'Only on today', '10:00');
  await page.locator('#prev-day').click();
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);

  await page.locator('#next-day').click();
  await expect(page.locator('#commitments-list .item')).toHaveCount(1);
});

test('a day with only a commitment carries the week strip has-work marker', async ({ page }) => {
  const selectedBefore = page.locator('.week-day.is-selected');
  await expect(selectedBefore).not.toHaveClass(/has-work/);

  await addCommitment(page, 'Only a commitment', '08:00');

  const selectedAfter = page.locator('.week-day.is-selected');
  await expect(selectedAfter).toHaveClass(/has-work/);
});

test('a day stored by the previous version (no commitments key) still loads and accepts a new commitment', async ({
  page,
}) => {
  await page.evaluate(() => {
    const key = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      'antfarm.daily.v1',
      JSON.stringify({
        version: 1,
        days: {
          [key]: {
            priorities: [{ id: 'p1', text: 'Old priority', completed: false }],
            tasks: [{ id: 't1', text: 'Old task', completed: false }],
          },
        },
      })
    );
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.reload();

  await expect(page.locator('#priorities-list .item')).toHaveCount(1);
  await expect(page.locator('#tasks-list .item')).toHaveCount(1);
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);
  await expect(page.locator('#commitments-empty')).toBeVisible();
  expect(errors).toHaveLength(0);

  await addCommitment(page, 'Newly added', '11:00');
  await expect(page.locator('#commitments-list .item')).toHaveCount(1);
});

test('the Commitments panel is fully keyboard-operable', async ({ page }) => {
  await page.locator('#commitment-time-input').focus();
  let outline = await page.locator('#commitment-time-input').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.locator('#commitment-time-input').fill('13:15');

  await page.locator('#commitment-input').focus();
  outline = await page.locator('#commitment-input').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.type('Team sync');
  await page.keyboard.press('Enter');
  await expect(page.locator('#commitments-list .item')).toHaveCount(1);

  const toggle = page.locator('#commitments-list .item-toggle');
  await expect(toggle).toHaveAccessibleName(/.+/);
  await toggle.focus();
  outline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#commitments-list .item')).toHaveClass(/is-complete/);

  const del = page.locator('#commitments-list .item-delete');
  await expect(del).toHaveAccessibleName(/.+/);
  await del.focus();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Enter');
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);
});

test('completed commitments stay visible and are distinguishable by more than color', async ({ page }) => {
  await addCommitment(page, 'Finish report', '16:00');
  const item = page.locator('#commitments-list .item').first();
  await item.locator('.item-toggle').click();

  await expect(item).toBeVisible();
  await expect(item).toHaveClass(/is-complete/);
  await expect(item.locator('.item-text')).toHaveCSS('text-decoration-line', 'line-through');
});

test('no horizontal scroll at 360px with priorities, tasks and commitments populated', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves');
  await addItem(page, 'task', 'Another moderately long task description to check wrapping');
  await addCommitment(page, 'A rather long commitment title to check panel wrapping behaves', '09:00');
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(fits).toBe(true);
});

test('captures screenshots of a day with priorities, tasks and two commitments', async ({ page }) => {
  await addItem(page, 'priority', 'Ship the commitments panel');
  await addItem(page, 'task', 'Review open issues');
  await addCommitment(page, 'Standup', '09:30');
  await addCommitment(page, 'Dentist', '14:00');

  await page.setViewportSize({ width: 360, height: 900 });
  await page.screenshot({ path: 'screenshots/commitments-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'screenshots/commitments-desktop-1280.png' });
});

test('adds a week goal and it survives a reload', async ({ page }) => {
  await addGoal(page, 'Ship the weekly goals feature');
  await expect(page.locator('#week-goals-list .item')).toHaveCount(1);
  await expect(page.locator('#week-goals-list .item-text')).toHaveText('Ship the weekly goals feature');

  await page.reload();

  await expect(page.locator('#week-goals-list .item')).toHaveCount(1);
  await expect(page.locator('#week-goals-list .item-text')).toHaveText('Ship the weekly goals feature');
});

test('a week goal can be completed, un-completed and deleted, each surviving a reload', async ({ page }) => {
  await addGoal(page, 'Write the newsletter');
  const item = page.locator('#week-goals-list .item').first();
  const toggle = item.locator('.item-toggle');

  await toggle.click();
  await expect(item).toHaveClass(/is-complete/);
  await page.reload();
  await expect(page.locator('#week-goals-list .item')).toHaveClass(/is-complete/);

  await page.locator('#week-goals-list .item-toggle').click();
  await expect(page.locator('#week-goals-list .item')).not.toHaveClass(/is-complete/);
  await page.reload();
  await expect(page.locator('#week-goals-list .item')).not.toHaveClass(/is-complete/);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#week-goals-list .item-delete').click();
  await expect(page.locator('#week-goals-list .item')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#week-goals-list .item')).toHaveCount(0);
});

test('submitting the goal form with empty text adds nothing and shows a message', async ({ page }) => {
  await page.locator('#goal-input').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#week-goals-list .item')).toHaveCount(0);
  await expect(page.locator('#goal-msg')).toBeVisible();
});

test('week goals belong to the week, not the day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T09:00:00') }); // a Wednesday
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await addGoal(page, 'Only this week');
  await expect(page.locator('#week-goals-list .item-text')).toHaveText('Only this week');

  await page.locator('#next-day').click(); // Thursday, same week
  await expect(page.locator('#week-goals-list .item-text')).toHaveText('Only this week');
  await page.locator('#prev-day').click(); // back to Wednesday

  for (let i = 0; i < 3; i++) await page.locator('#prev-day').click(); // Sunday, previous week
  await expect(page.locator('#week-goals-list .item')).toHaveCount(0);

  for (let i = 0; i < 3; i++) await page.locator('#next-day').click(); // back to Wednesday
  await expect(page.locator('#week-goals-list .item-text')).toHaveText('Only this week');
});

test('week progress counts every list across the week and updates without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T09:00:00') }); // a Wednesday
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator('#week-progress-text')).toHaveText('No planned work yet this week.');

  await addItem(page, 'priority', 'Ship the feature');
  await addItem(page, 'task', 'Write the tests');
  await addCommitment(page, 'Standup', '09:30');

  await page.locator('#next-day').click(); // Thursday, same week
  await addItem(page, 'task', 'Second day task');
  await expect(page.locator('#week-progress-text')).toHaveText('0 of 4 done this week');

  await page.locator('#tasks-list .item').first().locator('.item-toggle').click();
  await expect(page.locator('#week-progress-text')).toHaveText('1 of 4 done this week');

  await page.locator('#prev-day').click(); // back to Wednesday
  await expect(page.locator('#week-progress-text')).toHaveText('1 of 4 done this week');
  await page.locator('#priorities-list .item').first().locator('.item-toggle').click();
  await expect(page.locator('#week-progress-text')).toHaveText('2 of 4 done this week');
});

test('a day stored by the previous version (no weeks key) still loads and accepts a new week goal', async ({
  page,
}) => {
  await page.evaluate(() => {
    const key = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      'antfarm.daily.v1',
      JSON.stringify({
        version: 1,
        days: {
          [key]: {
            priorities: [{ id: 'p1', text: 'Old priority', completed: false }],
            tasks: [{ id: 't1', text: 'Old task', completed: false }],
          },
        },
      })
    );
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.reload();

  await expect(page.locator('#week-goals-list .item')).toHaveCount(0);
  await expect(page.locator('#week-goals-empty')).toBeVisible();
  await expect(page.locator('#week-progress-text')).toHaveText('0 of 2 done this week');
  expect(errors).toHaveLength(0);

  await addGoal(page, 'First goal after upgrade');
  await expect(page.locator('#week-goals-list .item')).toHaveCount(1);
});

test('the week goals panel is fully keyboard-operable', async ({ page }) => {
  await page.locator('#goal-input').focus();
  let outline = await page.locator('#goal-input').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.type('Plan the sprint');
  await page.keyboard.press('Enter');
  await expect(page.locator('#week-goals-list .item')).toHaveCount(1);

  const toggle = page.locator('#week-goals-list .item-toggle');
  await expect(toggle).toHaveAccessibleName(/.+/);
  await toggle.focus();
  outline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#week-goals-list .item')).toHaveClass(/is-complete/);

  const del = page.locator('#week-goals-list .item-delete');
  await expect(del).toHaveAccessibleName(/.+/);
  await del.focus();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Enter');
  await expect(page.locator('#week-goals-list .item')).toHaveCount(0);
});

test('completed week goals stay visible and distinguishable by more than color; progress figure stands alone', async ({
  page,
}) => {
  await addGoal(page, 'Finish the roadmap doc');
  const item = page.locator('#week-goals-list .item').first();
  await item.locator('.item-toggle').click();

  await expect(item).toBeVisible();
  await expect(item).toHaveClass(/is-complete/);
  await expect(item.locator('.item-text')).toHaveCSS('text-decoration-line', 'line-through');

  await addItem(page, 'task', 'A task for progress');
  await expect(page.locator('#week-progress-text')).not.toBeEmpty();
  await expect(page.locator('.progress-bar')).toHaveAttribute('aria-hidden', 'true');
});

test('no horizontal scroll at 360px with priorities, tasks, commitments and week goals populated', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves');
  await addItem(page, 'task', 'Another moderately long task description to check wrapping');
  await addCommitment(page, 'A rather long commitment title to check panel wrapping behaves', '09:00');
  await addGoal(page, 'A fairly long week goal to check that wrapping behaves nicely too');
  await addGoal(page, 'Second goal');
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(fits).toBe(true);
});

test('captures screenshots of a populated day and a week panel with partial progress', async ({ page }) => {
  await addItem(page, 'priority', 'Ship the weekly goals feature');
  await addItem(page, 'task', 'Write the tests');
  await addCommitment(page, 'Standup', '09:30');
  await page.locator('#tasks-list .item').first().locator('.item-toggle').click();

  await addGoal(page, 'Close out the Weekly Awareness section');
  await addGoal(page, 'Review open issues');
  await page.locator('#week-goals-list .item').first().locator('.item-toggle').click();

  await page.setViewportSize({ width: 360, height: 1100 });
  await page.screenshot({ path: 'screenshots/week-panel-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: 'screenshots/week-panel-desktop-1280.png' });
});
