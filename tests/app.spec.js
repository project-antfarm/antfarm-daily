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

async function addDeadline(page, text, due) {
  if (due !== undefined) await page.locator('#deadline-due-input').fill(due);
  const input = page.locator('#deadline-input');
  await input.focus();
  await input.fill(text);
  await input.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('the page lang and title are pt-BR', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt-BR');
  await expect(page).toHaveTitle('Hoje — A.N.T.F.A.R.M. Diário');
});

test('panel headings and the priorities hint are in pt-BR', async ({ page }) => {
  await expect(page.locator('#priorities-heading')).toHaveText('Prioridades');
  await expect(page.locator('.panel-hint')).toHaveText('Até 3');
  await expect(page.locator('#tasks-heading')).toHaveText('Tarefas');
  await expect(page.locator('#commitments-heading')).toHaveText('Compromissos');
  await expect(page.locator('#unfinished-heading')).toHaveText('Pendências');
  await expect(page.locator('#week-goals-heading')).toHaveText('Metas');
  await expect(page.locator('#upcoming-heading')).toHaveText('Próximos prazos');
});

test('every add form input and submit button exposes a pt-BR accessible name', async ({ page }) => {
  await expect(page.locator('#priority-input')).toHaveAccessibleName('Adicionar uma prioridade');
  await expect(page.locator('#task-input')).toHaveAccessibleName('Adicionar uma tarefa');
  await expect(page.locator('#commitment-time-input')).toHaveAccessibleName('Horário do compromisso');
  await expect(page.locator('#commitment-input')).toHaveAccessibleName('Adicionar um compromisso');
  await expect(page.locator('#goal-input')).toHaveAccessibleName('Adicionar uma meta para a semana');
  await expect(page.locator('#deadline-input')).toHaveAccessibleName('Adicionar um prazo');
  await expect(page.locator('#deadline-due-input')).toHaveAccessibleName('Data de vencimento');

  const addButtons = [
    '#priority-form button[type="submit"]',
    '#task-form button[type="submit"]',
    '#commitment-form button[type="submit"]',
    '#goal-form button[type="submit"]',
    '#deadline-form button[type="submit"]',
  ];
  for (const selector of addButtons) {
    await expect(page.locator(selector)).toHaveAccessibleName('Adicionar');
  }
});

test('day navigation and the week strip expose non-empty pt-BR aria-labels', async ({ page }) => {
  await expect(page.locator('#prev-day')).toHaveAccessibleName('Dia anterior');
  await expect(page.locator('#today-btn')).toHaveAccessibleName('Hoje');
  await expect(page.locator('#next-day')).toHaveAccessibleName('Próximo dia');
  await expect(page.locator('#week-strip')).toHaveAccessibleName('Semana');
});

test('empty state shows a human-readable date with no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.reload();
  await expect(page.locator('#today-date')).not.toBeEmpty();
  await expect(page.locator('#priorities-empty')).toHaveText('Nenhuma prioridade ainda — o que mais importa hoje?');
  await expect(page.locator('#tasks-empty')).toHaveText('Nenhuma tarefa ainda — adicione o que mais precisa ser feito.');
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
  await expect(page.locator('#priority-limit-msg')).toHaveText(
    'Você já tem 3 prioridades hoje. Conclua ou remova uma primeiro.'
  );
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
  await expect(item.locator('.sr-only')).toHaveText('(concluído)');

  await toggle.click();
  await expect(item).not.toHaveClass(/is-complete/);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(item.locator('.item-check')).toHaveText('');
  await expect(item.locator('.sr-only')).toHaveText('(não concluído)');
});

test('toggling a priority updates its accessible status text between (não concluído) and (concluído)', async ({
  page,
}) => {
  await addItem(page, 'priority', 'Ship the PR');
  const item = page.locator('#priorities-list .item').first();

  await expect(item.locator('.sr-only')).toHaveText('(não concluído)');
  await item.locator('.item-toggle').click();
  await expect(item.locator('.sr-only')).toHaveText('(concluído)');
});

