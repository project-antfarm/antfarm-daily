import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

// WCAG 2.x relative luminance / contrast ratio, used only by the #46 contrast
// assertions below — kept local so no dependency is added for it.
function relativeLuminance([r, g, b]) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [channel(r), channel(g), channel(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(rgbA, rgbB) {
  const lA = relativeLuminance(rgbA);
  const lB = relativeLuminance(rgbB);
  const [lighter, darker] = lA >= lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(str) {
  const nums = str.match(/[\d.]+/g).map(Number);
  return [nums[0], nums[1], nums[2]];
}

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

// Notes commit on blur (see DECISIONS.md), not on a submit key, so every
// caller blurs explicitly rather than relying on the debounce timer.
async function setNote(page, text) {
  const textarea = page.locator('#notes-input');
  await textarea.fill(text);
  await textarea.blur();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// Checks page text, every aria-label, every placeholder and the document
// title for leftover words from the *other* language's catalogue — a plain
// body.innerText scan misses attributes, which is exactly where a
// half-translated string hides.
async function assertNoLeftoverWords(page, words) {
  const haystacks = await page.evaluate(() => ({
    text: document.body.innerText,
    ariaLabels: Array.from(document.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label')),
    placeholders: Array.from(document.querySelectorAll('[placeholder]')).map((el) => el.getAttribute('placeholder')),
    title: document.title,
  }));
  const all = [haystacks.text, haystacks.title, ...haystacks.ariaLabels, ...haystacks.placeholders].join('\n');
  for (const word of words) {
    expect(all).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
  }
}

test('the page lang and title are pt-BR', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt-BR');
  await expect(page).toHaveTitle('Hoje — A.N.T.F.A.R.M. Diário');
});

test('neither catalogue has a missing or empty string', async ({ page }) => {
  const badKeys = await page.evaluate(async () => {
    const { catalogues } = await import('/i18n.js');
    return Object.entries(catalogues).flatMap(([lang, strings]) =>
      Object.entries(strings)
        .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
        .map(([key]) => `${lang}:${key}`)
    );
  });
  expect(badKeys).toEqual([]);
});

test('the pt-BR and English catalogues have identical key sets', async ({ page }) => {
  const { ptKeys, enKeys } = await page.evaluate(async () => {
    const { catalogues } = await import('/i18n.js');
    return {
      ptKeys: Object.keys(catalogues['pt-BR']).sort(),
      enKeys: Object.keys(catalogues['en-US']).sort(),
    };
  });
  expect(enKeys).toEqual(ptKeys);
});

test('t() fails loudly on a key missing from the active catalogue, instead of rendering undefined', async ({
  page,
}) => {
  const threw = await page.evaluate(async () => {
    const { t } = await import('/i18n.js');
    try {
      t('thisKeyDoesNotExist');
      return false;
    } catch {
      return true;
    }
  });
  expect(threw).toBe(true);
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
  await expect(page.locator('#prev-week')).toHaveAccessibleName('Semana anterior');
  await expect(page.locator('#next-week')).toHaveAccessibleName('Próxima semana');
  await expect(page.locator('#jump-date-input')).toHaveAccessibleName('Ir para uma data');
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

    await assertNoLeftoverWords(page, [
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
    ]);
  });

  test('the active language is pt-BR by default, not derived from the browser locale', async ({ page }) => {
    const lang = await page.evaluate(async () => (await import('/i18n.js')).getLang());
    expect(lang).toBe('pt-BR');
  });
});

// The mirror of the block above: the browser context's own locale is forced
// to pt-BR, so a passing English assertion here proves the English rendering
// comes from activating the switcher, not from a coincidentally-English
// browser.
test.describe('English interface via the language switcher', () => {
  test.use({ locale: 'pt-BR' });

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-18T09:00:00') }); // Friday
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('activating EN renders every panel heading, empty state, placeholder, accessible name and validation message in English, with no reload', async ({
    page,
  }) => {
    await page.locator('#lang-en-btn').click();

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en-US');
    await expect(page).toHaveTitle('Today — A.N.T.F.A.R.M. Daily');

    await expect(page.locator('#priorities-heading')).toHaveText('Priorities');
    await expect(page.locator('.panel-hint')).toHaveText('Up to 3');
    await expect(page.locator('#tasks-heading')).toHaveText('Tasks');
    await expect(page.locator('#commitments-heading')).toHaveText('Commitments');
    await expect(page.locator('#unfinished-heading')).toHaveText('Unfinished');
    await expect(page.locator('#week-goals-heading')).toHaveText('Goals');
    await expect(page.locator('#upcoming-heading')).toHaveText('Upcoming deadlines');
    await expect(page.locator('#week-heading')).toHaveText('This week');

    await expect(page.locator('#priorities-empty')).toHaveText('No priorities yet — what matters most today?');
    await expect(page.locator('#tasks-empty')).toHaveText('No tasks yet — add what needs doing most.');
    await expect(page.locator('#commitments-empty')).toHaveText('No commitments scheduled yet.');
    await expect(page.locator('#week-goals-empty')).toHaveText('No goals yet — what do you want from this week?');
    await expect(page.locator('#deadlines-empty')).toHaveText('No deadlines yet — add something with a due date.');
    await expect(page.locator('#unfinished-summary')).toHaveText("Nothing pending — you're all caught up.");
    await expect(page.locator('#week-progress-text')).toHaveText('No work planned yet this week.');
    await expect(page.locator('#deadlines-summary')).toHaveText('No deadlines yet.');

    await expect(page.locator('#priority-input')).toHaveAccessibleName('Add a priority');
    await expect(page.locator('#priority-input')).toHaveAttribute('placeholder', 'Add a priority…');
    await expect(page.locator('#task-input')).toHaveAccessibleName('Add a task');
    await expect(page.locator('#task-input')).toHaveAttribute('placeholder', 'Add a task…');
    await expect(page.locator('#commitment-time-input')).toHaveAccessibleName('Commitment time');
    await expect(page.locator('#commitment-input')).toHaveAccessibleName('Add a commitment');
    await expect(page.locator('#commitment-input')).toHaveAttribute('placeholder', 'Add a commitment…');
    await expect(page.locator('#goal-input')).toHaveAccessibleName('Add a goal for the week');
    await expect(page.locator('#goal-input')).toHaveAttribute('placeholder', 'Add a goal for the week…');
    await expect(page.locator('#deadline-input')).toHaveAccessibleName('Add a deadline');
    await expect(page.locator('#deadline-input')).toHaveAttribute('placeholder', 'Add a deadline…');
    await expect(page.locator('#deadline-due-input')).toHaveAccessibleName('Due date');

    await expect(page.locator('#prev-day')).toHaveAccessibleName('Previous day');
    await expect(page.locator('#today-btn')).toHaveAccessibleName('Today');
    await expect(page.locator('#next-day')).toHaveAccessibleName('Next day');
    await expect(page.locator('#week-strip')).toHaveAccessibleName('Week');

    // Validation messages only appear after a failed submit, and render() (run
    // by the switch itself) always resets them hidden — so they're triggered
    // after switching, to prove the message text itself is in English.
    await page.locator('#commitment-input').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#commitment-msg')).toHaveText('A commitment needs a time and a description.');

    await page.locator('#goal-input').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#goal-msg')).toHaveText('A goal needs some text.');

    await page.locator('#deadline-input').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#deadline-msg')).toHaveText('A deadline needs text and a valid due date.');

    await addItem(page, 'priority', 'One');
    await addItem(page, 'priority', 'Two');
    await addItem(page, 'priority', 'Three');
    await expect(page.locator('#priority-limit-msg')).toHaveText(
      'You already have 3 priorities today. Finish or remove one first.'
    );
    await expect(page.locator('#priority-input')).toBeDisabled();
  });

  test('activating EN translates item delete, completion status, and the Unfinished panel buttons and aria-labels', async ({
    page,
  }) => {
    await page.locator('#prev-day').click();
    await addItem(page, 'task', 'Left unfinished');
    await page.locator('#today-btn').click();

    await addItem(page, 'task', 'Water the plants');
    await page.locator('#lang-en-btn').click();

    const item = page.locator('#tasks-list .item').first();
    await expect(item.locator('.sr-only')).toHaveText('(not completed)');
    await item.locator('.item-toggle').click();
    await expect(item.locator('.sr-only')).toHaveText('(completed)');

    await expect(page.locator('#tasks-list .item-delete')).toHaveAccessibleName('Delete "Water the plants"');
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('Delete "Water the plants"? This action cannot be undone.');
      dialog.dismiss();
    });
    await page.locator('#tasks-list .item-delete').click();

    const completeBtn = page.locator('#unfinished-list .unfinished-complete');
    const moveBtn = page.locator('#unfinished-list .unfinished-move');
    await expect(completeBtn).toHaveText('Finish');
    await expect(moveBtn).toHaveText('Bring to this day');
    await expect(completeBtn).toHaveAccessibleName('Finish "Left unfinished" from Yesterday');
    await expect(moveBtn).toHaveAccessibleName('Bring "Left unfinished" from Yesterday to this day');
    await expect(page.locator('#unfinished-summary')).toHaveText('1 item pending from previous days.');
  });

  test('activating EN translates the week progress line, deadline urgency labels, the deadlines summary and week-strip aria-labels', async ({
    page,
  }) => {
    await addItem(page, 'task', 'Write the tests');
    await addDeadline(page, 'Renew certificate', '2026-09-01'); // overdue relative to Sep 18
    await page.locator('#lang-en-btn').click();

    await expect(page.locator('#week-progress-text')).toHaveText('0 of 1 done this week');
    await expect(page.locator('#deadlines-list .item-urgency')).toHaveText('Overdue');
    await expect(page.locator('#deadlines-summary')).toContainText('1 overdue');

    const saturday = page.locator('.week-day').nth(5); // Monday-start week: Mon=0 ... Sat=5
    await expect(saturday.locator('.week-day-label')).toHaveText('Sat');
    await expect(saturday).toHaveAccessibleName(/^Saturday, September 19(?:,|$)/);

    const friday = page.locator('.week-day.is-selected'); // today, Sep 18
    await expect(friday).toHaveAccessibleName(/^Friday, September 18, today/);
  });

  test('an English day shows no pt-BR word from the catalogue in text, aria-labels, placeholders or the title', async ({
    page,
  }) => {
    await page.locator('#lang-en-btn').click();

    await page.locator('#prev-day').click();
    await addItem(page, 'task', 'Leftover from before');
    await page.locator('#today-btn').click();

    await addItem(page, 'priority', 'Ship the English catalogue');
    await addItem(page, 'task', 'Review the guard test');
    await addCommitment(page, 'Standup', '09:00');
    await addGoal(page, 'Close out slice 4');
    await addDeadline(page, 'Renew certificate', '2026-09-01'); // overdue

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en-US');

    await assertNoLeftoverWords(page, [
      'Hoje',
      'Tarefas',
      'Prioridades',
      'Compromissos',
      'Pendências',
      'Adicionar',
      'Excluir',
      'Semana',
      'Atrasado',
      'Ontem',
      'setembro',
      'sexta-feira',
    ]);
  });

  test('dates follow the EN selection: a natural long date, a US numeric due date, and English weekday abbreviations', async ({
    page,
  }) => {
    await page.locator('#lang-en-btn').click();

    await expect(page.locator('#today-date')).toHaveText('Friday, September 18, 2026');

    await addDeadline(page, 'Renew passport', '2026-03-05');
    await expect(page.locator('#deadlines-list .item-due')).toHaveText('03/05/2026');

    const labels = page.locator('.week-day-label');
    const texts = await labels.allTextContents();
    expect(new Set(texts).size).toBe(7);
    expect(texts).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

    for (let i = 0; i < 3; i++) await page.locator('#prev-day').click(); // Tuesday, Sep 15
    await addItem(page, 'task', 'From three days back');
    await page.locator('#today-btn').click();
    await expect(page.locator('#unfinished-list .unfinished-origin')).toHaveText('Tue, Sep 15');
  });

  test('the language choice persists across a reload, in a fresh context sharing storage, and falls back to pt-BR from a corrupt value', async ({
    page,
    context,
    browser,
  }) => {
    await page.locator('#lang-en-btn').click();
    expect(await page.evaluate(() => localStorage.getItem('antfarm.daily.lang'))).toBe('en-US');

    await page.reload();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en-US');
    await expect(page.locator('#priorities-heading')).toHaveText('Priorities');

    const storageState = await context.storageState();
    const freshContext = await browser.newContext({ storageState });
    const freshPage = await freshContext.newPage();
    await freshPage.goto('/');
    expect(await freshPage.evaluate(() => document.documentElement.lang)).toBe('en-US');
    await expect(freshPage.locator('#priorities-heading')).toHaveText('Priorities');
    await freshContext.close();

    await page.locator('#lang-pt-btn').click();
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt-BR');
    await expect(page.locator('#priorities-heading')).toHaveText('Prioridades');

    await page.evaluate(() => localStorage.setItem('antfarm.daily.lang', 'xx-YY'));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt-BR');
    expect(errors).toHaveLength(0);
  });

  test('switching language leaves the planning payload byte-identical', async ({ page }) => {
    await addItem(page, 'priority', 'Ship the switcher');
    await addCommitment(page, 'Standup', '09:00');
    const before = await page.evaluate(() => localStorage.getItem('antfarm.daily.v1'));

    await page.locator('#lang-en-btn').click();
    await page.locator('#lang-pt-btn').click();

    const after = await page.evaluate(() => localStorage.getItem('antfarm.daily.v1'));
    expect(after).toBe(before);
    await expect(page.locator('#priorities-list .item-text')).toHaveText('Ship the switcher');
  });

  test('the language switcher is keyboard-operable, exposes its state via ARIA rather than a class, and names both options in either language', async ({
    page,
  }) => {
    await expect(page.locator('#lang-pt-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lang-en-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#lang-pt-btn')).toHaveAccessibleName(/.+/);
    await expect(page.locator('#lang-en-btn')).toHaveAccessibleName(/.+/);

    await page.locator('#lang-en-btn').focus();
    const outline = await page.locator('#lang-en-btn').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');

    await expect(page.locator('#lang-en-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lang-pt-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#lang-pt-btn')).toHaveAccessibleName(/.+/);
    await expect(page.locator('#lang-en-btn')).toHaveAccessibleName(/.+/);
  });

  test('no horizontal scroll at 360px with the switcher present, in either language; the header and Unfinished buttons are not clipped by the longer English text', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 700 });

    await page.locator('#prev-day').click();
    await addItem(page, 'task', 'Left unfinished from yesterday');
    await page.locator('#today-btn').click();
    await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves');
    await addItem(page, 'task', 'Another moderately long task description to check wrapping');

    let fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);

    await page.locator('#lang-en-btn').click();

    fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);

    const header = page.locator('.day-header');
    const headerOverflows = await header.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(headerOverflows).toBe(false);

    const completeBtn = page.locator('#unfinished-list .unfinished-complete').first();
    const moveBtn = page.locator('#unfinished-list .unfinished-move').first();
    const completeClipped = await completeBtn.evaluate(
      (el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
    );
    const moveClipped = await moveBtn.evaluate(
      (el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
    );
    expect(completeClipped).toBe(false);
    expect(moveClipped).toBe(false);
  });

  test('captures screenshots of a fully populated day in English at mobile and desktop widths, and of the switcher showing its active state', async ({
    page,
  }) => {
    await page.locator('#prev-day').click();
    await addItem(page, 'task', 'Carried over from yesterday');
    await page.locator('#today-btn').click();

    await addItem(page, 'priority', 'Ship the English catalogue');
    await addItem(page, 'priority', 'Review the deadlines');
    await addItem(page, 'task', 'Reply to emails');
    await addCommitment(page, 'Daily standup', '09:00');
    await addGoal(page, 'Close out slice 4');
    await addDeadline(page, 'Renew certificate', '2026-09-01');
    await addDeadline(page, 'Conference talk', '2026-10-15');

    await page.locator('#lang-en-btn').click();

    await page.setViewportSize({ width: 360, height: 1600 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/en-us-mobile-360.png' });

    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/en-us-desktop-1280.png' });

    await page.locator('.lang-switch').screenshot({ path: 'screenshots/lang-switch-active-en.png' });
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

test.describe('Notes (Issue #40)', () => {
  test('a note is written and survives a reload', async ({ page }) => {
    await setNote(page, 'Called in sick, rescheduled the demo.');
    await page.reload();
    await expect(page.locator('#notes-input')).toHaveValue('Called in sick, rescheduled the demo.');
  });

  test('a written note is present in the stored payload under the day it was written on', async ({ page }) => {
    await setNote(page, 'Payload check');
    const key = await page.evaluate(() => new Date().toISOString().slice(0, 10));
    const stored = await page.evaluate(
      ([storedKey]) => JSON.parse(localStorage.getItem('antfarm.daily.v1')).days[storedKey].notes,
      [key]
    );
    expect(stored).toBe('Payload check');
  });

  test('a note is scoped to the day it was written on, absent on another day, and returns on navigating back, surviving a reload', async ({
    page,
  }) => {
    await setNote(page, "Today's note");
    await page.locator('#prev-day').click();
    await expect(page.locator('#notes-input')).toHaveValue('');

    await setNote(page, "Yesterday's note");
    await page.locator('#today-btn').click();
    await expect(page.locator('#notes-input')).toHaveValue("Today's note");

    await page.locator('#prev-day').click();
    await expect(page.locator('#notes-input')).toHaveValue("Yesterday's note");

    // A reload always reopens on today (selectedDay is in-memory only, not
    // part of what's persisted) — so today's note is what should show first.
    await page.reload();
    await expect(page.locator('#notes-input')).toHaveValue("Today's note");
    await page.locator('#prev-day').click();
    await expect(page.locator('#notes-input')).toHaveValue("Yesterday's note");
  });

  test('clearing a note and reloading shows an empty field, not the old text', async ({ page }) => {
    await setNote(page, 'Temporary note');
    await page.reload();
    await expect(page.locator('#notes-input')).toHaveValue('Temporary note');

    const textarea = page.locator('#notes-input');
    await textarea.selectText();
    await page.keyboard.press('Backspace');
    await textarea.blur();

    await page.reload();
    await expect(page.locator('#notes-input')).toHaveValue('');
  });

  test('a day whose only content is a note carries no week-strip work marker, leaves week progress unchanged, and contributes nothing to Unfinished', async ({
    page,
  }) => {
    const progressBefore = await page.locator('#week-progress-text').innerText();
    const todayStrip = page.locator('.week-day.is-selected');
    await expect(todayStrip).not.toHaveClass(/has-work/);

    await setNote(page, 'Just some context, nothing planned.');

    await expect(todayStrip).not.toHaveClass(/has-work/);
    await expect(page.locator('#week-progress-text')).toHaveText(progressBefore);

    await page.locator('#next-day').click();
    await expect(page.locator('#unfinished-summary')).toHaveText('Nada pendente — você está em dia.');
    await expect(page.locator('#unfinished-list .unfinished-row')).toHaveCount(0);
  });

  test('a day stored by the previous version (no notes key) still loads and renders an empty notes field with its items intact', async ({
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
              commitments: [{ id: 'c1', text: 'Old commitment', time: '09:00', completed: false }],
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
    await expect(page.locator('#commitments-list .item')).toHaveCount(1);
    await expect(page.locator('#notes-input')).toHaveValue('');
    expect(errors).toHaveLength(0);

    await setNote(page, 'Newly added note');
    await page.reload();
    await expect(page.locator('#notes-input')).toHaveValue('Newly added note');
  });

  test('the notes heading, accessible name and placeholder are in pt-BR, and switch to English at runtime without a reload', async ({
    page,
  }) => {
    await expect(page.locator('#notes-heading')).toHaveText('Notas');
    await expect(page.locator('#notes-input')).toHaveAccessibleName('Notas do dia');
    await expect(page.locator('#notes-input')).toHaveAttribute('placeholder', 'Algum contexto sobre este dia…');

    await page.locator('#lang-en-btn').click();

    await expect(page.locator('#notes-heading')).toHaveText('Notes');
    await expect(page.locator('#notes-input')).toHaveAccessibleName('Notes for the day');
    await expect(page.locator('#notes-input')).toHaveAttribute('placeholder', 'Any context about this day…');
  });

  test('the notes field is keyboard-reachable, editable, and shows the same focus treatment as other controls', async ({
    page,
  }) => {
    const textarea = page.locator('#notes-input');
    await textarea.focus();
    const outline = await textarea.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    await page.keyboard.type('Typed via keyboard');
    await expect(textarea).toHaveValue('Typed via keyboard');
  });

  test('a ~1500-character note with a single unbroken 60-character run causes no horizontal scroll at 360px or 1280px', async ({
    page,
  }) => {
    const longWord = 'x'.repeat(60);
    const filler = 'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(30);
    const note = `${longWord} ${filler}`.slice(0, 1500);
    expect(note.length).toBe(1500);

    await setNote(page, note);

    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      );
      expect(fits).toBe(true);
    }
  });

  test('the notes area sits directly after Priorities/Tasks/Commitments and before Unfinished, Week and Upcoming, at 360px and 1280px', async ({
    page,
  }) => {
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const order = await page.evaluate(() => Array.from(document.querySelectorAll('main > *')).map((el) => el.className));
      expect(order[0]).toContain('panels');
      expect(order[1]).toContain('notes-panel');
      expect(order[2]).toContain('unfinished-panel');
      expect(order[3]).toContain('week-panel');
      expect(order[4]).toContain('upcoming-panel');
    }
  });

  test('captures screenshots of a fully populated day with a multi-line note at mobile and desktop widths, and in English', async ({
    page,
  }) => {
    await addItem(page, 'priority', 'Ship the notes feature');
    await addItem(page, 'task', 'Review open issues');
    await addCommitment(page, 'Standup', '09:00');
    await setNote(page, 'Linha um: contexto do dia.\nLinha dois: mais contexto.\nLinha três: até mais.');

    await page.setViewportSize({ width: 360, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/notes-pt-br-mobile-360.png' });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/notes-pt-br-desktop-1280.png' });

    await page.locator('#lang-en-btn').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/notes-en-desktop-1280.png' });
  });
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

  await page.setViewportSize({ width: 768, height: 1400 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/pt-br-tablet-768.png' });

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/pt-br-desktop-1280.png' });
});

test.describe('a deliberate desktop layout above 1024px (Issue #38)', () => {
  test("the container widens well past today's 640px cap at 1280px, but 360px and 768px render at the same width as today", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    expect(await page.locator('.page').evaluate((el) => el.getBoundingClientRect().width)).toBe(360);

    await page.setViewportSize({ width: 768, height: 900 });
    expect(await page.locator('.page').evaluate((el) => el.getBoundingClientRect().width)).toBe(640);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await page.locator('.page').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(900);
  });

  test('#today-date renders on a single line at 1280px, in pt-BR and in English', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const heading = page.locator('#today-date');

    const ptBox = await heading.boundingBox();
    const ptLineHeight = await heading.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(ptBox.height).toBeLessThan(ptLineHeight * 1.5);

    await page.locator('#lang-en-btn').click();
    const enBox = await heading.boundingBox();
    const enLineHeight = await heading.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(enBox.height).toBeLessThan(enLineHeight * 1.5);
  });

  test('a three-word priority renders on a single line at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await addItem(page, 'priority', 'Ship the feature');

    const text = page.locator('#priorities-list .item-text').first();
    const box = await text.boundingBox();
    const lineHeight = await text.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(box.height).toBeLessThan(lineHeight * 1.5);
  });

  test('every add-form keeps its text input and submit button on the same row at 1280px, including Commitments and Deadlines', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const forms = [
      ['#priority-input', '#priority-form button[type="submit"]'],
      ['#task-input', '#task-form button[type="submit"]'],
      ['#commitment-input', '#commitment-form button[type="submit"]'],
      ['#goal-input', '#goal-form button[type="submit"]'],
      ['#deadline-input', '#deadline-form button[type="submit"]'],
    ];
    for (const [input, button] of forms) {
      const inputY = await page.locator(input).evaluate((el) => el.getBoundingClientRect().y);
      const buttonY = await page.locator(button).evaluate((el) => el.getBoundingClientRect().y);
      expect(Math.abs(inputY - buttonY)).toBeLessThan(3);
    }
  });

  test('the language switcher shares a horizontal band with the day-nav controls at 1280px, and its #36 behaviours are unchanged', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const switchBox = await page.locator('.lang-switch').boundingBox();
    const navBox = await page.locator('.day-nav').boundingBox();
    const overlap = Math.min(switchBox.y + switchBox.height, navBox.y + navBox.height) - Math.max(switchBox.y, navBox.y);
    expect(overlap).toBeGreaterThan(0);

    await expect(page.locator('#lang-pt-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lang-en-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#lang-pt-btn')).toHaveAccessibleName(/.+/);
    await expect(page.locator('#lang-en-btn')).toHaveAccessibleName(/.+/);

    await page.locator('#lang-en-btn').focus();
    const outline = await page.locator('#lang-en-btn').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.locator('#lang-en-btn')).toHaveAttribute('aria-pressed', 'true');
  });

  test('no horizontal scroll at 768px and 1024px with every panel populated, in both languages', async ({ page }) => {
    await addItem(page, 'priority', 'A reasonably long priority to check wrapping behaves');
    await addItem(page, 'task', 'Another moderately long task description to check wrapping');
    await addCommitment(page, 'A rather long commitment title to check panel wrapping behaves', '09:00');
    await addGoal(page, 'A fairly long week goal to check that wrapping behaves nicely too');
    await addDeadline(page, 'A fairly long deadline description to check that wrapping behaves nicely here too', '2026-12-01');

    for (const lang of ['pt', 'en']) {
      if (lang === 'en') await page.locator('#lang-en-btn').click();
      for (const width of [768, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        const fits = await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        );
        expect(fits).toBe(true);
      }
    }
  });

  test('Priorities, Tasks and Commitments still precede Unfinished, Week and Upcoming in DOM order at 1280px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const order = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main .panel')).map((el) => el.className)
    );
    expect(order[0]).toContain('priorities-panel');
    expect(order[1]).toContain('tasks-panel');
    expect(order[2]).toContain('commitments-panel');
    expect(order[3]).toContain('unfinished-panel');
    expect(order[4]).toContain('week-panel');
    expect(order[5]).toContain('upcoming-panel');
  });
});

