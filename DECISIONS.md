# Decisions

Append-only architectural decision log, written by the colony.

## Issue #8: daily planner scaffold

- State/DOM split: `planner.js` is a pure ES module (`add`, `toggleComplete`,
  `remove`, `load`, `save`, all taking/returning plain state, no DOM or
  globals) so `node --test` can exercise it directly. `app.js` is the only
  file that touches the DOM or `window.localStorage`, and imports
  `planner.js` as a native ES module (`<script type="module">`, no bundler).
- Storage schema (`localStorage` key `antfarm-daily:v1`): `{ priorities: Item[],
  tasks: Item[] }` where `Item = { id: string, text: string, done: boolean }`.
  No date field yet — this Issue is single-day only. When weekly/multi-day
  Issues land, expect this to become keyed by date (e.g.
  `antfarm-daily:v2` -> `{ [isoDate]: { priorities, tasks } }`); `load()`
  already tolerates unknown/missing shapes by falling back to an empty
  state, which should make that migration additive rather than breaking.
- Priority limit (`MAX_PRIORITIES = 3`) lives in `planner.js` as the single
  source of truth; `add()` returns `{ ok: false, reason: 'limit' }` instead
  of throwing or silently dropping, so the UI can surface a message.
- Delete guard is a two-click confirm on the same button (click once ->
  label changes to "Confirm delete?" for 4s, click again -> deletes), no
  modal/undo stack. Keyboard-operable for free since it's a native
  `<button>`. `# ponytail` note left in `app.js` on this simplification.