test('deleting requires a confirm step; dismissing keeps the item', async ({ page }) => {
  await addItem(page, 'task', 'Temporary task');

  await expect(page.locator('#tasks-list .item-delete')).toHaveAccessibleName('Excluir "Temporary task"');

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Excluir "Temporary task"? Esta ação não pode ser desfeita.');
    dialog.dismiss();
  });
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/desktop-1280.png' });
});

test('previous day shows the prior date with its own empty lists', async ({ page }) => {
  const today = await page.locator('#today-date').innerText();
  await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');

  await page.locator('#prev-day').click();

  await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');
  await expect(page.locator('#today-date')).not.toHaveText(today);
  await expect(page.locator('#priorities-empty')).toBeVisible();
  await expect(page.locator('#tasks-empty')).toBeVisible();
});

test('the Today control returns to the current date from a non-today day', async ({ page }) => {
  await page.locator('#prev-day').click();
  await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');

  await page.locator('#today-btn').click();

  await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');
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

  await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');
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
  await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');

  await page.locator('#today-btn').focus();
  outline = await page.locator('#today-btn').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Space');
  await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');

  const weekDay = page.locator('.week-day').first();
  await expect(weekDay).toHaveAccessibleName(/.+/);
  await weekDay.focus();
  outline = await weekDay.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('.week-day[aria-current="date"]')).toHaveCount(1);
});

// This whole block forces the Playwright browser context's own locale to
// en-US, so a passing test here proves the pt-BR rendering comes from the
// hard-coded 'pt-BR' locale argument, not from whatever locale happens to be
// configured on the machine running the app.
test.describe('pt-BR dates render regardless of the browser locale', () => {
  test.use({ locale: 'en-US' });

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-18T09:00:00') }); // sexta-feira
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('the date heading renders a natural pt-BR weekday and month, day before month', async ({ page }) => {
    await expect(page.locator('#today-date')).toHaveText('sexta-feira, 18 de setembro de 2026');
  });

  test('a deadline due date is numeric dd/mm/aaaa, never mm/dd/aaaa', async ({ page }) => {
    await addDeadline(page, 'Renew passport', '2026-03-05');
    await expect(page.locator('#deadlines-list .item-due')).toHaveText('05/03/2026');
  });

  test('each week-strip button names the full pt-BR weekday and date; the seven weekday abbreviations are distinct', async ({
    page,
  }) => {
    const labels = page.locator('.week-day-label');
    await expect(labels).toHaveCount(7);
    const texts = await labels.allTextContents();
    expect(new Set(texts).size).toBe(7);

    // Pins the accent that a mangled UTF-8 encoding would drop or replace.
    const saturday = page.locator('.week-day').nth(5); // Monday-start week: Mon=0 ... Sat=5
    await expect(saturday.locator('.week-day-label')).toHaveText('sáb.');
    await expect(saturday).toHaveAccessibleName(/^sábado, 19 de setembro(?:,|$)/);

    const friday = page.locator('.week-day.is-selected'); // today, Sep 18
    await expect(friday).toHaveAccessibleName(/^sexta-feira, 18 de setembro, hoje/);
  });

  test('the origin label of an unfinished item from more than one day back is a pt-BR date', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.locator('#prev-day').click(); // Tuesday, Sep 15
    await addItem(page, 'task', 'From three days back');
    await page.locator('#today-btn').click();

    await expect(page.locator('#unfinished-list .unfinished-origin')).toHaveText('ter., 15 de set.');
  });

  test('a fully populated pt-BR day shows none of the interface\'s former English words', async ({ page }) => {
    await page.locator('#prev-day').click();
    await addItem(page, 'task', 'Leftover from before');
    await page.locator('#today-btn').click();

    await addItem(page, 'priority', 'Ship the pt-BR date formatting');
    await addItem(page, 'task', 'Review the guard test');
    await addCommitment(page, 'Standup', '09:00');
    await addGoal(page, 'Close out slice 3');
    await addDeadline(page, 'Renew certificate', '2026-09-01'); // overdue

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt-BR');

    const bodyText = await page.evaluate(() => document.body.innerText);
    const englishWords = [
      'Today',
      'Tasks',
      'Priorities',
      'Commitments',
      'Unfinished',
      'Add',
      'Delete',
      'Week',
      'Overdue',
      'Yesterday',
      'September',
      'Friday',
    ];
    for (const word of englishWords) {
      expect(bodyText).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
    }
  });
});