// A fixed Wednesday so every date and weekday assertion below is exact
// rather than relative. Monday-start week: Sep 14 (Mon) – Sep 20 (Sun) 2026;
// the preceding week is Sep 7 (Mon) – Sep 13 (Sun).
test.describe('week paging and jump-to-date (Issue #42)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-16T09:00:00') }); // Wednesday
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('previous-week shows the preceding week with the same weekday selected; next-week returns to the original week and day', async ({
    page,
  }) => {
    const originalNums = await page.locator('.week-day-num').allTextContents();
    expect(originalNums).toEqual(['14', '15', '16', '17', '18', '19', '20']);

    await page.locator('#prev-week').click();

    expect(await page.locator('.week-day-num').allTextContents()).toEqual(['7', '8', '9', '10', '11', '12', '13']);
    await expect(page.locator('.week-day.is-selected .week-day-num')).toHaveText('9');
    await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');

    await page.locator('#next-week').click();

    expect(await page.locator('.week-day-num').allTextContents()).toEqual(originalNums);
    await expect(page.locator('.week-day.is-selected .week-day-num')).toHaveText('16');
    await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');
  });

  test('the week heading, week goals and week progress all describe the week being paged to, not the current week', async ({
    page,
  }) => {
    await addGoal(page, 'Goal for the current week');

    await page.locator('#prev-week').click();

    await expect(page.locator('#week-heading')).toHaveText('Semana de 07/09/2026');
    await expect(page.locator('#week-goals-list .item')).toHaveCount(0);
    await expect(page.locator('#week-goals-empty')).toBeVisible();
    await expect(page.locator('#week-progress-text')).toHaveText('Nenhum trabalho planejado ainda esta semana.');

    await addItem(page, 'task', 'Task in the past week');
    await page.locator('#tasks-list .item-toggle').click();
    await expect(page.locator('#week-progress-text')).toHaveText('1 de 1 concluído esta semana');

    await page.locator('#next-week').click();

    await expect(page.locator('#week-heading')).toHaveText('Esta semana');
    await expect(page.locator('#week-goals-list .item')).toHaveCount(1);
  });

  test('jumping to a date 40+ days in the past renders that day fully: heading, week strip and its own content', async ({
    page,
  }) => {
    const key = '2026-08-02'; // Sunday, 45 days before the fixed "today" above
    await page.evaluate((k) => {
      localStorage.setItem(
        'antfarm.daily.v1',
        JSON.stringify({
          version: 1,
          days: {
            [k]: {
              priorities: [{ id: 'p1', text: 'Seeded priority', completed: false }],
              tasks: [{ id: 't1', text: 'Seeded task', completed: false }],
              commitments: [{ id: 'c1', text: 'Seeded commitment', time: '09:00', completed: false }],
              notes: 'Seeded note',
            },
          },
        })
      );
    }, key);
    await page.reload();

    await page.locator('#jump-date-input').fill(key);
    await page.locator('#jump-date-input').blur();

    await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');
    await expect(page.locator('#today-date')).toHaveText('domingo, 2 de agosto de 2026');
    expect(await page.locator('.week-day-num').allTextContents()).toEqual(['27', '28', '29', '30', '31', '1', '2']);
    await expect(page.locator('.week-day.is-selected .week-day-num')).toHaveText('2');
    await expect(page.locator('#priorities-list .item-text')).toHaveText('Seeded priority');
    await expect(page.locator('#tasks-list .item-text')).toHaveText('Seeded task');
    await expect(page.locator('#commitments-list .item-text')).toHaveText('Seeded commitment');
    await expect(page.locator('#notes-input')).toHaveValue('Seeded note');
  });

  test('the date input mirrors the selected day after every kind of navigation, and clearing it is a no-op', async ({
    page,
  }) => {
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-16');

    await page.locator('#prev-day').click();
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-15');

    await page.locator('#next-day').click();
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-16');

    await page.locator('#prev-week').click();
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-09');

    await page.locator('#next-week').click();
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-16');

    await page.locator('.week-day').first().click(); // Monday, Sep 14
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-14');

    await page.locator('#today-btn').click();
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-16');

    await page.locator('#jump-date-input').fill('');
    await page.locator('#jump-date-input').blur();
    await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');
    await expect(page.locator('#jump-date-input')).toHaveValue('2026-09-16');
  });

  test('paging to another week and back to today resumes real-today following (Issue #14)', async ({ page }) => {
    await page.locator('#prev-week').click();
    await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');

    await page.locator('#today-btn').click();

    await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');
  });

  test('a past week shows the has-work marker for a day with content and none for a note-only day, once that week is displayed', async ({
    page,
  }) => {
    await page.locator('#prev-week').click(); // Sep 9, Wednesday, in the Sep 7–13 week
    await addItem(page, 'task', 'Work in the past week');
    await expect(page.locator('.week-day.is-selected')).toHaveClass(/has-work/);

    await page.locator('#next-day').click(); // Sep 10, Thursday, same past week
    await setNote(page, 'Just a note, no work');
    await expect(page.locator('.week-day.is-selected')).not.toHaveClass(/has-work/);

    await page.reload();
    await page.locator('#prev-week').click();

    await expect(page.locator('.week-day').nth(2)).toHaveClass(/has-work/); // Sep 9
    await expect(page.locator('.week-day').nth(3)).not.toHaveClass(/has-work/); // Sep 10, note-only
  });

  test('the week-paging controls and the jump-to-date label switch language at runtime, with directional accessible names', async ({
    page,
  }) => {
    await expect(page.locator('#prev-week')).toHaveAccessibleName('Semana anterior');
    await expect(page.locator('#next-week')).toHaveAccessibleName('Próxima semana');
    await expect(page.locator('#jump-date-input')).toHaveAccessibleName('Ir para uma data');

    await page.locator('#lang-en-btn').click();

    await expect(page.locator('#prev-week')).toHaveAccessibleName('Previous week');
    await expect(page.locator('#next-week')).toHaveAccessibleName('Next week');
    await expect(page.locator('#jump-date-input')).toHaveAccessibleName('Jump to a date');
  });

  test('the week controls and date input are keyboard-operable with the same visible focus treatment as existing controls', async ({
    page,
  }) => {
    await page.locator('#prev-week').focus();
    let outline = await page.locator('#prev-week').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.locator('#day-eyebrow')).toHaveText('Visualizando');

    await page.locator('#next-week').focus();
    outline = await page.locator('#next-week').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.locator('#day-eyebrow')).toHaveText('Hoje');

    await page.locator('#jump-date-input').focus();
    outline = await page.locator('#jump-date-input').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('no horizontal scroll at 360px, 768px, 1024px and 1280px with the week-paging controls and date input present', async ({
    page,
  }) => {
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      );
      expect(fits).toBe(true);
    }
  });

  test('captures screenshots of the header with week paging and jump-to-date at 360px and 1280px, and a past week at 1280px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/week-nav-mobile-360.png' });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/week-nav-desktop-1280.png' });

    await page.locator('#prev-week').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/week-nav-past-week-1280.png' });
  });
});

