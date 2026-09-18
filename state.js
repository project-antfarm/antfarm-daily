// Pure state module: no DOM access. app.js wires this to the page.

export const STORAGE_KEY = 'antfarm.daily.v1';
export const MAX_PRIORITIES = 3;
export const LISTS = ['priorities', 'tasks', 'commitments'];

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, delta) {
  const date = parseKey(key);
  date.setDate(date.getDate() + delta);
  return todayKey(date);
}

// Monday-start week (ISO-style), independent of locale.
const WEEK_START_DAY = 1;

export function weekStart(key) {
  const date = parseKey(key);
  const diff = (date.getDay() - WEEK_START_DAY + 7) % 7;
  date.setDate(date.getDate() - diff);
  return todayKey(date);
}

export function weekKeys(key) {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dayHasWork(day) {
  return day.priorities.length > 0 || day.tasks.length > 0 || day.commitments.length > 0;
}

function emptyDay() {
  return { priorities: [], tasks: [], commitments: [] };
}

function emptyWeek() {
  return { goals: [] };
}

function emptyState() {
  return { version: 1, days: {}, weeks: {}, deadlines: [] };
}

function sortByTime(commitments) {
  return [...commitments].sort((a, b) => a.time.localeCompare(b.time));
}

// Normalises a stored day to always carry every list, so older records
// written before `commitments` existed don't hand callers `undefined`.
export function getDay(state, key) {
  const day = state.days[key];
  if (!day) return emptyDay();
  return {
    priorities: day.priorities ?? [],
    tasks: day.tasks ?? [],
    commitments: sortByTime(day.commitments ?? []),
  };
}

// Normalises a stored week to always carry `goals`, the same way `getDay`
// covers records written before a key existed — including the common case
// of a whole `weeks` map missing from state written before this feature.
export function getWeek(state, key) {
  const week = state.weeks?.[key];
  if (!week) return emptyWeek();
  return { goals: week.goals ?? [] };
}

// Sums completed/total across priorities, tasks and commitments over every
// day of the week containing `dayKey`. Week goals are a separate list and
// are not counted here.
export function weekProgress(state, dayKey) {
  let completed = 0;
  let total = 0;
  for (const key of weekKeys(dayKey)) {
    const day = getDay(state, key);
    for (const list of LISTS) {
      for (const item of day[list]) {
        total += 1;
        if (item.completed) completed += 1;
      }
    }
  }
  return { completed, total };
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.days) return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

export function save(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function withDay(state, key, day) {
  return { ...state, days: { ...state.days, [key]: day } };
}

// Returns { state, error } where error is null, 'empty' or 'limit'.
export function addItem(state, key, list, text, time) {
  const trimmed = text.trim();
  if (!trimmed) return { state, error: 'empty' };
  if (list === 'commitments' && !time) return { state, error: 'empty' };
  const day = getDay(state, key);
  if (list === 'priorities' && day.priorities.length >= MAX_PRIORITIES) {
    return { state, error: 'limit' };
  }
  const item = { id: crypto.randomUUID(), text: trimmed, completed: false };
  if (list === 'commitments') item.time = time;
  const nextDay = { ...day, [list]: [...day[list], item] };
  return { state: withDay(state, key, nextDay), error: null };
}

export function toggleItem(state, key, list, id) {
  const day = getDay(state, key);
  const nextDay = {
    ...day,
    [list]: day[list].map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
  };
  return withDay(state, key, nextDay);
}

export function removeItem(state, key, list, id) {
  const day = getDay(state, key);
  const nextDay = { ...day, [list]: day[list].filter((item) => item.id !== id) };
  return withDay(state, key, nextDay);
}

// Finds incomplete priorities and tasks from every stored day strictly
// before `dayKey` — the data the Unfinished panel surfaces. This is derived
// from `state.days` at read time, never stored or swept on load, so past
// days stay byte-identical until the person explicitly acts on an item (see
// DECISIONS.md). Reads route through `getDay` so a partial/old payload can't
// throw. Commitments and week goals are deliberately excluded. Ordered by
// origin day descending (most recent first): the freshest unfinished work is
// the most likely to still matter.
export function unfinishedBefore(state, dayKey) {
  const keys = Object.keys(state.days)
    .filter((key) => key < dayKey)
    .sort()
    .reverse();
  const result = [];
  for (const key of keys) {
    const day = getDay(state, key);
    for (const list of ['priorities', 'tasks']) {
      for (const item of day[list]) {
        if (!item.completed) result.push({ item, dayKey: key, list });
      }
    }
  }
  return result;
}

// Moves an item from one day's list to another day's same list (a priority
// stays a priority, a task stays a task) — one function rather than the
// Unfinished panel's "move" action open-coding a remove + add. Returns
// { state, error } where error is null or 'limit': moving a priority into a
// day already at MAX_PRIORITIES would otherwise either silently drop it or
// silently break the 3-priority rule, so it's refused instead, the same
// visible-message shape `addItem`'s limit error already uses.
export function moveItem(state, fromKey, list, id, toKey) {
  const fromDay = getDay(state, fromKey);
  const item = fromDay[list].find((entry) => entry.id === id);
  if (!item) return { state, error: null };
  if (list === 'priorities') {
    const toDay = getDay(state, toKey);
    if (toDay.priorities.length >= MAX_PRIORITIES) return { state, error: 'limit' };
  }
  const nextFromDay = { ...fromDay, [list]: fromDay[list].filter((entry) => entry.id !== id) };
  const afterRemove = withDay(state, fromKey, nextFromDay);
  const toDay = getDay(afterRemove, toKey);
  const nextToDay = { ...toDay, [list]: [...toDay[list], item] };
  return { state: withDay(afterRemove, toKey, nextToDay), error: null };
}

function withWeek(state, key, week) {
  return { ...state, weeks: { ...state.weeks, [key]: week } };
}

// Returns { state, error } where error is null or 'empty'. Dedicated
// functions rather than generalising addItem/toggleItem/removeItem: those
// key into `state.days` by day key with a fixed set of lists (and a
// priorities limit), while goals key into `state.weeks` by week key with a
// single list and no limit — sharing them would need a branch on which
// top-level map and key to use for every call, which is more code than
// three small week-scoped functions.
export function addGoal(state, weekKey, text) {
  const trimmed = text.trim();
  if (!trimmed) return { state, error: 'empty' };
  const week = getWeek(state, weekKey);
  const item = { id: crypto.randomUUID(), text: trimmed, completed: false };
  const nextWeek = { ...week, goals: [...week.goals, item] };
  return { state: withWeek(state, weekKey, nextWeek), error: null };
}

export function toggleGoal(state, weekKey, id) {
  const week = getWeek(state, weekKey);
  const nextWeek = {
    ...week,
    goals: week.goals.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
  };
  return withWeek(state, weekKey, nextWeek);
}

export function removeGoal(state, weekKey, id) {
  const week = getWeek(state, weekKey);
  const nextWeek = { ...week, goals: week.goals.filter((item) => item.id !== id) };
  return withWeek(state, weekKey, nextWeek);
}

// A deadline is not tied to any single day, so it lives at the top level
// (`state.deadlines`) rather than under `days[key]` — the same reasoning
// #12 anticipated and #18 followed for week goals.
function isValidDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return todayKey(parseKey(key)) === key;
}

function withDeadlines(state, deadlines) {
  return { ...state, deadlines };
}

// Normalises a missing `deadlines` list on read, the same way `getDay`
// (#16) and `getWeek` (#18) absorb payloads written before this feature —
// and returns it sorted by `due` ascending so no caller re-sorts.
export function getDeadlines(state) {
  const deadlines = state.deadlines ?? [];
  return [...deadlines].sort((a, b) => a.due.localeCompare(b.due));
}

// Returns { state, error } where error is null or 'empty' — covering both
// missing text and a missing/unparseable due date, the same one-message
// pattern `addItem` already uses for a commitment missing its time.
export function addDeadline(state, text, due) {
  const trimmed = text.trim();
  if (!trimmed || !isValidDateKey(due)) return { state, error: 'empty' };
  const item = { id: crypto.randomUUID(), text: trimmed, due, completed: false };
  const deadlines = state.deadlines ?? [];
  return { state: withDeadlines(state, [...deadlines, item]), error: null };
}

export function toggleDeadline(state, id) {
  const deadlines = state.deadlines ?? [];
  const next = deadlines.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item));
  return withDeadlines(state, next);
}

