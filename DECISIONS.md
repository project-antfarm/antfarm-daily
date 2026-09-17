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
