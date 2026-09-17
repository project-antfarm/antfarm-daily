#!/usr/bin/env bash
# Deterministic budget check, recomputed from the telemetry event files.
# usage: budget.sh <role> <runs_per_day> <weekly_token_budget>
# env:   TELEMETRY_REPO, SPECIMEN; optional TELEMETRY_DIR (an existing checkout)
# prints runs_today / tokens_week (also to $GITHUB_OUTPUT); exits 3 when over budget.
set -euo pipefail
role=$1; runs_per_day=$2; weekly=$3
here=$(cd "$(dirname "$0")" && pwd)

dir=${TELEMETRY_DIR:-}
if [ -z "$dir" ]; then
  dir=$(mktemp -d)
  git clone -q --depth 1 "https://github.com/${TELEMETRY_REPO}.git" "$dir"
fi

today=$(date -u +%F)
# The budget week follows the subscription allowance, which resets on
# Sunday 16:00 UTC (13:00 in Sao Paulo), not the calendar week.
wk=$(date -u -d "sunday 16:00" +%s); [ "$wk" -le "$(date -u +%s)" ] || wk=$((wk - 604800))
monday=$(date -u -d "@$wk" +%FT%TZ)

sum=$(cat "$dir"/runs/"$SPECIMEN"/*/events/*.jsonl 2>/dev/null \
  | jq -s -c -L "$here" --arg t "$today" --arg m "$monday" 'include "ledger"; summary($t; $m)')
runs=$(jq -r --arg r "$role" '.today[$r + "_runs"]' <<<"$sum")
tokens=$(jq -r '.week.tokens' <<<"$sum")

echo "runs_today=$runs"; echo "tokens_week=$tokens"
{ echo "runs_today=$runs"; echo "tokens_week=$tokens"; } >> "${GITHUB_OUTPUT:-/dev/null}"
[ "$runs" -lt "$runs_per_day" ] || { echo "over budget: $role runs today $runs/$runs_per_day"; echo "block_reason=budget_runs" >> "${GITHUB_OUTPUT:-/dev/null}"; exit 3; }
[ "$tokens" -lt "$weekly" ] || { echo "over budget: tokens this week $tokens/$weekly"; echo "block_reason=budget_tokens" >> "${GITHUB_OUTPUT:-/dev/null}"; exit 3; }
