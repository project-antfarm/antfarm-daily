// Pure state module: no DOM access. app.js wires this to the page.

export const STORAGE_KEY = 'antfarm.daily.v1';
export const MAX_PRIORITIES = 3;
export const LISTS = ['priorities', 'tasks'];

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
  return day.priorities.length > 0 || day.tasks.length > 0;
}

function emptyDay() {
  return { priorities: [], tasks: [] };
}

function emptyState() {
  return { version: 1, days: {} };
}

export function getDay(state, key) {
  return state.days[key] ?? emptyDay();
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
export function addItem(state, key, list, text) {
  const trimmed = text.trim();
  if (!trimmed) return { state, error: 'empty' };
  const day = getDay(state, key);
  if (list === 'priorities' && day.priorities.length >= MAX_PRIORITIES) {
    return { state, error: 'limit' };
  }
  const item = { id: crypto.randomUUID(), text: trimmed, completed: false };
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
