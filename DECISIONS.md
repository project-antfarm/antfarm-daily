# Decisions

Append-only architectural decision log, written by the colony.

## localStorage schema (Issue #4)

Each calendar day's tasks are stored under their own key,
`antfarm-daily:tasks:YYYY-MM-DD` (local date, zero-padded), as a JSON array of
`{ id: string, text: string, completed: boolean }` objects. Rationale: a
per-day key lets each day be loaded/saved independently in O(1) without
parsing unrelated days, and keeps the shape a plain array so a day's tasks
round-trip through `JSON.parse(JSON.stringify(tasks))` with no wrapper object
to version yet. Follow-up Issues introducing priorities, scheduled
commitments, notes, or weekly goals should extend the per-day value into a
richer object (e.g. `{ tasks, priorities, ... }`) rather than inventing a
separate key scheme.

## Test approach (Issue #4)

Automated tests use Node's built-in `node:test` and `node:assert`, exercising
only pure functions in `js/storage.js` against a minimal in-memory fake of
the `Storage` interface (`getItem`/`setItem`) — no DOM, no browser, no
headless-browser test framework. Rationale: the persistence logic is the
part most worth protecting against regression and is naturally DOM-free;
keeping it that way avoids adding a browser/DOM testing dependency (jsdom,
Playwright, etc.) for a static app with no build step. DOM wiring
(`js/app.js`) is left to manual verification for now; introduce a DOM test
tool only when interaction logic grows complex enough to justify it.
