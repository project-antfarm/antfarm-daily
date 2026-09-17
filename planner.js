// Pure state module: no DOM, no localStorage global. app.js wires this to the page.

export const STORAGE_KEY = 'antfarm-daily:v1';
export const MAX_PRIORITIES = 3;

export function emptyState() {
  return { priorities: [], tasks: [], commitments: [] };
}

function makeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function add(state, list, text, time) {
  const trimmed = String(text).trim();
  if (!trimmed) return { ok: false, state, reason: 'empty' };
  if (list === 'commitments' && !time) {
    return { ok: false, state, reason: 'time' };
  }
  if (list === 'priorities' && state.priorities.length >= MAX_PRIORITIES) {
    return { ok: false, state, reason: 'limit' };
  }
  const item = { id: makeId(), text: trimmed, done: false };
  if (list === 'commitments') item.time = time;
  const items = [...state[list], item];
  if (list === 'commitments') items.sort((a, b) => a.time.localeCompare(b.time));
  return { ok: true, state: { ...state, [list]: items } };
}

export function toggleComplete(state, list, id) {
  return {
    ...state,
    [list]: state[list].map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
  };
}

export function remove(state, list, id) {
  return { ...state, [list]: state[list].filter((item) => item.id !== id) };
}

export function load(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    return {
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
    };
  } catch {
    return emptyState();
  }
}

export function save(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
