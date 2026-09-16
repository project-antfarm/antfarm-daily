// Pure persistence logic for daily tasks. No DOM access, so it can be
// unit-tested with a plain in-memory stand-in for the Storage interface
// (getItem/setItem) and used as-is against window.localStorage in the app.

const STORAGE_PREFIX = 'antfarm-daily:tasks:';

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function storageKeyFor(key) {
  return `${STORAGE_PREFIX}${key}`;
}

export function loadTasks(storage, key) {
  const raw = storage.getItem(storageKeyFor(key));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTasks(storage, key, tasks) {
  storage.setItem(storageKeyFor(key), JSON.stringify(tasks));
}

function createTask(text) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    completed: false,
  };
}

export function addTask(storage, key, text) {
  const tasks = loadTasks(storage, key);
  const updated = [...tasks, createTask(text)];
  saveTasks(storage, key, updated);
  return updated;
}

export function toggleTask(storage, key, id) {
  const tasks = loadTasks(storage, key);
  const updated = tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  saveTasks(storage, key, updated);
  return updated;
}

export function deleteTask(storage, key, id) {
  const tasks = loadTasks(storage, key);
  const updated = tasks.filter((task) => task.id !== id);
  saveTasks(storage, key, updated);
  return updated;
}
