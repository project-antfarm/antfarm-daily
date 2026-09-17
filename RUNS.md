# Runs

Human summary of each run of this specimen. Numbers come from
[antfarm-telemetry](https://github.com/project-antfarm/antfarm-telemetry) and
GitHub history. Judgement is the human's.

## Run 001 (2026-09-17, about two and a half hours)

| | |
|---|---|
| Queen | Claude Sonnet 5, by configuration error; Opus 5 was intended |
| Workers | Claude Sonnet 5 |
| External reviewer | Codex, requested by hand at first, then automatically |
| Toolkit | rtk (Worker), ponytail (both), minimalist-ui skill (Worker, never invoked), Playwright available |
| Queen executions | 3 (one cancelled by the human while finishing) |
| Worker executions | 3 (one cancelled by the human after opening its PR) |
| Issues created by the colony | 2 (#8, #10) |
| PRs opened | 2 (#9 merged, #11 archived unmerged) |
| CI failures | 0 |
| Retries | 1 (Issue #8, fixed on the first attempt) |
| Tokens | about 10.2 million raw, mostly cache reads |
| Estimated cost | US$ 4.16 reported by the runs |
| Human interventions | 2: a pending Worker run cancelled and Issue #10 parked; run closed |
| GOAL completion | not assessed; one foundation Issue merged |
| Result | CLOSED: invalid configuration, restarted as Run 002 |

Notes: the first complete review loop. Codex raised three medium findings on
PR #9; the Queen required two, declined one with a reason, the Worker fixed
both in one attempt with measured contrast ratios, and the Queen merged. The
Queen also created Issue #10 while #8 was still being fixed, because the
work-in-flight limit in her prompt did not count `needs-fix`. That limit is
now enforced by the infrastructure.

Infrastructure changed several times during the run (event trigger for the
Queen, budget unit, Worker shell opened, Codex request workflow), each logged
as a human note in telemetry. The Worker lost 11 commands to a narrow shell
allowlist in its first execution and none after the shell was opened. The
last Worker execution used 67 turns and 4.2 million tokens on one Issue.
Tag `run-001` points at main with the merged scaffold; main was then reverted
to an empty specimen.

## Run 000 (2026-09-16 to 2026-09-17)

| | |
|---|---|
| Queen | Claude Sonnet 5 |
| Workers | Claude Sonnet 5 |
| Toolkit | none |
| Queen executions | 1 |
| Worker executions | 1 (plus infrastructure smoke tests) |
| Issues created by the colony | 1 (#4) |
| PRs opened | 1 (#5, CI green, never reviewed) |
| CI failures | 0 |
| Retries | 0 |
| Tokens | about 1.9 million for the single cycle, 95% cache reads |
| Estimated cost | US$ 1.07 |
| Human interventions | run closed by the human |
| GOAL completion | 0%, nothing merged |
| Result | CLOSED: successful proof of concept |

Notes: first fully unattended cycle. The scheduled Queen found an empty
repository, created a foundation Issue with acceptance criteria and a
DECISIONS.md requirement, and the Worker delivered a PR with passing CI.
Closed on purpose to restart with a toolkit, file-based telemetry and pinned
versions. Tag `run-000`.

Infrastructure defects found: empty secrets from pasted input, scripts without
the executable bit, a daily limit that counted failed runs, a jq syntax error
that lost the Queen's telemetry entry (backfilled by hand), worker commits
authored as `claude[bot]`.
