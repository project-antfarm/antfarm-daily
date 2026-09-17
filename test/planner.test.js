import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, add, toggleComplete, remove, load, save, MAX_PRIORITIES } from '../planner.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

test('add appends a trimmed item to the given list', () => {
  const { ok, state } = add(emptyState(), 'tasks', '  write report  ');
  assert.equal(ok, true);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].text, 'write report');
  assert.equal(state.tasks[0].done, false);
});

test('add rejects blank text', () => {
  const { ok, state } = add(emptyState(), 'tasks', '   ');
  assert.equal(ok, false);
  assert.equal(state.tasks.length, 0);
});

test('add enforces the priority limit', () => {
  let state = emptyState();
  for (let i = 0; i < MAX_PRIORITIES; i += 1) {
    state = add(state, 'priorities', `priority ${i}`).state;
  }
  const result = add(state, 'priorities', 'one too many');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'limit');
  assert.equal(result.state.priorities.length, MAX_PRIORITIES);
});

test('toggleComplete flips done state and back', () => {
  const added = add(emptyState(), 'tasks', 'do the thing').state;
  const id = added.tasks[0].id;
  const toggled = toggleComplete(added, 'tasks', id);
  assert.equal(toggled.tasks[0].done, true);
  const toggledBack = toggleComplete(toggled, 'tasks', id);
  assert.equal(toggledBack.tasks[0].done, false);
});

test('remove deletes only the targeted item', () => {
  let state = add(emptyState(), 'tasks', 'keep me').state;
  state = add(state, 'tasks', 'delete me').state;
  const target = state.tasks[1].id;
  const next = remove(state, 'tasks', target);
  assert.equal(next.tasks.length, 1);
  assert.equal(next.tasks[0].text, 'keep me');
});

test('save/load round-trips state through storage', () => {
  const storage = memoryStorage();
  let state = add(emptyState(), 'priorities', 'ship the feature').state;
  state = add(state, 'tasks', 'reply to emails').state;
  save(storage, state);
  assert.deepEqual(load(storage), state);
});

test('load returns an empty state when storage has nothing saved', () => {
  const storage = memoryStorage();
  assert.deepEqual(load(storage), emptyState());
});
