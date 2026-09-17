# Runs

Human summary of each run of this specimen. Numbers come from
[antfarm-telemetry](https://github.com/project-antfarm/antfarm-telemetry) and
GitHub history. Judgement is the human's.

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
