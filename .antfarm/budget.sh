#!/usr/bin/env bash
# Deterministic budget check from the Colony log ledger.
# usage: budget.sh <role> <runs_per_day> <weekly_token_budget>
# prints: runs_today=N tokens_week=N (to stdout and $GITHUB_OUTPUT) and exits 3 when over budget.
set -euo pipefail
role=$1; runs_per_day=$2; weekly=$3
gh api "repos/$GH_REPO/issues/$COLONY_LOG_ISSUE/comments" --paginate --jq '.[].body' | grep -v '^```' > /tmp/ledger.jsonl || true
today=$(date -u +%F)
monday=$(date -u -d "last monday" +%F); [ "$(date -u +%u)" = 1 ] && monday=$today
# a run only counts when a model actually consumed tokens
runs=$(jq -s --arg r "$role" --arg d "$today" '[.[] | select(.role==$r and (.ts|startswith($d)) and ((.input_tokens//0)+(.output_tokens//0)+(.cache_read_tokens//0)+(.cache_create_tokens//0)) > 0)] | length' /tmp/ledger.jsonl)
tokens=$(jq -s --arg m "$monday" '[.[] | select(.ts >= $m) | (.input_tokens//0)+(.output_tokens//0)+(.cache_read_tokens//0)+(.cache_create_tokens//0)] | add // 0' /tmp/ledger.jsonl)
echo "runs_today=$runs"; echo "tokens_week=$tokens"
{ echo "runs_today=$runs"; echo "tokens_week=$tokens"; } >> "${GITHUB_OUTPUT:-/dev/null}"
[ "$runs" -lt "$runs_per_day" ] || { echo "over budget: $role runs today $runs/$runs_per_day"; exit 3; }
[ "$tokens" -lt "$weekly" ] || { echo "over budget: tokens this week $tokens/$weekly"; exit 3; }