// A day with 40 tasks, 3 priorities, 8 commitments and 12 deadlines, seeded
// straight into localStorage (typing that many items through the form would
// spend the run's turn budget without testing anything the ordering tests
// above don't already cover). Wednesday, matching the fixed "today" used
// elsewhere in this file, so the weekday-name assertions below are exact.
const LARGE_DAY_KEY = '2026-09-16';

function addDaysISO(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function largeDaySeed() {
  const priorities = Array.from({ length: 3 }, (_, i) => ({
    id: `p${i}`,
    text: `Priority ${i + 1}`,
    completed: i === 0,
  }));
  const tasks = Array.from({ length: 40 }, (_, i) => ({
    id: `t${i}`,
    text: `Task number ${i + 1}`,
    completed: i % 3 === 0,
  }));
  const commitments = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    text: `Commitment ${i + 1}`,
    time: `${String(7 + i).padStart(2, '0')}:00`,
    completed: i % 2 === 0,
  }));
  const deadlines = Array.from({ length: 12 }, (_, i) => ({
    id: `d${i}`,
    text: `Deadline ${i + 1}`,
    due: addDaysISO(LARGE_DAY_KEY, i - 3),
    completed: i % 4 === 0,
  }));
  return {
    version: 1,
    days: { [LARGE_DAY_KEY]: { priorities, tasks, commitments, notes: '' } },
    weeks: {},
    deadlines,
  };
}

