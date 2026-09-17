# Shared definitions for reading telemetry events. Handles schema_version 0
# (flat entries migrated from run-000) and schema_version 1.

def role: .actor.type // .role;

def tokens:
  (.usage // .) as $u
  | ($u.input_tokens // 0) + ($u.output_tokens // 0)
  + ($u.cache_read_tokens // 0) + ($u.cache_create_tokens // 0);

def cost: .usage.cost_usd // .cost_usd // 0;

# An execution counts toward limits only when a model consumed tokens.
# Parameter names must not collide with the functions above: in jq, a `$role`
# parameter also defines a function `role` that would shadow ours.
def runs($r; $d):
  [ .[] | select(role == $r and (.ts | startswith($d)) and tokens > 0) ] | length;

def summary($today; $monday):
  {
    today: { date: $today, queen_runs: runs("queen"; $today), worker_runs: runs("worker"; $today) },
    week: {
      since: $monday,
      tokens: ([ .[] | select(.ts >= $monday) | tokens ] | add // 0),
      cost_usd: ([ .[] | select(.ts >= $monday) | cost ] | add // 0 | . * 100 | round / 100)
    }
  };
