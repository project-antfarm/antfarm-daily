import {
  load,
  save,
  addItem,
  toggleItem,
  removeItem,
  todayKey,
  parseKey,
  addDays,
  weekKeys,
  weekStart,
  weekProgress,
  dayHasWork,
  getDay,
  getWeek,
  setNote,
  addGoal,
  toggleGoal,
  removeGoal,
  getDeadlines,
  addDeadline,
  toggleDeadline,
  removeDeadline,
  deadlineLabel,
  approachingSummary,
  unfinishedBefore,
  moveItem,
  MAX_PRIORITIES,
} from './state.js';
import { t, getLang, setLang } from './i18n.js';

// Fills every markup element that carries a data-i18n* attribute from the
// active catalogue. Called at boot and again on every language switch.
// Elements whose text changes on every render (the eyebrow, the date
// heading, panel summaries...) are set directly by render() instead and
// carry no data-i18n attribute.
function applyStaticText() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

const langPtBtn = document.getElementById('lang-pt-btn');
const langEnBtn = document.getElementById('lang-en-btn');

function updateLangSwitch() {
  const lang = getLang();
  langPtBtn.setAttribute('aria-pressed', String(lang === 'pt-BR'));
  langEnBtn.setAttribute('aria-pressed', String(lang === 'en-US'));
}

const eyebrow = document.getElementById('day-eyebrow');
const dateHeading = document.getElementById('today-date');
const weekStripEl = document.getElementById('week-strip');
const prevBtn = document.getElementById('prev-day');
const nextBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const listEls = {
  priorities: document.getElementById('priorities-list'),
  tasks: document.getElementById('tasks-list'),
  commitments: document.getElementById('commitments-list'),
};
const emptyEls = {
  priorities: document.getElementById('priorities-empty'),
  tasks: document.getElementById('tasks-empty'),
  commitments: document.getElementById('commitments-empty'),
};
const forms = {
  priorities: document.getElementById('priority-form'),
  tasks: document.getElementById('task-form'),
  commitments: document.getElementById('commitment-form'),
};
const inputs = {
  priorities: document.getElementById('priority-input'),
  tasks: document.getElementById('task-input'),
  commitments: document.getElementById('commitment-input'),
};
const timeInput = document.getElementById('commitment-time-input');
const notesInput = document.getElementById('notes-input');
const limitMsg = document.getElementById('priority-limit-msg');
const commitmentMsg = document.getElementById('commitment-msg');

const weekProgressText = document.getElementById('week-progress-text');
const weekProgressFill = document.getElementById('week-progress-fill');
const weekGoalsList = document.getElementById('week-goals-list');
const weekGoalsEmpty = document.getElementById('week-goals-empty');
const goalForm = document.getElementById('goal-form');
const goalInput = document.getElementById('goal-input');
const goalMsg = document.getElementById('goal-msg');
const weekHeading = document.getElementById('week-heading');

const unfinishedList = document.getElementById('unfinished-list');
const unfinishedSummaryEl = document.getElementById('unfinished-summary');
const unfinishedMsg = document.getElementById('unfinished-msg');

const deadlinesList = document.getElementById('deadlines-list');
const deadlinesEmpty = document.getElementById('deadlines-empty');
const deadlinesSummary = document.getElementById('deadlines-summary');
const deadlineForm = document.getElementById('deadline-form');
const deadlineInput = document.getElementById('deadline-input');
const deadlineDueInput = document.getElementById('deadline-due-input');
const deadlineMsg = document.getElementById('deadline-msg');

let state = load();

// In-memory only (never persisted): the app always opens on today. Starts
// out "following" today so a session left open across midnight keeps
// tracking the real current day until the person navigates away from it.
let selectedDay = todayKey();
let followingToday = true;

// Derives the day key at the moment it's needed (render, or a write),
// instead of caching it once — the fix for the midnight-rollover defect.
function activeDay() {
  if (followingToday) selectedDay = todayKey();
  return selectedDay;
}

function selectDay(dayKey) {
  selectedDay = dayKey;
  followingToday = dayKey === todayKey();
  render();
}

