#!/usr/bin/env bash
# Persist the events of one execution to the telemetry repository.
# Runs as a deterministic workflow step. Agents never call this.
#
# usage: telemetry.sh completed|failed|blocked [extra-json]
#   extra-json: {"target":{...}, "agent_report":{...}, "reason":"..."}
# env:   ROLE MODEL APP RUN SPECIMEN TELEMETRY_REPO TELEMETRY_TOKEN
#        STARTED_AT (ISO, optional) EXEC_FILE (optional)
#        GH_TOKEN + GH_REPO (optional, to refresh the status Issue)
#        TELEMETRY_DIR + NO_PUSH=1 (local testing)
set -euo pipefail
kind=$1; extra=${2:-'{}'}
here=$(cd "$(dirname "$0")" && pwd)
now=$(date -u +%FT%TZ)
exec_id="${ROLE}-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-local}/actions/runs/${GITHUB_RUN_ID:-0}"

usage='{}'
if [ -n "${EXEC_FILE:-}" ] && [ -f "$EXEC_FILE" ]; then
  usage=$(jq -c '([.[]? | select(.type=="result")] | last) // {} |
    {turns:.num_turns, duration_ms:.duration_ms, cost_usd:.total_cost_usd,
     input_tokens:.usage.input_tokens, output_tokens:.usage.output_tokens,
     cache_read_tokens:.usage.cache_read_input_tokens,
     cache_create_tokens:.usage.cache_creation_input_tokens,
     permission_denials:(.permission_denials // [] | length),
     terminal_reason:.terminal_reason, api_error_status:.api_error_status}
    | with_entries(select(.value != null))' "$EXEC_FILE" 2>/dev/null || echo '{}')
fi

base=$(jq -cn --arg run "$RUN" --arg sp "$SPECIMEN" --arg ex "$exec_id" --arg role "$ROLE" \
  --arg model "$MODEL" --arg app "$APP" --arg trig "${GITHUB_EVENT_NAME:-local}" --arg url "$run_url" \
  '{schema_version:1, run:$run, specimen:$sp, execution_id:$ex,
    actor:{type:$role, model:$model, app:$app}, trigger:$trig, workflow_run:$url}')

event() { # event <n> <ts> <type> <fields-json>
  jq -cn --argjson b "$base" --arg id "${exec_id}-$1" --arg ts "$2" --arg type "$3" --argjson f "$4" \
    '{schema_version:$b.schema_version, event_id:$id, ts:$ts} + ($b | del(.schema_version)) + {type:$type} + $f'
}

target=$(jq -c '{target:(.target // {})} | if .target == {} then {} else . end' <<<"$extra")
lines=()
if [ "$kind" = blocked ]; then
  lines+=("$(event 1 "$now" guard.blocked "$(jq -c '{reason:(.reason // "unknown")} + ({target:(.target // {})} | if .target == {} then {} else . end)' <<<"$extra")")")
else
  lines+=("$(event 1 "${STARTED_AT:-$now}" "${ROLE}.started" "$target")")
  fields=$(jq -c --argjson u "$usage" --argjson t "$target" \
    '$t + (if $u == {} then {} else {usage:$u} end) + (if (.agent_report // {}) == {} then {} else {agent_report:.agent_report} end)' <<<"$extra")
  lines+=("$(event 2 "$now" "${ROLE}.${kind}" "$fields")")
fi

dir=${TELEMETRY_DIR:-}
if [ -z "$dir" ]; then
  dir=$(mktemp -d)
  git clone -q --depth 1 "https://x-access-token:${TELEMETRY_TOKEN}@github.com/${TELEMETRY_REPO}.git" "$dir"
fi
rundir="$dir/runs/$SPECIMEN/$RUN"
mkdir -p "$rundir/events" "$dir/state"
file="$rundir/events/$(date -u +%Y%m%dT%H%M%SZ)_${exec_id}.jsonl"
printf '%s\n' "${lines[@]}" > "$file"

# First execution of a run records the experimental configuration.
if [ ! -f "$rundir/manifest.json" ]; then
  jq -n --arg run "$RUN" --arg sp "$SPECIMEN" --arg ts "${STARTED_AT:-$now}" --arg sha "${GITHUB_SHA:-unknown}" \
    --argjson config "$(yq -o=json . "$here/config.yml")" \
    --argjson toolkit "$(yq -o=json . "$here/toolkit.yml")" \
    '{schema_version:1, run:$run, specimen:$sp, started_at:$ts, specimen_sha:$sha, config:$config, toolkit:$toolkit}' \
    > "$rundir/manifest.json"
fi

# Display-only projection, always recomputed from the event files.
today=$(date -u +%F)
# The budget week follows the subscription allowance, which resets on
# Sunday 16:00 UTC (13:00 in Sao Paulo), not the calendar week.
wk=$(date -u -d "sunday 16:00" +%s); [ "$wk" -le "$(date -u +%s)" ] || wk=$((wk - 604800))
since=$(date -u -d "@$wk" +%FT%TZ)
cat "$dir"/runs/"$SPECIMEN"/*/events/*.jsonl \
  | jq -s -L "$here" --arg t "$today" --arg s "$since" --arg run "$RUN" --arg sp "$SPECIMEN" --arg now "$now" \
    --argjson b "$(yq -o=json '.budget' "$here/config.yml")" \
    'include "ledger";
     summary($t; $s; $b) + {
       budget: { weekly_cost_usd: $b.weekly_cost_usd, weekly_tokens: $b.weekly_tokens },
       schema_version: 1, specimen: $sp, updated_at: $now, active_run: $run,
       run: ( [ .[] | select(.run == $run) ] | {
         executions: ([ .[] | select(.type // "" | test("\\.(completed|failed)$")) ] | length),
         failed: ([ .[] | select(.type // "" | endswith(".failed")) ] | length),
         blocked: ([ .[] | select(.type == "guard.blocked") ] | length) }),
       last_event: ( sort_by(.ts) | last | {ts, type: (.type // .event), actor: role} )
     }' > "$dir/state/$SPECIMEN.json"

if [ "${NO_PUSH:-}" != 1 ]; then
  cd "$dir"
  id=$(gh api "users/antfarm-telemetry[bot]" --jq .id 2>/dev/null || echo 0)
  git config user.name "antfarm-telemetry[bot]"
  git config user.email "${id}+antfarm-telemetry[bot]@users.noreply.github.com"
  git add -A
  git commit -qm "telemetry: ${exec_id} ${kind}"
  for i in 1 2 3 4 5; do
    git push -q && break
    [ "$i" = 5 ] && { echo "telemetry push failed"; exit 1; }
    sleep $((i * 3)); git pull -q --rebase
  done
  cd - >/dev/null
fi

# Human-readable status on the specimen. Never fatal.
if [ -n "${GH_TOKEN:-}" ] && [ -n "${STATUS_ISSUE:-}" ]; then
  body=$(jq -r --arg repo "$TELEMETRY_REPO" '
    "Status of the colony, rewritten by the infrastructure after every execution. Not a log.\n\n" +
    "| | |\n|---|---|\n" +
    "| Run | `\(.active_run)` |\n" +
    "| Executions in this run | \(.run.executions) (\(.run.failed) failed, \(.run.blocked) blocked by guards) |\n" +
    "| Today (\(.today.date) UTC) | Queen \(.today.queen_runs), Worker \(.today.worker_runs) |\n" +
    "| Budget since \(.week.since) | US$ \(.week.cost_usd) of \(.budget.weekly_cost_usd) (conservative estimate, nothing is charged); \(.week.tokens) of \(.budget.weekly_tokens) raw tokens |\n" +
    "| Last event | `\(.last_event.type)` by \(.last_event.actor) at \(.last_event.ts) |\n\n" +
    "Telemetry: https://github.com/\($repo)"' "$dir/state/$SPECIMEN.json")
  gh issue edit "$STATUS_ISSUE" --body "$body" >/dev/null || echo "status issue not updated"
fi