test('a session that crosses midnight writes new items to the new day, not the stale one', async ({ page }) => {
  const before = new Date('2026-09-17T23:58:00');
  await page.clock.install({ time: before });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');

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

  await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');

  await page.setViewportSize({ width: 360, height: 800 });
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(fits).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/week-strip-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
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
  await expect(page.locator('#commitments-list .sr-only')).toHaveText('(concluído)');
  await page.reload();
  await expect(page.locator('#commitments-list .item')).toHaveClass(/is-complete/);

  await page.locator('#commitments-list .item-toggle').click();
  await expect(page.locator('#commitments-list .item')).not.toHaveClass(/is-complete/);
  await expect(page.locator('#commitments-list .sr-only')).toHaveText('(não concluído)');
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
  await expect(page.locator('#commitment-msg')).toHaveText('Um compromisso precisa de um horário e uma descrição.');

  await addCommitment(page, 'No time set');
  await expect(page.locator('#commitments-list .item')).toHaveCount(0);
  await expect(page.locator('#commitment-msg')).toHaveText('Um compromisso precisa de um horário e uma descrição.');
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
  await expect(page.locator('#commitments-empty')).toHaveText('Nenhum compromisso agendado ainda.');
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

test('at 360px the Commitments submit button matches the Tasks button height, and the text input is not squeezed by it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });

  const commitmentButtonHeight = await page
    .locator('#commitment-form button[type="submit"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  const taskButtonHeight = await page
    .locator('#task-form button[type="submit"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.abs(commitmentButtonHeight - taskButtonHeight)).toBeLessThan(5);

  // The field group must claim the full row before the button, like Tasks
  // does, instead of sharing a row with the button and being squeezed.
  const fieldsBottom = await page
    .locator('.commitment-form-fields')
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const buttonTop = await page
    .locator('#commitment-form button[type="submit"]')
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(buttonTop).toBeGreaterThanOrEqual(fieldsBottom);

  const textInputWidth = await page
    .locator('#commitment-input')
    .evaluate((el) => el.getBoundingClientRect().width);
  const fieldsWidth = await page
    .locator('.commitment-form-fields')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(textInputWidth).toBeGreaterThanOrEqual(fieldsWidth - 1);
});

test('captures screenshots of a day with priorities, tasks and two commitments', async ({ page }) => {
  await addItem(page, 'priority', 'Ship the commitments panel');
  await addItem(page, 'task', 'Review open issues');
  await addCommitment(page, 'Standup', '09:30');
  await addCommitment(page, 'Dentist', '14:00');

  await page.setViewportSize({ width: 360, height: 900 });
  // Scroll the Commitments panel into view rather than to the top: at this
  // viewport height its add-form sits below the fold, so scrolling to the
  // top would produce evidence that never actually shows the form.
  await page.locator('.commitments-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'screenshots/commitments-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
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
  await expect(page.locator('#goal-msg')).toHaveText('Uma meta precisa de algum texto.');
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

  await expect(page.locator('#week-progress-text')).toHaveText('Nenhum trabalho planejado ainda esta semana.');

  await addItem(page, 'priority', 'Ship the feature');
  await addItem(page, 'task', 'Write the tests');
  await addCommitment(page, 'Standup', '09:30');

  await page.locator('#next-day').click(); // Thursday, same week
  await addItem(page, 'task', 'Second day task');
  await expect(page.locator('#week-progress-text')).toHaveText('0 de 4 concluídos esta semana');

  await page.locator('#tasks-list .item').first().locator('.item-toggle').click();
  await expect(page.locator('#week-progress-text')).toHaveText('1 de 4 concluído esta semana');

  await page.locator('#prev-day').click(); // back to Wednesday
  await expect(page.locator('#week-progress-text')).toHaveText('1 de 4 concluído esta semana');
  await page.locator('#priorities-list .item').first().locator('.item-toggle').click();
  await expect(page.locator('#week-progress-text')).toHaveText('2 de 4 concluídos esta semana');
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
  await expect(page.locator('#week-goals-empty')).toHaveText('Nenhuma meta ainda — o que você quer desta semana?');
  await expect(page.locator('#week-progress-text')).toHaveText('0 de 2 concluídos esta semana');
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

test('adds a deadline and it survives a reload', async ({ page }) => {
  await addDeadline(page, 'Renew passport', '2026-12-01');
  await expect(page.locator('#deadlines-list .item')).toHaveCount(1);
  await expect(page.locator('#deadlines-list .item-text')).toHaveText('Renew passport');

  await page.reload();

  await expect(page.locator('#deadlines-list .item')).toHaveCount(1);
  await expect(page.locator('#deadlines-list .item-text')).toHaveText('Renew passport');
});

test('a deadline can be completed, un-completed and deleted, each surviving a reload', async ({ page }) => {
  await addDeadline(page, 'File taxes', '2026-12-01');
  const item = page.locator('#deadlines-list .item').first();
  const toggle = item.locator('.item-toggle');

  await toggle.click();
  await expect(item).toHaveClass(/is-complete/);
  await page.reload();
  await expect(page.locator('#deadlines-list .item')).toHaveClass(/is-complete/);

  await page.locator('#deadlines-list .item-toggle').click();
  await expect(page.locator('#deadlines-list .item')).not.toHaveClass(/is-complete/);
  await page.reload();
  await expect(page.locator('#deadlines-list .item')).not.toHaveClass(/is-complete/);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#deadlines-list .item-delete').click();
  await expect(page.locator('#deadlines-list .item')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#deadlines-list .item')).toHaveCount(0);
});

test('deleting a deadline requires confirmation; dismissing keeps it', async ({ page }) => {
  await addDeadline(page, 'Renew passport', '2026-12-01');

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#deadlines-list .item-delete').click();
  await expect(page.locator('#deadlines-list .item')).toHaveCount(1);
});

test('submitting a deadline with empty text, or text but no due date, adds nothing and shows a message', async ({
  page,
}) => {
  await page.locator('#deadline-due-input').fill('2026-12-01');
  await page.locator('#deadline-input').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#deadlines-list .item')).toHaveCount(0);
  await expect(page.locator('#deadline-msg')).toHaveText('Um prazo precisa de texto e uma data de vencimento válida.');

  await page.locator('#deadline-due-input').fill('');
  await addDeadline(page, 'No due date set');
  await expect(page.locator('#deadlines-list .item')).toHaveCount(0);
  await expect(page.locator('#deadline-msg')).toHaveText('Um prazo precisa de texto e uma data de vencimento válida.');
});

test('deadlines render sorted by due date regardless of add order', async ({ page }) => {
  await addDeadline(page, 'Latest', '2026-12-20');
  await addDeadline(page, 'Earliest', '2026-11-01');
  await addDeadline(page, 'Middle', '2026-12-01');

  await expect(page.locator('#deadlines-list .item-text')).toHaveText(['Earliest', 'Middle', 'Latest']);
});

test('relative urgency labels are distinct text, readable without color', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-17T09:00:00') });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await addDeadline(page, 'Was due yesterday', '2026-09-16');
  await addDeadline(page, 'Due today', '2026-09-17');
  await addDeadline(page, 'Due tomorrow', '2026-09-18');
  await addDeadline(page, 'Due in five days', '2026-09-22');

  const labels = page.locator('#deadlines-list .item-urgency');
  await expect(labels).toHaveText(['Atrasado', 'Vence hoje', 'Vence amanhã', 'Vence em 5 dias']);
});

test('a completed overdue deadline is not counted as overdue in the summary', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-17T09:00:00') });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await addDeadline(page, 'Late but done', '2026-09-01');
  await expect(page.locator('#deadlines-summary')).toContainText('1 atrasado');

  await page.locator('#deadlines-list .item-toggle').click();
  await expect(page.locator('#deadlines-summary')).not.toContainText('atrasado');
});

test('the summary line reads sensibly with zero deadlines and updates without a reload', async ({ page }) => {
  await expect(page.locator('#deadlines-summary')).toHaveText('Nenhum prazo ainda.');

  await addDeadline(page, 'Something due', '2026-12-01');
  await expect(page.locator('#deadlines-summary')).not.toHaveText('Nenhum prazo ainda.');
  await expect(page.locator('#deadlines-summary')).not.toBeEmpty();

  await page.locator('#deadlines-list .item-toggle').click();
  await expect(page.locator('#deadlines-summary')).not.toBeEmpty();
});

test('deadlines are independent of the selected day and week, with an unchanging label', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-17T09:00:00') });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await addDeadline(page, 'Cross-cutting deadline', '2026-09-22');
  const urgencyBefore = await page.locator('#deadlines-list .item-urgency').innerText();

  await page.locator('#prev-day').click();
  await expect(page.locator('#deadlines-list .item-text')).toHaveText('Cross-cutting deadline');

  for (let i = 0; i < 7; i++) await page.locator('#prev-day').click();
  await expect(page.locator('#deadlines-list .item-text')).toHaveText('Cross-cutting deadline');
  await expect(page.locator('#deadlines-list .item-urgency')).toHaveText(urgencyBefore);
});

test('a day stored by the previous version (no deadlines key) still loads and accepts a new deadline', async ({
  page,
}) => {
  await page.evaluate(() => {
    const key = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      'antfarm.daily.v1',
      JSON.stringify({
        version: 1,
        days: { [key]: { priorities: [], tasks: [], commitments: [] } },
        weeks: {},
      })
    );
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.reload();

  await expect(page.locator('#deadlines-list .item')).toHaveCount(0);
  await expect(page.locator('#deadlines-empty')).toHaveText('Nenhum prazo ainda — adicione algo com data de vencimento.');
  expect(errors).toHaveLength(0);

  await addDeadline(page, 'First deadline after upgrade', '2026-12-01');
  await expect(page.locator('#deadlines-list .item')).toHaveCount(1);
});

test('the Upcoming panel is fully keyboard-operable', async ({ page }) => {
  await page.locator('#deadline-input').focus();
  let outline = await page.locator('#deadline-input').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.type('Keyboard deadline');

  await page.locator('#deadline-due-input').focus();
  outline = await page.locator('#deadline-due-input').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.locator('#deadline-due-input').fill('2026-12-01');
  await page.keyboard.press('Enter');
  await expect(page.locator('#deadlines-list .item')).toHaveCount(1);

  const toggle = page.locator('#deadlines-list .item-toggle');
  await expect(toggle).toHaveAccessibleName(/.+/);
  await toggle.focus();
  outline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#deadlines-list .item')).toHaveClass(/is-complete/);

  const del = page.locator('#deadlines-list .item-delete');
  await expect(del).toHaveAccessibleName(/.+/);
  await del.focus();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Enter');
  await expect(page.locator('#deadlines-list .item')).toHaveCount(0);
});

test('completed deadlines stay visible and are distinguishable by more than color', async ({ page }) => {
  await addDeadline(page, 'Finish onboarding doc', '2026-12-01');
  const item = page.locator('#deadlines-list .item').first();
  await item.locator('.item-toggle').click();

  await expect(item).toBeVisible();
  await expect(item).toHaveClass(/is-complete/);
  await expect(item.locator('.item-text')).toHaveCSS('text-decoration-line', 'line-through');
});

test('the week panel and the Upcoming panel are inside the main landmark; a non-current week is named', async ({
  page,
}) => {
  await expect(page.locator('main .week-panel')).toHaveCount(1);
  await expect(page.locator('main .upcoming-panel')).toHaveCount(1);

  await expect(page.locator('#week-heading')).toHaveText('Esta semana');

  for (let i = 0; i < 7; i++) await page.locator('#prev-day').click();
  await expect(page.locator('#week-heading')).not.toHaveText('Esta semana');
  await expect(page.locator('#week-heading')).not.toBeEmpty();
});

test('no horizontal scroll at 360px with priorities, tasks, commitments, week goals and deadlines populated', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves');
  await addItem(page, 'task', 'Another moderately long task description to check wrapping');
  await addCommitment(page, 'A rather long commitment title to check panel wrapping behaves', '09:00');
  await addGoal(page, 'A fairly long week goal to check that wrapping behaves nicely too');
  await addDeadline(page, 'A fairly long deadline description to check that wrapping behaves nicely here too', '2026-12-01');
  await addDeadline(page, 'Second deadline', '2026-11-01');
  await addDeadline(page, 'Third deadline', '2026-10-01');
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(fits).toBe(true);

  // Pins the one-character-per-line regression: the due date and urgency
  // chip used to crowd .item-text down to near-zero width, wrapping its
  // text one letter per line instead of by word.
  const text = page.locator('#deadlines-list .item-text').first();
  const box = await text.boundingBox();
  const lineHeight = await text.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(box.height).toBeLessThan(lineHeight * 6);
});

test('captures screenshots of a populated day and an Upcoming panel with overdue and future deadlines', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-09-17T09:00:00') });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await addItem(page, 'priority', 'Ship the deadlines feature');
  await addItem(page, 'task', 'Review open issues');
  await addDeadline(page, 'Overdue renewal', '2026-09-01');
  await addDeadline(page, 'Upcoming conference talk', '2026-10-15');

  await page.setViewportSize({ width: 360, height: 1200 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/deadlines-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/deadlines-desktop-1280.png' });
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/week-panel-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/week-panel-desktop-1280.png' });
});

test('an incomplete item from a past day appears in the Unfinished panel with its origin day named as text; a completed one does not', async ({
  page,
}) => {
  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Unfinished from yesterday');
  await addItem(page, 'task', 'Done yesterday');
  await page.locator('#tasks-list .item', { hasText: 'Done yesterday' }).locator('.item-toggle').click();
  await page.locator('#today-btn').click();

  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(1);
  await expect(page.locator('#unfinished-list .item-text')).toHaveText('Unfinished from yesterday');
  await expect(page.locator('#unfinished-list .unfinished-origin')).toHaveText('Ontem');
});

test('priorities and tasks from past days appear in Unfinished; commitments and week goals do not', async ({
  page,
}) => {
  await page.locator('#prev-day').click();
  await addItem(page, 'priority', 'Past priority');
  await addItem(page, 'task', 'Past task');
  await addCommitment(page, 'Past commitment', '09:00');
  await addGoal(page, 'A week goal');
  await page.locator('#today-btn').click();

  await expect(page.locator('#unfinished-list .item-text')).toHaveText(['Past priority', 'Past task']);
});

test('completing an item from the Unfinished panel marks it complete on its origin day and leaves the panel, surviving reload', async ({
  page,
}) => {
  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Complete me from the panel');
  await page.locator('#today-btn').click();

  await page.locator('#unfinished-list .unfinished-complete').click();
  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(0);

  await page.locator('#prev-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveClass(/is-complete/);

  await page.reload();
  await page.locator('#prev-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveClass(/is-complete/);
});

test('moving an item from the Unfinished panel relocates it to the selected day and off the origin day, surviving reload', async ({
  page,
}) => {
  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Move me forward');
  await page.locator('#today-btn').click();

  await page.locator('#unfinished-list .unfinished-move').click();
  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(0);
  await expect(page.locator('#tasks-list .item-text')).toHaveText('Move me forward');

  await page.locator('#prev-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#tasks-list .item-text')).toHaveText('Move me forward');
  await page.locator('#prev-day').click();
  await expect(page.locator('#tasks-list .item')).toHaveCount(0);
});

test('moving a priority into a day already at the limit is refused with a visible message, not silently dropped', async ({
  page,
}) => {
  await addItem(page, 'priority', 'One');
  await addItem(page, 'priority', 'Two');
  await addItem(page, 'priority', 'Three');

  await page.locator('#prev-day').click();
  await addItem(page, 'priority', 'From yesterday');
  await page.locator('#today-btn').click();

  await page.locator('#unfinished-list .unfinished-move').click();
  await expect(page.locator('#unfinished-msg')).toHaveText(
    'Este dia já tem 3 prioridades. Conclua ou remova uma antes de mover outra para cá.'
  );
  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(1);
  await expect(page.locator('#priorities-list .item')).toHaveCount(3);
});

test('past days are never rewritten just by opening or navigating the app', async ({ page }) => {
  const seed = {
    version: 1,
    days: {
      '2026-09-10': {
        priorities: [{ id: 'p1', text: 'Old priority', completed: false }],
        tasks: [{ id: 't1', text: 'Old task', completed: false }],
        commitments: [],
      },
      '2026-09-17': { priorities: [], tasks: [], commitments: [] },
    },
    weeks: {},
    deadlines: [],
  };

  await page.clock.install({ time: new Date('2026-09-17T09:00:00') });
  await page.goto('/');
  await page.evaluate((s) => localStorage.setItem('antfarm.daily.v1', JSON.stringify(s)), seed);
  await page.reload();

  for (let i = 0; i < 10; i++) await page.locator('#prev-day').click();
  for (let i = 0; i < 10; i++) await page.locator('#next-day').click();

  const stored = await page.evaluate(() => localStorage.getItem('antfarm.daily.v1'));
  expect(stored).toBe(JSON.stringify(seed));
});

test('the Unfinished panel is scoped to the selected day, not just the real today', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T09:00:00') }); // Wednesday
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  for (let i = 0; i < 2; i++) await page.locator('#prev-day').click(); // Monday
  await addItem(page, 'task', 'Monday unfinished');
  for (let i = 0; i < 2; i++) await page.locator('#next-day').click(); // back to Wednesday

  for (let i = 0; i < 3; i++) await page.locator('#prev-day').click(); // Sunday, before Monday
  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(0);

  for (let i = 0; i < 3; i++) await page.locator('#next-day').click(); // Wednesday, after Monday
  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(1);
});

test('the Unfinished count reads sensibly at zero, at one, and at two, updating without a reload', async ({
  page,
}) => {
  await expect(page.locator('#unfinished-summary')).toHaveText('Nada pendente — você está em dia.');

  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Needs doing');
  await addItem(page, 'priority', 'Also needs doing');
  await page.locator('#today-btn').click();

  await expect(page.locator('#unfinished-summary')).toHaveText('2 itens pendentes de dias anteriores.');

  await page.locator('#unfinished-list .unfinished-complete').first().click();
  await expect(page.locator('#unfinished-summary')).toHaveText('1 item pendente de dias anteriores.');

  await page.locator('#unfinished-list .unfinished-complete').click();
  await expect(page.locator('#unfinished-summary')).toHaveText('Nada pendente — você está em dia.');
});

test('state written by the previous version (days, weeks, deadlines but nothing Unfinished-specific) still loads without throwing', async ({
  page,
}) => {
  await page.evaluate(() => {
    const key = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      'antfarm.daily.v1',
      JSON.stringify({
        version: 1,
        days: { [key]: { priorities: [], tasks: [], commitments: [] } },
        weeks: {},
        deadlines: [],
      })
    );
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.reload();

  await expect(page.locator('#unfinished-summary')).toHaveText('Nada pendente — você está em dia.');
  expect(errors).toHaveLength(0);
});

test('the Unfinished panel is fully keyboard-operable with distinct accessible names for complete and move', async ({
  page,
}) => {
  await page.locator('#prev-day').focus();
  await page.keyboard.press('Enter');
  await addItem(page, 'task', 'Keyboard unfinished');
  await page.locator('#today-btn').focus();
  await page.keyboard.press('Enter');

  const completeBtn = page.locator('#unfinished-list .unfinished-complete');
  const moveBtn = page.locator('#unfinished-list .unfinished-move');
  await expect(completeBtn).toHaveText('Concluir');
  await expect(moveBtn).toHaveText('Trazer para este dia');
  await expect(completeBtn).toHaveAccessibleName(/Concluir/);
  await expect(moveBtn).toHaveAccessibleName(/Trazer/);
  expect(await completeBtn.getAttribute('aria-label')).not.toBe(await moveBtn.getAttribute('aria-label'));

  await completeBtn.focus();
  let outline = await completeBtn.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(0);

  await page.locator('#prev-day').focus();
  await page.keyboard.press('Enter');
  await addItem(page, 'task', 'Another keyboard item');
  await page.locator('#today-btn').focus();
  await page.keyboard.press('Enter');

  const moveBtn2 = page.locator('#unfinished-list .unfinished-move');
  await moveBtn2.focus();
  outline = await moveBtn2.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Space');
  await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(0);
  await expect(page.locator('#tasks-list .item-text', { hasText: 'Another keyboard item' })).toBeVisible();
});

test('no horizontal scroll at 360px with priorities, tasks, commitments, week goals, deadlines and unfinished items populated', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves');
  await addItem(page, 'task', 'Another moderately long task description to check wrapping');
  await addCommitment(page, 'A rather long commitment title to check panel wrapping behaves', '09:00');
  await addGoal(page, 'A fairly long week goal to check that wrapping behaves nicely too');
  await addDeadline(page, 'A fairly long deadline description to check that wrapping behaves nicely here too', '2026-12-01');

  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'A fairly long unfinished task left over from a previous day to check wrapping');
  await addItem(page, 'priority', 'Second unfinished item from yesterday');
  await addItem(page, 'task', 'Third unfinished item, also from yesterday');
  await page.locator('#today-btn').click();

  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(fits).toBe(true);

  await expect(page.locator('.week-day')).toHaveCount(7);
  const weekStripFits = await page
    .locator('#week-strip')
    .evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(weekStripFits).toBe(true);

  const text = page.locator('#unfinished-list .item-text', { hasText: 'left over from a previous day' });
  const box = await text.boundingBox();
  const lineHeight = await text.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(box.height).toBeLessThan(lineHeight * 6);

  // "Trazer para este dia" is markedly longer than "Move to this day" — pins
  // that the longer pt-BR label still renders in full rather than being
  // clipped by its button.
  const completeBtn = page.locator('#unfinished-list .unfinished-complete').first();
  const moveBtn = page.locator('#unfinished-list .unfinished-move').first();
  await expect(completeBtn).toBeVisible();
  await expect(moveBtn).toBeVisible();
  const completeClipped = await completeBtn.evaluate(
    (el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
  );
  const moveClipped = await moveBtn.evaluate(
    (el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
  );
  expect(completeClipped).toBe(false);
  expect(moveClipped).toBe(false);
});

test('captures screenshots of a populated day with a populated Unfinished panel', async ({ page }) => {
  await addItem(page, 'priority', 'Ship the unfinished-work panel');
  await addItem(page, 'task', 'Review open issues');

  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Carried over from yesterday');
  await addItem(page, 'priority', 'Also carried over');
  await page.locator('#today-btn').click();

  await page.setViewportSize({ width: 360, height: 1300 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/unfinished-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/unfinished-desktop-1280.png' });
});

test('captures screenshots of a fully populated pt-BR interface at mobile and desktop widths', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-18T09:00:00') }); // sexta-feira
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('#prev-day').click();
  await addItem(page, 'task', 'Carried over from yesterday');
  await page.locator('#today-btn').click();

  await addItem(page, 'priority', 'Ship the pt-BR date formatting');
  await addItem(page, 'priority', 'Review the deadlines');
  await addItem(page, 'task', 'Reply to emails');
  await addCommitment(page, 'Daily standup', '09:00');
  await addGoal(page, 'Close out slice 3');
  await addDeadline(page, 'Renew certificate', '2026-09-01');
  await addDeadline(page, 'Conference talk', '2026-10-15');

  await page.setViewportSize({ width: 360, height: 1600 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/pt-br-mobile-360.png' });

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/pt-br-desktop-1280.png' });
});
