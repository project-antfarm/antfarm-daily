import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, loadTasks, saveTasks, addTask, toggleTask, deleteTask } from '../js/storage.js';

class FakeStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
}

test('dateKey formats a date as YYYY-MM-DD', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('loadTasks returns an empty array when nothing is stored', () => {
  const storage = new FakeStorage();
  assert.deepEqual(loadTasks(storage, '2026-01-05'), []);
});

test('save then load round-trips a day of tasks', () => {
  const storage = new FakeStorage();
  const tasks = [
    { id: '1', text: 'Write tests', completed: false },
    { id: '2', text: 'Ship it', completed: true },
  ];
  saveTasks(storage, '2026-01-05', tasks);
  assert.deepEqual(loadTasks(storage, '2026-01-05'), tasks);
});

test('addTask appends a new task and persists it', () => {
  const storage = new FakeStorage();
  const updated = addTask(storage, '2026-01-05', 'Feed the ants');
  assert.equal(updated.length, 1);
  assert.equal(updated[0].text, 'Feed the ants');
  assert.equal(updated[0].completed, false);
  assert.deepEqual(loadTasks(storage, '2026-01-05'), updated);
});

test('toggleTask flips completed state and persists it', () => {
  const storage = new FakeStorage();
  const [task] = addTask(storage, '2026-01-05', 'Feed the ants');
  const updated = toggleTask(storage, '2026-01-05', task.id);
  assert.equal(updated[0].completed, true);
  assert.equal(loadTasks(storage, '2026-01-05')[0].completed, true);

  const reverted = toggleTask(storage, '2026-01-05', task.id);
  assert.equal(reverted[0].completed, false);
});

test('deleteTask removes the task and persists the removal', () => {
  const storage = new FakeStorage();
  const [task] = addTask(storage, '2026-01-05', 'Feed the ants');
  const updated = deleteTask(storage, '2026-01-05', task.id);
  assert.deepEqual(updated, []);
  assert.deepEqual(loadTasks(storage, '2026-01-05'), []);
});

test('tasks for different days are stored independently', () => {
  const storage = new FakeStorage();
  addTask(storage, '2026-01-05', 'Day one task');
  addTask(storage, '2026-01-06', 'Day two task');
  assert.equal(loadTasks(storage, '2026-01-05').length, 1);
  assert.equal(loadTasks(storage, '2026-01-06').length, 1);
});
