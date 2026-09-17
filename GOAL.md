# A.N.T.F.A.R.M. Daily: Product Goal

## Goal

Build a polished personal daily planner designed to be opened every morning.

The application should help a person quickly understand what matters today,
organize the day, keep track of upcoming responsibilities, and maintain
awareness of the current week.

The intended experience is:

> Open the app → understand the day → decide what matters → organize it →
> leave with a clear plan.

The final result should feel like a real, finished personal productivity
application: simple, fast, visually intentional, pleasant to use, and useful
enough to become a daily habit.

The fact that this application is being developed as part of an autonomous
software-development experiment does not lower the expected product quality.

---

## Daily Planning

The application must support planning an individual day.

A user must be able to:

- define a small set of main priorities for the day;
- create and manage additional tasks;
- mark work as completed;
- record scheduled commitments with times;
- add useful context or notes to the day.

Priorities, ordinary tasks, scheduled commitments, and completed work should
be clearly distinguishable.

Opening the application should make the current day immediately understandable
without requiring unnecessary navigation.

---

## Weekly Awareness

Daily planning must exist within useful weekly context.

The user must be able to:

- understand which day is currently being viewed;
- navigate between days;
- define goals for the current week;
- understand which days contain planned work;
- see meaningful progress across the week.

Daily and weekly planning should feel like parts of the same product rather
than unrelated features.

---

## Tasks and Deadlines

The application must support responsibilities that are not limited to a single
day.

The user must be able to create items with future deadlines and understand
when important deadlines are approaching.

The interface should make it possible to distinguish between:

- work planned for today;
- work that exists but is not necessarily planned for today;
- work with a deadline;
- completed work.

Unfinished work must not silently disappear simply because its originally
planned day has passed.

---

## Persistence and History

Planning data must persist between browser sessions.

Refreshing the page, closing the browser, or restarting the computer must not
erase user data.

Past daily plans must remain accessible so that previous activity and progress
are not lost.

The application must work without requiring an account or internet-hosted
personal data.

---

## User Experience

The application is intended to be used frequently and should minimize friction.

A user opening it in the morning should be able to quickly answer:

1. What matters most today?
2. What else do I need to do?
3. What scheduled commitments do I have?
4. Is anything important approaching?
5. How is my week going?

Common planning actions should be understandable without documentation and
should require little interaction.

The application must work comfortably on both desktop and mobile devices,
including a 360px-wide viewport without horizontal page scrolling.

Primary interactions should be usable with a keyboard, important information
must not depend exclusively on color, and destructive actions should not be
easy to trigger accidentally.

Empty states, normal usage, large task lists, and unusually long content
should remain usable.

---

## Visual Quality

Visual quality is a product requirement, not optional polish.

The application should have a coherent visual identity with deliberate
typography, spacing, hierarchy, interaction states, and responsive behavior.

It should feel calm, focused, and appropriate for something used at the
beginning of every day.

The final application must not feel like:

- an unfinished prototype;
- a collection of default browser controls;
- a developer or admin dashboard;
- a component showcase;
- a placeholder interface;
- a generic or visibly low-effort AI-generated application.

Visual complexity should only exist when it improves the experience.

Clarity, consistency, restraint, and usability are more important than
decoration.

---

## Technical Boundaries

The application must be a static web application.

The product must use:

- HTML;
- CSS;
- vanilla JavaScript;
- browser localStorage for persistence;
- GitHub Pages for deployment.

Do not introduce:

- frontend frameworks;
- backend services;
- remote databases;
- authentication;
- paid runtime services;
- JavaScript libraries or frameworks at runtime.

Presentation assets that serve the visual design, such as web fonts, icon sets
and images, are allowed. Keep them few, and prefer copies served from this
repository over third-party hosts when that is practical.

Development-time tooling (test runners, linters, build checks, CSS tooling)
may be used freely.

The application must remain fully functional without external services: if a
third-party font or icon host is unreachable, every feature must still work.

---

## Quality

The finished product must be reliable enough for normal daily use.

Automated validation appropriate to the application must exist and important
behavior should be protected against regression.

Accessibility, responsiveness, persistence, and basic performance are part of
product quality.

The deployed application must not contain known defects that prevent normal
use of its primary flows.

---

## Scope

This is a focused personal planner, not a general productivity platform.

Do not expand the product into unrelated areas such as:

- collaboration or teams;
- messaging or social features;
- user accounts;
- general-purpose cloud synchronization;
- full project-management systems;
- AI assistants or chat interfaces;
- complex analytics;
- unrelated gamification;
- external calendar integrations.

Do not add features that are not required by this document.

---

## Definition of Done

The project may only be considered DONE when the actual product satisfies the
goal described in this document.

At minimum:

- daily planning is functional;
- weekly planning is functional;
- priorities can be managed;
- tasks can be managed and completed;
- scheduled commitments can be managed;
- future deadlines can be managed and surfaced appropriately;
- unfinished work remains recoverable;
- planning history remains accessible;
- data survives browser sessions;
- the application works without backend infrastructure;
- mobile and desktop experiences are usable;
- primary interactions are reasonably accessible;
- all CI checks required on the main branch pass;
- the application is deployed and reachable at its GitHub Pages URL;
- no known critical defect prevents normal daily use;
- the final interface meets the visual-quality expectations above.

When declaring DONE, the development system must present, for each item
above, the evidence that supports it: a test, a deployed URL, a screenshot, or
an explicit justification. Items without evidence are considered unmet.

DONE describes the state of the product, not the state of the backlog.

Having no open Issues is not evidence that the project is complete.

If a required capability is absent, knowingly broken, or only partially
implemented, the project is not DONE.

---

## Experimental Boundary

This document defines **what the product should become**, not how it should be
built.

It intentionally does not prescribe:

- repository structure;
- application architecture;
- file organization;
- development order;
- backlog;
- Issue decomposition;
- internal JavaScript organization;
- testing tools;
- CSS architecture;
- page layout;
- UI components;
- implementation strategy.

Those decisions belong to the autonomous development process.

The development system is expected to determine its own path toward this goal
while respecting the product requirements and boundaries defined here.