test.describe('completed priorities and tasks sink to the bottom (Issue #44)', () => {
  test('completed tasks sink below incomplete ones; within each group, insertion order is preserved', async ({
    page,
  }) => {
    await addItem(page, 'task', 'A');
    await addItem(page, 'task', 'B');
    await addItem(page, 'task', 'C');
    await addItem(page, 'task', 'D');
    const list = page.locator('#tasks-list');
    const texts = () => list.locator('.item-text');

    await list.getByText('B', { exact: true }).click();
    await expect(texts()).toHaveText(['A', 'C', 'D', 'B']);

    await list.getByText('A', { exact: true }).click();
    await expect(texts()).toHaveText(['C', 'D', 'B', 'A']);

    await list.getByText('B', { exact: true }).click();
    await expect(texts()).toHaveText(['B', 'C', 'D', 'A']);
  });

  test('completed priorities sink too, and the badges renumber 1..n in the new rendered order', async ({ page }) => {
    await addItem(page, 'priority', 'One');
    await addItem(page, 'priority', 'Two');
    await addItem(page, 'priority', 'Three');
    const list = page.locator('#priorities-list');

    await list.getByText('One', { exact: true }).click();

    await expect(list.locator('.item-text')).toHaveText(['Two', 'Three', 'One']);
    await expect(list.locator('.item-badge')).toHaveText(['1', '2', '3']);
  });

  test('sinking is a read-time view: stored priorities and tasks keep insertion order and the same ids across a reload', async ({
    page,
  }) => {
    await addItem(page, 'task', 'A');
    await addItem(page, 'task', 'B');
    await addItem(page, 'task', 'C');
    await page.locator('#tasks-list').getByText('A', { exact: true }).click();

    const readStoredTasks = () =>
      page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('antfarm.daily.v1'));
        const key = Object.keys(state.days)[0];
        return state.days[key].tasks.map((item) => ({ text: item.text, id: item.id }));
      });

    const before = await readStoredTasks();
    expect(before.map((item) => item.text)).toEqual(['A', 'B', 'C']);

    await page.reload();

    const after = await readStoredTasks();
    expect(after).toEqual(before);
    await expect(page.locator('#tasks-list .item-text')).toHaveText(['B', 'C', 'A']);
  });

  test('a completed commitment keeps its time position, a completed deadline keeps its due-date position, a completed week goal keeps its insertion position', async ({
    page,
  }) => {
    await addCommitment(page, 'Early', '08:00');
    await addCommitment(page, 'Mid', '12:00');
    await addCommitment(page, 'Late', '18:00');
    await page.locator('#commitments-list').getByText('Mid', { exact: true }).click();
    await expect(page.locator('#commitments-list .item-text')).toHaveText(['Early', 'Mid', 'Late']);

    await addDeadline(page, 'Soonest', '2026-10-01');
    await addDeadline(page, 'Middle', '2026-10-15');
    await addDeadline(page, 'Latest', '2026-11-01');
    await page.locator('#deadlines-list').getByText('Middle', { exact: true }).click();
    await expect(page.locator('#deadlines-list .item-text')).toHaveText(['Soonest', 'Middle', 'Latest']);

    await addGoal(page, 'One');
    await addGoal(page, 'Two');
    await addGoal(page, 'Three');
    await page.locator('#week-goals-list').getByText('One', { exact: true }).click();
    await expect(page.locator('#week-goals-list .item-text')).toHaveText(['One', 'Two', 'Three']);
  });

  test('sinking does not change week progress, the Unfinished count, or the week-strip has-work marker', async ({
    page,
  }) => {
    await addItem(page, 'task', 'A');
    await addItem(page, 'task', 'B');
    await addItem(page, 'task', 'C');
    await addItem(page, 'priority', 'P1');

    await page.locator('#tasks-list').getByText('A', { exact: true }).click();
    await page.locator('#tasks-list').getByText('C', { exact: true }).click();

    await expect(page.locator('#week-progress-text')).toHaveText('2 de 4 concluídos esta semana');
    await expect(page.locator('.week-day.is-selected')).toHaveClass(/has-work/);

    await page.locator('#prev-day').click();
    await addItem(page, 'task', 'Older unfinished');
    await page.locator('#today-btn').click();
    await expect(page.locator('#unfinished-summary')).toHaveText('1 item pendente de dias anteriores.');
  });

  test.describe('a large day (40 tasks, 3 priorities, 8 commitments, 12 deadlines)', () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.install({ time: new Date(`${LARGE_DAY_KEY}T09:00:00`) });
      await page.goto('/');
      await page.evaluate((seed) => localStorage.setItem('antfarm.daily.v1', JSON.stringify(seed)), largeDaySeed());
      await page.reload();
    });

    test('remains usable at 360, 768, 1024 and 1280px: no horizontal scroll, every panel heading/add-form input/submit button present and unclipped, and the #38 panel order holds; a new task can still be added', async ({
      page,
    }) => {
      const headings = [
        '#priorities-heading',
        '#tasks-heading',
        '#commitments-heading',
        '#notes-heading',
        '#unfinished-heading',
        '#week-heading',
        '#upcoming-heading',
      ];
      const inputs = [
        '#priority-input',
        '#task-input',
        '#commitment-time-input',
        '#commitment-input',
        '#goal-input',
        '#deadline-input',
        '#deadline-due-input',
      ];
      const submitButtons = [
        '#priority-form button[type=submit]',
        '#task-form button[type=submit]',
        '#commitment-form button[type=submit]',
        '#goal-form button[type=submit]',
        '#deadline-form button[type=submit]',
      ];

      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 });

        const fits = await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        );
        expect(fits, `width ${width}`).toBe(true);

        for (const selector of [...headings, ...inputs, ...submitButtons]) {
          const el = page.locator(selector);
          await expect(el, `${selector} at ${width}px`).toBeVisible();
          const clipped = await el.evaluate(
            (node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1
          );
          expect(clipped, `${selector} clipped at ${width}px`).toBe(false);
        }

        const panelOrder = await page.evaluate(() =>
          Array.from(document.querySelectorAll('main .panel')).map((el) => el.className)
        );
        expect(panelOrder[0], `${width}px`).toContain('priorities-panel');
        expect(panelOrder[1], `${width}px`).toContain('tasks-panel');
        expect(panelOrder[2], `${width}px`).toContain('commitments-panel');
        expect(panelOrder[3], `${width}px`).toContain('unfinished-panel');
        expect(panelOrder[4], `${width}px`).toContain('week-panel');
        expect(panelOrder[5], `${width}px`).toContain('upcoming-panel');

        const topOrder = await page.evaluate(() =>
          Array.from(document.querySelectorAll('main > *')).map((el) => el.className)
        );
        expect(topOrder[1], `${width}px`).toContain('notes-panel');
      }

      await addItem(page, 'task', 'Added to a large day');
      await expect(page.locator('#tasks-list')).toContainText('Added to a large day');
    });

    test('completing an item in a large list re-renders within the default timeout, with no console error', async ({
      page,
    }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      const target = page.locator('#tasks-list .item').nth(1); // not yet completed
      const id = await target.getAttribute('data-id');
      const yBefore = (await target.boundingBox()).y;

      await target.locator('.item-toggle').click();

      const movedItem = page.locator(`#tasks-list .item[data-id="${id}"]`);
      await expect(movedItem).toHaveClass(/is-complete/);
      const yAfter = (await movedItem.boundingBox()).y;
      expect(yAfter).toBeGreaterThan(yBefore);

      expect(errors).toHaveLength(0);
    });

    test('the large day shows no leftover word from the other language, in pt-BR and after switching to English', async ({
      page,
    }) => {
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt-BR');
      await assertNoLeftoverWords(page, [
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
        'Wednesday',
      ]);

      await page.locator('#lang-en-btn').click();
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('en-US');
      await assertNoLeftoverWords(page, [
        'Hoje',
        'Tarefas',
        'Prioridades',
        'Compromissos',
        'Pendências',
        'Adicionar',
        'Excluir',
        'Semana',
        'Atrasado',
        'Ontem',
        'setembro',
        'quarta-feira',
      ]);
    });

    test('captures evidence screenshots of the large day at 360px and 1280px in pt-BR, and of completed tasks sunk to the bottom', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 1600 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: 'screenshots/large-day-pt-br-mobile-360.png' });

      await page.setViewportSize({ width: 1280, height: 1400 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: 'screenshots/large-day-pt-br-desktop-1280.png' });

      await page.locator('.tasks-panel').screenshot({ path: 'screenshots/large-day-tasks-sunk.png' });
    });
  });
});

