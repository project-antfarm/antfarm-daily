#!/usr/bin/env bash
# Deterministic budget check, recomputed from the telemetry event files.
# usage: budget.sh <role>          limits come from config.yml next to this file
# env:   SPECIMEN; optional TELEMETRY_DIR (an existing checkout)
# prints runs_today / tokens_week / cost_week (also to $GITHUB_OUTPUT);
# exits 3 when over budget, with block_reason in $GITHUB_OUTPUT.
set -euo pipefail
role=$1
here=$(cd "$(dirname "$0")" && pwd)
cfg="$here/config.yml"
out=${GITHUB_OUTPUT:-/dev/null}

runs_per_day=$(yq ".${role}.runs_per_day" "$cfg")
budget=$(yq -o=json '.budget' "$cfg")
max_cost=$(jq -r '.weekly_cost_usd' <<<"$budget")
max_tokens=$(jq -r '.weekly_tokens' <<<"$budget")

dir=${TELEMETRY_DIR:-}
if [ -z "$dir" ]; then
  dir=$(mktemp -d)
  git clone -q --depth 1 "https://github.com/$(yq '.telemetry_repo' "$cfg").git" "$dir"
fi

offset=$(yq '.day_utc_offset_hours // 0' "$cfg")
today=$(date -u -d "$offset hours" +%F)
# The budget week follows the subscription allowance, which resets on
# Sunday 16:00 UTC (13:00 in Sao Paulo), not the calendar week.
wk=$(date -u -d "sunday 16:00" +%s); [ "$wk" -le "$(date -u +%s)" ] || wk=$((wk - 604800))
since=$(date -u -d "@$wk" +%FT%TZ)

sum=$(cat "$dir"/runs/"$SPECIMEN"/*/events/*.jsonl 2>/dev/null \
  | jq -s -c -L "$here" --arg t "$today" --arg s "$since" --argjson b "$budget" --arg n "$(yq '.run' "$cfg")" --argjson o "$offset" 'include "ledger"; summary($t; $s; $b; $n; $o)')
runs=$(jq -r --arg r "$role" '.today[$r + "_runs"]' <<<"$sum")
tokens=$(jq -r '.week.tokens' <<<"$sum")
cost=$(jq -r '.week.cost_usd' <<<"$sum")

printf 'runs_today=%s\ntokens_week=%s\ncost_week=%s\n' "$runs" "$tokens" "$cost" | tee -a "$out"
block() { echo "over budget: $2"; echo "block_reason=$1" >> "$out"; exit 3; }
[ "$runs" -lt "$runs_per_day" ] || block budget_runs "$role runs today $runs/$runs_per_day"
jq -en --argjson c "$cost" --argjson m "$max_cost" '$c < $m' >/dev/null || block budget_cost "estimated cost this week $cost/$max_cost USD"
[ "$tokens" -lt "$max_tokens" ] || block budget_tokens "tokens this week $tokens/$max_tokens"
