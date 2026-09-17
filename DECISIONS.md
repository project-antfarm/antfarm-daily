# Decisions

Append-only architectural decision log, written by the colony.

## 2026-09-17 — Daily planner foundation (Issue #12)

**File layout.** Flat repo root, no build step: `index.html`, `styles.css`,
`state.js` (pure state functions), `app.js` (DOM wiring, imports `state.js`
as an ES module), `serve.js` (a few lines of `node:http`, used by both local
dev and the Playwright `webServer`). `index.html` stays at the repo root
with relative asset paths (`./styles.css`, `./app.js`) because GitHub Pages
serves this repo from a subpath.

**Storage key and schema.** `localStorage` key `antfarm.daily.v1`, value:

```json
{
  "version": 1,
  "days": {
    "2026-09-17": {
      "priorities": [{ "id": "uuid", "text": "…", "completed": false }],
      "tasks": [{ "id": "uuid", "text": "…", "completed": false }]
    }
  }
}
```

Days are keyed by local `YYYY-MM-DD` under `days` so later Issues (weekly
view, carry-forward, history) can address any day by key instead of only
"today"; this Issue only ever reads/writes `days[todayKey()]`. `version` is
a top-level int for future migrations — a loader encountering an unknown
shape resets to an empty state rather than throwing, so a bad/older payload
never blocks the app. When later Issues add commitments (with times) or
deadlines, extend the per-day object with new keys (e.g. `commitments`) and
bump `version`, writing a migration in `load()` that fills the new keys for
old records; do not change the meaning of existing keys in place. Deadlines
that are not tied to a single day should likely live outside `days` (e.g. a
top-level `deadlines` list keyed by id, not by day) since GOAL.md treats
"work with a deadline" as distinct from "work planned for today" — left for
the Issue that implements it to decide precisely.

**Test runner.** Playwright (`@playwright/test`) only — one runner, per the
Issue's guidance. `tests/app.spec.js` drives the app over `http://` (served
by `serve.js` via Playwright's `webServer`, since `localStorage` behaves
differently on `file://`), covering the acceptance criteria (add, priority
limit, toggle, delete-with-confirm, reload persistence, keyboard operation,
360px no-scroll) and produces `screenshots/mobile-360.png` and
`screenshots/desktop-1280.png` in the same run for CI's `browser-evidence-*`
artifact.

**Accessibility.** Colors: text `#23211c` on background `#f6f4ef` (14.6:1)
and on white panels (16.1:1); muted text `#6f6a5e` on background (4.9:1) and
on white panels (5.4:1); accent `#a3410a` text on white (8.0:1); white text
on the accent-colored priority badge (6.3:1); the focus ring `#1d4ed8` on
background (6.1:1) and on white panels (6.7:1). All meet or exceed WCAG AA
(4.5:1 body text, 3:1 large text/focus indicators). Completed items are
marked by a filled checkbox glyph + strikethrough text, not color alone;
priorities are marked by a numbered badge + left border + separate panel,
not color alone.

## 2026-09-17 — Day navigation and week strip (Issue #14)

**`selectedDay` is in-memory only, always starts at today.** It is a plain
module-level `YYYY-MM-DD` string in `app.js`, never written to
`localStorage`. Every read and write (`render()`, `addItem`/`toggleItem`/
`removeItem` calls) goes through it. Reloading the page re-runs the module
and re-initializes it to `todayKey()`, satisfying GOAL.md's "open the app →
understand the day" — a stale selection from a previous session is never
restored.

**Midnight-rollover fix.** The old bug was `const key = todayKey()` computed
once at module load and reused forever. The fix is not a timer: a
`followingToday` boolean (true until the person explicitly navigates away
from today, true again after they navigate back via "Today" or land on it
via prev/next/week-strip) gates a small `activeDay()` helper that
recomputes `todayKey()` fresh, at the moment it's called, whenever
`followingToday` is true. `render()` and every write handler call
`activeDay()` instead of closing over a stale constant, so a session left
open across midnight starts writing to the new day the next time it renders
or writes — with no `setInterval`/timer needed, since a person interacting
with a stale page is what triggers the recompute.

