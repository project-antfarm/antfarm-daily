#!/usr/bin/env bash
# Append one telemetry comment to the Colony log Issue.
# usage: log.sh <role> <model> <execution_file|""> <extra-json>
set -euo pipefail
role=$1; model=$2; exec_file=${3:-}; extra=${4:-'{}'}
usage='{}'
if [ -n "$exec_file" ] && [ -f "$exec_file" ]; then
  usage=$(jq -c '([.[]? | select(.type=="result")] | last) // {} |
    {turns:.num_turns, duration_ms:.duration_ms, cost_usd:.total_cost_usd,
     input_tokens:.usage.input_tokens, output_tokens:.usage.output_tokens,
     cache_read_tokens:.usage.cache_read_input_tokens,
     cache_create_tokens:.usage.cache_creation_input_tokens}' "$exec_file" 2>/dev/null || echo '{}')
fi
body=$(jq -cn --arg role "$role" --arg model "$model" --arg run "$GITHUB_RUN_ID" \
  --arg event "$GITHUB_EVENT_NAME" --arg ts "$(date -u +%FT%TZ)" \
  --argjson usage "$usage" --argjson extra "$extra" \
  '{ts:$ts, role:$role, model:$model, run_id:($run|tonumber), event:$event} + $usage + $extra')
printf '```json\n%s\n```\n' "$body" | gh issue comment "$COLONY_LOG_ISSUE" --body-file -
