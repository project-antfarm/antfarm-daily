# A.N.T.F.A.R.M.

Autonomous Network of Task-Focused Agents for Repository Management.

An experiment: a small colony of LLM agents develops software through GitHub
with minimal human intervention. This repository is one specimen. The product
it builds is described in `GOAL.md`. The product is the test organism; the
data about the colony's behaviour is the real output.

## Experimental boundary

```
HUMAN
  defines the experiment, the product (GOAL.md), the boundaries, judges the result
        │
     GOAL.md
        │
════════╪════════  everything below this line is observed behaviour
        │
      QUEEN        plans, creates Issues, reviews PRs, merges, replans, declares DONE
        │
     WORKERS       implement one `ready` Issue each, open a PR, answer review
        │
   CI / POLICY     deterministic gates the agents cannot change
```

Principle: **high autonomy, limited authority.** The Queen decides strategy.
Workflows, rulesets and config own the limits. A prompt is not a boundary.

## Roles

| Role   | Does                                                                 | Never                                              |
|--------|----------------------------------------------------------------------|----------------------------------------------------|
| Queen  | reads GOAL.md, DECISIONS.md, Issues, PRs, CI; reviews, merges, plans | edits boundary files; changes limits; waits for humans when a decision is within its authority |
| Worker | implements exactly one `ready` Issue, tests, opens a PR              | invents roadmap; touches other Issues              |
| CI     | lint, tests, required checks                                         |                                                    |
| Human  | emergency stop, boundary changes, final judgement                    | writes the backlog                                 |

## State lives in GitHub

`GOAL.md` (scope and DONE), `DECISIONS.md` (append-only ADRs written by the
colony), Issues, labels, PRs, CI, commits. No agent session memory is assumed.
Every run rebuilds context from these artifacts.

Issue lifecycle (transitions applied by workflows, not by prompts):

```
ready → in-progress → PR open → needs-fix | approved → merged
needs-fix with attempt:2 → blocked   (Queen must decompose or drop)
in-progress without PR past the lease → back to ready
```

`human` label: the Queen asks for a boundary change and keeps working on
something else. Counted as "human decisions required".

## Boundary files (human-owned, see CODEOWNERS)

`GOAL.md`, `AGENTS.md`, `CLAUDE.md`, `.github/**`, `.antfarm/**`. Agents may
open PRs against them; those PRs cannot merge without the human.

## Limits (enforced by workflows)

Queen cycles per day, concurrent `ready` Issues, attempts per Issue, turns per
run, job timeout, lease per Issue. Values live in `.antfarm/config.yml`.
Kill switch: repository variable `ANTFARM_ENABLED`.

## Telemetry

Every agent run appends a JSON comment to the pinned **Colony log** Issue:
role, model, run id, cycle, actions, turns, tokens, duration. Everything else
comes from GitHub history. Runs are summarised by the human in `RUNS.md`.

## Reuse

To run another specimen: copy `.github/`, `.antfarm/`, `AGENTS.md`,
`CLAUDE.md`, this README; write a new `GOAL.md`. Nothing here should know
what the product is.