test.describe('visual identity: one accent, a self-hosted typeface, a real type scale (#46)', () => {
  const PANEL_SELECTOR = '.panel, .notes-panel';

  test('every panel and the notes panel use only solid or absent border styles', async ({ page }) => {
    await page.goto('/');
    const sides = await page.$$eval(PANEL_SELECTOR, (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle];
      })
    );
    for (const [top, right, bottom, left] of sides) {
      for (const style of [top, right, bottom, left]) {
        expect(['solid', 'none']).toContain(style);
      }
    }
  });

  test('styles.css contains no dashed, dotted or double border anywhere', () => {
    const css = fs.readFileSync(repoRoot + 'styles.css', 'utf8');
    expect(css).not.toMatch(/\b(dashed|dotted|double)\b/);
  });

  test('at most one panel carries a distinguishing top-edge accent, and it is Priorities', async ({ page }) => {
    await page.goto('/');
    const edges = await page.$$eval(PANEL_SELECTOR, (els) =>
      els.map((el) => ({
        isPriorities: el.classList.contains('priorities-panel'),
        key: `${getComputedStyle(el).borderTopWidth} ${getComputedStyle(el).borderTopColor}`,
      }))
    );
    const distinct = new Set(edges.map((e) => e.key));
    expect(distinct.size).toBeLessThanOrEqual(2);

    const others = edges.filter((e) => !e.isPriorities);
    expect(new Set(others.map((e) => e.key)).size).toBe(1);

    if (distinct.size === 2) {
      const priorities = edges.find((e) => e.isPriorities);
      expect(priorities.key).not.toBe(others[0].key);
    }
  });

  test('the typeface is self-hosted with a relative @font-face src and no third-party font host', async ({ page }) => {
    const css = fs.readFileSync(repoRoot + 'styles.css', 'utf8');
    const html = fs.readFileSync(repoRoot + 'index.html', 'utf8');

    expect(css).toMatch(/@font-face[\s\S]*?src:\s*url\(["']?\.\//);

    for (const needle of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn', 'http://', 'https://']) {
      expect(css.toLowerCase()).not.toContain(needle);
      expect(html.toLowerCase()).not.toContain(needle);
    }

    await page.goto('/');
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const firstFamily = fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    expect(firstFamily).toBe('Source Sans 3');
    expect(/,\s*(sans-serif|serif|monospace|system-ui)\s*$/i.test(fontFamily)).toBe(true);
  });

  test('the app survives the font not loading, at 360px', async ({ page }) => {
    // The aborted woff2 request itself makes Chromium log a browser-level
    // "Failed to load resource" line; that's expected noise from the abort,
    // not an application error, so only page script errors count here.
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) consoleErrors.push(msg.text());
    });
    await page.route('**/*.woff2', (route) => route.abort());
    await page.setViewportSize({ width: 360, height: 700 });
    await page.goto('/');

    await expect(page.locator('#today-date')).toBeVisible();

    const headings = page.locator('.panel-head h2');
    expect(await headings.count()).toBeGreaterThan(0);
    for (const heading of await headings.all()) {
      await expect(heading).toBeVisible();
    }

    const forms = page.locator('.add-form');
    expect(await forms.count()).toBeGreaterThan(0);
    for (const form of await forms.all()) {
      await expect(form).toBeVisible();
    }

    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the type scale is real: date heading > panel heading > meta text, driven by non-empty :root tokens', async ({
    page,
  }) => {
    await page.goto('/');

    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return [
        '--font-sans',
        '--weight-regular',
        '--weight-bold',
        '--line-normal',
        '--text-h1',
        '--text-h2',
        '--text-body',
        '--text-meta',
      ].map((name) => cs.getPropertyValue(name).trim());
    });
    for (const value of tokens) {
      expect(value).not.toBe('');
    }

    const sizes = await page.evaluate(() => ({
      h1: parseFloat(getComputedStyle(document.querySelector('#today-date')).fontSize),
      h2: parseFloat(getComputedStyle(document.querySelector('.panel-head h2')).fontSize),
      meta: parseFloat(getComputedStyle(document.querySelector('.panel-hint')).fontSize),
    }));
    expect(sizes.h1).toBeGreaterThan(sizes.h2);
    expect(sizes.h2).toBeGreaterThan(sizes.meta);
  });

  test('contrast: body text, meta text, accent text and the focus ring all clear WCAG minimums', async ({ page }) => {
    await page.goto('/');
    await page.locator('#prev-day').focus();

    const raw = await page.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      return {
        pageBg: cs(document.body).backgroundColor,
        panelBg: cs(document.querySelector('.priorities-panel')).backgroundColor,
        bodyText: cs(document.body).color,
        metaText: cs(document.querySelector('.panel-hint')).color,
        accentText: cs(document.querySelector('.eyebrow')).color,
        focusOutline: cs(document.querySelector('#prev-day')).outlineColor,
      };
    });

    expect(contrastRatio(parseRgb(raw.bodyText), parseRgb(raw.panelBg))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseRgb(raw.metaText), parseRgb(raw.panelBg))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseRgb(raw.accentText), parseRgb(raw.pageBg))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(parseRgb(raw.focusOutline), parseRgb(raw.panelBg))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(parseRgb(raw.focusOutline), parseRgb(raw.pageBg))).toBeGreaterThanOrEqual(3);
  });

  test('committed font files stay within the weight budget', () => {
    const dir = `${repoRoot}fonts`;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.woff2'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.length).toBeLessThanOrEqual(2);

    const totalBytes = files.reduce((sum, f) => sum + fs.statSync(`${dir}/${f}`).size, 0);
    expect(totalBytes).toBeLessThanOrEqual(200 * 1024);
  });
});