**Past and future days are editable.** `addItem`/`toggleItem`/`removeItem`
already took a `key` argument (per the #12 schema decision); navigation
just changes which key `app.js` passes. Nothing in `state.js` treats a
day as read-only, and nothing was added to make it so — GOAL.md requires
unfinished work to stay recoverable, and freezing past days would defeat
that.

**Week boundaries: fixed Monday start**, independent of locale
(`state.js`'s `weekStart`/`weekKeys` use a constant `WEEK_START_DAY = 1`).
Locale-derived week starts would make "which week am I in" vary silently
between visitors and complicate testing (a fixed clock in a test can't also
fix `Intl`'s locale-dependent first-day-of-week without stubbing `Intl`
itself). A fixed Monday is a common convention and keeps the strip's
boundaries deterministic and testable.

**Week strip markers, none color-only.** Selected day: `aria-current="date"`
plus a 2px solid border and bold day number. Today (when not selected): a
dashed border. Has-work: a small dot rendered only when the day has at
least one priority or task (`dayHasWork` in `state.js`), independent of the
selected/today styling so all three can be signaled at once without relying
on a background hue for any of them.

## 2026-09-17 — Scheduled commitments (Issue #16)

**`commitments` item shape and time format.** A third per-day list,
`commitments: [{ id, text, time, completed }]`, alongside `priorities` and
`tasks`. `time` is a 24-hour `"HH:MM"` string (native `<input type="time">`'s
own value format), stored and compared as a plain string — `"09:00" <
"15:00"` holds under string comparison for any two valid `HH:MM` values, so
no `Date` parsing is needed to sort or compare them.

**`getDay` normalises missing lists on read; `version` is not bumped.**
`getDay` now returns `priorities: day.priorities ?? []`, `tasks: day.tasks ??
[]`, `commitments: day.commitments ?? []` instead of handing back whatever
shape was stored. A real browser's `localStorage` already holds days written
by the pre-commitments app (`{ priorities, tasks }` only, per the #12
schema); once `emptyDay()` grows a `commitments` key, those records read back
with `commitments: undefined` unless something fills the gap. `getDay` is the
one function every read (`render`, `addItem`, `toggleItem`, `removeItem`) and
the week strip's `dayHasWork` route through, so normalising there fixes every
caller at once instead of guarding `.length`/`.map` at each call site. This
was chosen over bumping `version` and writing a `load()` migration pass
because there is nothing to migrate — old days are valid, just partial —
and a read-time default is a smaller, safer diff than rewriting stored data
that other code (or a future Issue) doesn't otherwise need touched.

**Sorting lives in `state.js`, inside `getDay`.** `getDay` sorts
`commitments` by `time` (ascending, string comparison) before returning,
so every caller — render included — always sees commitments in schedule
order without re-sorting at the call site. It's a pure function over plain
data, so it's covered by the same Playwright suite as the rest of `state.js`
without needing a DOM.

**Distinguishing mark: a bordered time chip, not color.** Priorities use a
numbered badge + solid left border (per the #12/#14 decisions); commitments
reuse that pattern's shape but not its hue — a rectangular `HH:MM` chip in
place of the numbered badge, and a *dashed* left border/panel-top border
instead of priorities' solid one. The time text itself is the primary
distinguishing content, per the Issue; the dashed border is a secondary,
non-color echo of it so the panel and its items read as a group even in
grayscale.

**Three-panel layout: two columns, commitments spans both below.** Below
640px, `.panels` stays a single-column stack (unchanged). At 640px and up,
`.panels` becomes a 2-column CSS grid (`1fr 1fr`) holding Priorities and
Tasks side by side, and `.commitments-panel` is pinned to
`grid-column: 1 / -1` so it spans the full width on its own row underneath.
This was chosen over a 3-up grid (e.g. `repeat(auto-fit, minmax(...))`)
because the page's `max-width: 640px` container means three equal columns
would never have room to sit on one row anyway; letting the third panel
wrap via `auto-fit` produced an uneven half-empty row, where an explicit
full-width row is deliberate and predictable at every width above 640px.
At 360px all three panels stack full-width in source order (Priorities,
Tasks, Commitments) with no layout change needed beyond what #12 already
established.
