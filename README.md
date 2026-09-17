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

`GOAL.md`, `AGENTS.md`, `CLAUDE.md`, `.github/**`, `.antfarm/**`,
`.claude/**`. Agents may open PRs against them; those PRs cannot merge without
the human.

## Policy, state, telemetry

- **Policy** says how much is allowed: `.antfarm/config.yml`.
- **Telemetry** says what happened: one immutable event file per execution in
  [`antfarm-telemetry`](https://github.com/project-antfarm/antfarm-telemetry),
  written by workflow steps through a dedicated App. Agents hold no credential
  for that repository. Raw traces are kept as workflow artifacts for 90 days.
- **State** is never stored for decisions. Before any model starts,
  `.antfarm/budget.sh` recomputes the counters from the event files and the
  guard allows or blocks the run. Blocks are recorded as `guard.blocked`.

Limits: runs per day per role, weekly token budget across the colony, turns
per run, job timeout, concurrent `ready` Issues, attempts per Issue, lease per
Issue. Kill switch: repository variable `ANTFARM_ENABLED`.

Issue #1 shows the current status for humans and is rewritten in place. What
GitHub already records (Issues, PRs, reviews, CI, merges) is not duplicated in
telemetry; both sources join by Issue, PR, SHA and workflow run id.

## Toolkit

`.antfarm/toolkit.yml` lists every tool and skill available to the colony,
with layer (global or specimen), kind (efficiency, behavioral or tool), source
and pinned version. It is copied into the run manifest, because a toolkit
change is an experimental variable. Actions are pinned by commit SHA.

Runs are summarised by the human in `RUNS.md`.

## Reuse

To run another specimen: copy `.github/`, `.antfarm/`, `AGENTS.md`,
`CLAUDE.md`, this README; write a new `GOAL.md`. Nothing here should know
what the product is.