test.describe('a non-colour cue for today, and native inputs that match the product (Issue #48)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-16T09:00:00') }); // Wednesday
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('today is not colour-only: it differs from a plain sibling day by a non-colour property', async ({ page }) => {
    await page.locator('#prev-day').click(); // selects Tuesday; today (Wed) stays visible, unselected
    await expect(page.locator('.week-day.is-today')).not.toHaveClass(/is-selected/);

    const [todayWidth, plainWidth] = await page.evaluate(() => {
      const today = document.querySelector('.week-day.is-today');
      const plain = Array.from(document.querySelectorAll('.week-day')).find(
        (d) => !d.classList.contains('is-today') && !d.classList.contains('is-selected')
      );
      return [getComputedStyle(today).borderTopWidth, getComputedStyle(plain).borderTopWidth];
    });
    expect(todayWidth).not.toBe(plainWidth);
  });

  test('today+selected, today-only, selected-only and neither all produce distinct border-width/colour/font-weight combinations', async ({
    page,
  }) => {
    await page.locator('#prev-day').click(); // Tue selected, Wed (today) unselected: covers today-only, selected-only, neither

    const combos = await page.evaluate(() => {
      const days = Array.from(document.querySelectorAll('.week-day'));
      return days.map((d) => {
        const cs = getComputedStyle(d);
        const num = d.querySelector('.week-day-num');
        return {
          isToday: d.classList.contains('is-today'),
          isSelected: d.classList.contains('is-selected'),
          key: `${cs.borderTopWidth}|${cs.borderTopColor}|${getComputedStyle(num).fontWeight}`,
        };
      });
    });

    const neither = combos.find((c) => !c.isToday && !c.isSelected);
    const todayOnly = combos.find((c) => c.isToday && !c.isSelected);
    const selectedOnly = combos.find((c) => !c.isToday && c.isSelected);
    expect(neither).toBeTruthy();
    expect(todayOnly).toBeTruthy();
    expect(selectedOnly).toBeTruthy();

    await page.locator('#today-btn').click(); // today+selected
    const todaySelectedKey = await page.locator('.week-day.is-today.is-selected').evaluate((d) => {
      const cs = getComputedStyle(d);
      const num = d.querySelector('.week-day-num');
      return `${cs.borderTopWidth}|${cs.borderTopColor}|${getComputedStyle(num).fontWeight}`;
    });

    const keys = [neither.key, todayOnly.key, selectedOnly.key, todaySelectedKey];
    expect(new Set(keys).size).toBe(4);
  });

  test("#46's border-style and one-accent rules still hold unmodified", async () => {
    const css = fs.readFileSync(repoRoot + 'styles.css', 'utf8');
    expect(css).not.toMatch(/\b(dashed|dotted|double)\b/);
  });

  test('the three native date/time inputs share height, border, radius and font with the text inputs', async ({ page }) => {
    const props = await page.evaluate(() => {
      const pick = (id) => {
        const cs = getComputedStyle(document.getElementById(id));
        return {
          height: cs.height,
          borderWidth: cs.borderWidth,
          borderRadius: cs.borderRadius,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
        };
      };
      return {
        task: pick('task-input'),
        jump: pick('jump-date-input'),
        time: pick('commitment-time-input'),
        due: pick('deadline-due-input'),
      };
    });
    for (const key of ['jump', 'time', 'due']) {
      expect(props[key], key).toEqual(props.task);
    }
  });

  test('the three native inputs get the same focus ring as a focused text input', async ({ page }) => {
    await page.locator('#task-input').focus();
    const taskOutlineColor = await page.locator('#task-input').evaluate((el) => getComputedStyle(el).outlineColor);

    for (const id of ['jump-date-input', 'commitment-time-input', 'deadline-due-input']) {
      const el = page.locator(`#${id}`);
      await el.focus();
      const style = await el.evaluate((node) => ({
        outlineStyle: getComputedStyle(node).outlineStyle,
        outlineColor: getComputedStyle(node).outlineColor,
      }));
      expect(style.outlineStyle, id).not.toBe('none');
      expect(style.outlineColor, id).toBe(taskOutlineColor);
    }
  });

  test('the jump-to-date label is visible, matches the jumpDateLabel catalogue in both languages, and stays wired to the input', async ({
    page,
  }) => {
    const label = page.locator('label[for="jump-date-input"]');
    await expect(label).toBeVisible();
    await expect(label).not.toHaveClass(/sr-only/);
    await expect(label).toHaveText('Ir para uma data');
    expect(await label.getAttribute('for')).toBe('jump-date-input');

    await page.locator('#lang-en-btn').click();
    await expect(label).toBeVisible();
    await expect(label).toHaveText('Jump to a date');
    await expect(page.locator('#jump-date-input')).toHaveAccessibleName('Jump to a date');

    await assertNoLeftoverWords(page, ['Ir para uma data']);
  });

  test('the pt-BR and en-US catalogue key sets stay unchanged and identical (no new key was added)', async ({ page }) => {
    const keySets = await page.evaluate(async () => {
      const { catalogues } = await import('/i18n.js');
      return Object.fromEntries(Object.entries(catalogues).map(([lang, strings]) => [lang, Object.keys(strings).sort()]));
    });
    const [first, ...rest] = Object.values(keySets);
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });

  test('at 360, 768, 1024 and 1280px, the visible jump label does not overflow, overlap the week strip, or break the #38 panel order, in either language', async ({
    page,
  }) => {
    for (const lang of ['pt', 'en']) {
      if (lang === 'en') await page.locator('#lang-en-btn').click();

      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 });

        const fits = await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        );
        expect(fits, `${lang} ${width}px`).toBe(true);

        const header = page.locator('.day-header');
        const headerOverflows = await header.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(headerOverflows, `${lang} ${width}px`).toBe(false);

        const [weekBox, jumpLabelBox] = await Promise.all([
          page.locator('.week-strip').boundingBox(),
          page.locator('label[for="jump-date-input"]').boundingBox(),
        ]);
        expect(jumpLabelBox.y, `${lang} ${width}px`).toBeGreaterThanOrEqual(weekBox.y + weekBox.height - 1);

        const panelOrder = await page.evaluate(() =>
          Array.from(document.querySelectorAll('main .panel')).map((el) => el.className)
        );
        expect(panelOrder[0], `${lang} ${width}px`).toContain('priorities-panel');
        expect(panelOrder[1], `${lang} ${width}px`).toContain('tasks-panel');
        expect(panelOrder[2], `${lang} ${width}px`).toContain('commitments-panel');
      }
    }
  });

  test('captures evidence of today unselected in the week strip at 1280px, and the header inputs at 360px', async ({
    page,
  }) => {
    await page.locator('#prev-day').click(); // Tue selected; Wed (today) visible but unselected
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/week-strip-today-unselected-1280.png' });

    await page.locator('#today-btn').click();
    await page.setViewportSize({ width: 360, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'screenshots/header-inputs-360.png' });
  });
});