export function removeDeadline(state, id) {
  const deadlines = state.deadlines ?? [];
  const next = deadlines.filter((item) => item.id !== id);
  return withDeadlines(state, next);
}

// The "approaching" window: within this many days, urgency is a count
// ("due in N days"); beyond it, the calendar date matters more than the
// count, so the label switches to a plain date. The same threshold drives
// `approachingSummary`'s "due soon" count, so the label wording and the
// summary count never disagree about what "soon" means.
const APPROACHING_DAYS = 7;

function daysBetween(fromKey, toKey) {
  return Math.round((parseKey(toKey) - parseKey(fromKey)) / 86400000);
}

// Pure text label for a deadline's urgency, computed against `todayKey`
// (always the real today at render time, per #14's `activeDay()` — never
// the selected day) rather than a color or position, so it reads the same
// in grayscale or to a screen reader. Beyond the approaching window there is
// no urgency to report — the due date itself (already shown next to the
// item) is all that matters — so it returns '' rather than repeating that
// date in a second place.
export function deadlineLabel(due, todayKeyValue) {
  const diff = daysBetween(todayKeyValue, due);
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff <= APPROACHING_DAYS) return `Due in ${diff} days`;
  return '';
}

// One line answering "is anything important approaching?" without reading
// the whole list. Completed deadlines are excluded from both counts, so
// finishing something already late removes it from "overdue".
export function approachingSummary(deadlines, todayKeyValue) {
  if (deadlines.length === 0) return 'No deadlines yet.';
  const active = deadlines.filter((item) => !item.completed);
  const overdue = active.filter((item) => item.due < todayKeyValue).length;
  const dueSoon = active.filter(
    (item) => item.due >= todayKeyValue && daysBetween(todayKeyValue, item.due) <= APPROACHING_DAYS
  ).length;
  if (overdue === 0 && dueSoon === 0) return 'Nothing due soon.';
  const parts = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueSoon > 0) parts.push(`${dueSoon} due soon`);
  return `${parts.join(', ')}.`;
}