function formatDate(key) {
  return parseKey(key).toLocaleDateString(getLang(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDueDate(key) {
  return parseKey(key).toLocaleDateString(getLang(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderItem(key, list, item, index) {
  const li = document.createElement('li');
  li.className = 'item' + (item.completed ? ' is-complete' : '');
  li.dataset.id = item.id;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'item-toggle';
  toggle.setAttribute('aria-pressed', String(item.completed));
  toggle.addEventListener('click', () => {
    state = toggleItem(state, key, list, item.id);
    save(state);
    render();
  });

  if (list === 'priorities') {
    const badge = document.createElement('span');
    badge.className = 'item-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = String(index + 1);
    toggle.appendChild(badge);
  }

  if (list === 'commitments') {
    const time = document.createElement('span');
    time.className = 'item-time';
    time.textContent = item.time;
    toggle.appendChild(time);
  }

  const check = document.createElement('span');
  check.className = 'item-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = item.completed ? '✓' : '';
  toggle.appendChild(check);

  const text = document.createElement('span');
  text.className = 'item-text';
  text.textContent = item.text;
  toggle.appendChild(text);

  const status = document.createElement('span');
  status.className = 'sr-only';
  status.textContent = item.completed ? t('itemCompleted') : t('itemNotCompleted');
  toggle.appendChild(status);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'item-delete';
  del.setAttribute('aria-label', t('itemDeleteLabel', { text: item.text }));
  del.textContent = '✕';
  del.addEventListener('click', () => {
    if (!window.confirm(t('itemDeleteConfirm', { text: item.text }))) return;
    state = removeItem(state, key, list, item.id);
    save(state);
    render();
  });

  li.append(toggle, del);
  return li;
}

function renderGoal(weekKey, item) {
  const li = document.createElement('li');
  li.className = 'item' + (item.completed ? ' is-complete' : '');
  li.dataset.id = item.id;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'item-toggle';
  toggle.setAttribute('aria-pressed', String(item.completed));
  toggle.addEventListener('click', () => {
    state = toggleGoal(state, weekKey, item.id);
    save(state);
    render();
  });

  const check = document.createElement('span');
  check.className = 'item-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = item.completed ? '✓' : '';
  toggle.appendChild(check);

  const text = document.createElement('span');
  text.className = 'item-text';
  text.textContent = item.text;
  toggle.appendChild(text);

  const status = document.createElement('span');
  status.className = 'sr-only';
  status.textContent = item.completed ? t('itemCompleted') : t('itemNotCompleted');
  toggle.appendChild(status);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'item-delete';
  del.setAttribute('aria-label', t('itemDeleteLabel', { text: item.text }));
  del.textContent = '✕';
  del.addEventListener('click', () => {
    if (!window.confirm(t('itemDeleteConfirm', { text: item.text }))) return;
    state = removeGoal(state, weekKey, item.id);
    save(state);
    render();
  });

  li.append(toggle, del);
  return li;
}

function renderDeadline(item, today) {
  const li = document.createElement('li');
  li.className = 'item' + (item.completed ? ' is-complete' : '');
  li.dataset.id = item.id;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'item-toggle';
  toggle.setAttribute('aria-pressed', String(item.completed));
  toggle.addEventListener('click', () => {
    state = toggleDeadline(state, item.id);
    save(state);
    render();
  });

  const check = document.createElement('span');
  check.className = 'item-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = item.completed ? '✓' : '';
  toggle.appendChild(check);

  const text = document.createElement('span');
  text.className = 'item-text';
  text.textContent = item.text;
  toggle.appendChild(text);

  const meta = document.createElement('span');
  meta.className = 'item-meta';

  const due = document.createElement('span');
  due.className = 'item-due';
  due.textContent = formatDueDate(item.due);
  meta.appendChild(due);

  const label = deadlineLabel(item.due, today);
  if (label) {
    const urgency = document.createElement('span');
    urgency.className = 'item-urgency';
    urgency.textContent = label;
    meta.appendChild(urgency);
  }

  toggle.appendChild(meta);

  const status = document.createElement('span');
  status.className = 'sr-only';
  status.textContent = item.completed ? t('itemCompleted') : t('itemNotCompleted');
  toggle.appendChild(status);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'item-delete';
  del.setAttribute('aria-label', t('itemDeleteLabel', { text: item.text }));
  del.textContent = '✕';
  del.addEventListener('click', () => {
    if (!window.confirm(t('itemDeleteConfirm', { text: item.text }))) return;
    state = removeDeadline(state, item.id);
    save(state);
    render();
  });

  li.append(toggle, del);
  return li;
}

// Textual origin label — never conveyed by color or position alone. "Yesterday"
// relative to the selected day (not the real today), since the panel itself
// is scoped to the selected day.
function originLabel(originKey, selectedKey) {
  if (originKey === addDays(selectedKey, -1)) return t('unfinishedOrigin');
  return parseKey(originKey).toLocaleDateString(getLang(), { weekday: 'short', month: 'short', day: 'numeric' });
}

function unfinishedSummaryText(count) {
  if (count === 0) return t('unfinishedNone');
  return t(count === 1 ? 'unfinishedOne' : 'unfinishedMany', { count });
}

function renderUnfinishedRow(entry, selectedKey) {
  const li = document.createElement('li');
  li.className = 'unfinished-row';
  li.dataset.id = entry.item.id;

  const info = document.createElement('div');
  info.className = 'unfinished-info';

  const text = document.createElement('span');
  text.className = 'item-text';
  text.textContent = entry.item.text;
  info.appendChild(text);

  const origin = document.createElement('span');
  origin.className = 'unfinished-origin';
  origin.textContent = originLabel(entry.dayKey, selectedKey);
  info.appendChild(origin);

  const actions = document.createElement('div');
  actions.className = 'unfinished-actions';

  const completeBtn = document.createElement('button');
  completeBtn.type = 'button';
  completeBtn.className = 'unfinished-btn unfinished-complete';
  completeBtn.textContent = t('unfinishedComplete');
  completeBtn.setAttribute('aria-label', t('unfinishedCompleteLabel', { text: entry.item.text, origin: origin.textContent }));
  completeBtn.addEventListener('click', () => {
    state = toggleItem(state, entry.dayKey, entry.list, entry.item.id);
    save(state);
    render();
  });

  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'unfinished-btn unfinished-move';
  moveBtn.textContent = t('unfinishedMove');
  moveBtn.setAttribute('aria-label', t('unfinishedMoveLabel', { text: entry.item.text, origin: origin.textContent }));
  moveBtn.addEventListener('click', () => {
    unfinishedMsg.hidden = true;
    const result = moveItem(state, entry.dayKey, entry.list, entry.item.id, selectedKey);
    if (result.error === 'limit') {
      unfinishedMsg.hidden = false;
      return;
    }
    state = result.state;
    save(state);
    render();
  });

  actions.append(completeBtn, moveBtn);
  li.append(info, actions);
  return li;
}

function renderUnfinishedPanel(dayKey) {
  const entries = unfinishedBefore(state, dayKey);
  unfinishedList.innerHTML = '';
  entries.forEach((entry) => unfinishedList.appendChild(renderUnfinishedRow(entry, dayKey)));
  unfinishedSummaryEl.textContent = unfinishedSummaryText(entries.length);
}

function progressLabel({ completed, total }) {
  if (total === 0) return t('weekProgressNone');
  return t(completed === 1 ? 'weekProgressOne' : 'weekProgressMany', { completed, total });
}

function weekHeadingText(dayKey) {
  const weekKey = weekStart(dayKey);
  if (weekKey === weekStart(todayKey())) return t('weekHeading');
  return t('weekHeadingOf', { date: formatDueDate(weekKey) });
}

function renderWeekPanel(dayKey) {
  const weekKey = weekStart(dayKey);
  const week = getWeek(state, weekKey);

  weekHeading.textContent = weekHeadingText(dayKey);

  weekGoalsList.innerHTML = '';
  weekGoalsEmpty.hidden = week.goals.length > 0;
  week.goals.forEach((item) => weekGoalsList.appendChild(renderGoal(weekKey, item)));

  const progress = weekProgress(state, dayKey);
  weekProgressText.textContent = progressLabel(progress);
  const percent = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  weekProgressFill.style.width = `${percent}%`;
}

function renderDeadlinesPanel() {
  const today = todayKey();
  const deadlines = getDeadlines(state);

  deadlinesList.innerHTML = '';
  deadlinesEmpty.hidden = deadlines.length > 0;
  deadlines.forEach((item) => deadlinesList.appendChild(renderDeadline(item, today)));
  deadlinesSummary.textContent = approachingSummary(deadlines, today);
}

function renderWeekStrip(key) {
  const today = todayKey();
  weekStripEl.innerHTML = '';

  for (const dayKey of weekKeys(key)) {
    const isSelected = dayKey === key;
    const isToday = dayKey === today;
    const hasWork = dayHasWork(getDay(state, dayKey));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'week-day' + (isToday ? ' is-today' : '') + (hasWork ? ' has-work' : '');
    if (isSelected) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-current', 'date');
    }

    const date = parseKey(dayKey);
    const letter = document.createElement('span');
    letter.className = 'week-day-label';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = date.toLocaleDateString(getLang(), { weekday: 'short' });

    const num = document.createElement('span');
    num.className = 'week-day-num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(date.getDate());

    const dot = document.createElement('span');
    dot.className = 'week-day-dot';
    dot.setAttribute('aria-hidden', 'true');

    let label = date.toLocaleDateString(getLang(), { weekday: 'long', month: 'long', day: 'numeric' });
    if (isToday) label += t('weekDayToday');
    if (hasWork) label += t('weekDayHasWork');
    btn.setAttribute('aria-label', label);

    btn.append(letter, num, dot);
    btn.addEventListener('click', () => selectDay(dayKey));
    weekStripEl.appendChild(btn);
  }
}

function render() {
  const key = activeDay();
  const isToday = key === todayKey();

  eyebrow.textContent = isToday ? t('dayToday') : t('dayViewing');
  dateHeading.textContent = formatDate(key);

  const day = getDay(state, key);

  for (const list of ['priorities', 'tasks', 'commitments']) {
    const items = day[list];
    listEls[list].innerHTML = '';
    emptyEls[list].hidden = items.length > 0;
    items.forEach((item, index) => listEls[list].appendChild(renderItem(key, list, item, index)));
  }
  notesInput.value = day.notes;

  const atLimit = day.priorities.length >= MAX_PRIORITIES;
  limitMsg.hidden = !atLimit;
  inputs.priorities.disabled = atLimit;
  commitmentMsg.hidden = true;
  goalMsg.hidden = true;
  deadlineMsg.hidden = true;
  unfinishedMsg.hidden = true;

  renderWeekStrip(key);
  renderUnfinishedPanel(key);
  renderWeekPanel(key);
  renderDeadlinesPanel();
}

function handleSubmit(list) {
  return (event) => {
    event.preventDefault();
    const key = activeDay();
    const input = inputs[list];
    const time = list === 'commitments' ? timeInput.value : undefined;
    const result = addItem(state, key, list, input.value, time);
    if (result.error === 'limit') {
      limitMsg.hidden = false;
      return;
    }
    if (result.error === 'empty') {
      if (list === 'commitments') commitmentMsg.hidden = false;
      return;
    }
    state = result.state;
    save(state);
    input.value = '';
    if (list === 'commitments') timeInput.value = '';
    render();
    input.focus();
  };
}

forms.priorities.addEventListener('submit', handleSubmit('priorities'));
forms.tasks.addEventListener('submit', handleSubmit('tasks'));
forms.commitments.addEventListener('submit', handleSubmit('commitments'));

goalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const weekKey = weekStart(activeDay());
  const result = addGoal(state, weekKey, goalInput.value);
  if (result.error === 'empty') {
    goalMsg.hidden = false;
    return;
  }
  state = result.state;
  save(state);
  goalInput.value = '';
  render();
  goalInput.focus();
});

deadlineForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = addDeadline(state, deadlineInput.value, deadlineDueInput.value);
  if (result.error === 'empty') {
    deadlineMsg.hidden = false;
    return;
  }
  state = result.state;
  save(state);
  deadlineInput.value = '';
  deadlineDueInput.value = '';
  render();
  deadlineInput.focus();
});

// Committed on a debounce (so typing never hits localStorage on every
// keystroke) and flushed early on blur or page unload, so a pending edit
// isn't lost to a stray reload or tab close before the debounce fires. Guarded
// by `noteDirty` so blur/unload are no-ops when nothing was typed — without
// it, every reload (including one that only just seeded localStorage for a
// test) would re-save the in-memory `state` it booted with and clobber
// whatever was written to storage after that boot, breaking the "a day isn't
// rewritten just by navigating" rule from #23. No render() call: the
// textarea already shows exactly what it's saving, and nothing else on the
// page reads notes (see DECISIONS.md), so there's nothing to redraw.
const NOTE_SAVE_DEBOUNCE_MS = 500;
let noteSaveTimer = null;
let noteDirty = false;

function commitNote() {
  clearTimeout(noteSaveTimer);
  noteSaveTimer = null;
  if (!noteDirty) return;
  noteDirty = false;
  state = setNote(state, activeDay(), notesInput.value);
  save(state);
}

notesInput.addEventListener('input', () => {
  noteDirty = true;
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(commitNote, NOTE_SAVE_DEBOUNCE_MS);
});
notesInput.addEventListener('blur', commitNote);
window.addEventListener('beforeunload', commitNote);

prevBtn.addEventListener('click', () => selectDay(addDays(activeDay(), -1)));
nextBtn.addEventListener('click', () => selectDay(addDays(activeDay(), 1)));
todayBtn.addEventListener('click', () => selectDay(todayKey()));

// Switching language re-applies static markup and re-renders in place —
// no page reload — so `documentElement.lang`, the title, every data-i18n
// element and everything render() writes all move together.
function switchLang(lang) {
  if (lang === getLang()) return;
  setLang(lang);
  document.documentElement.lang = getLang();
  applyStaticText();
  updateLangSwitch();
  render();
}
langPtBtn.addEventListener('click', () => switchLang('pt-BR'));
langEnBtn.addEventListener('click', () => switchLang('en-US'));

document.documentElement.lang = getLang();
applyStaticText();
updateLangSwitch();
render();
