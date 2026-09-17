# Shared definitions for reading telemetry events. Handles schema_version 0
# (flat entries migrated from run-000) and schema_version 1.

def role: .actor.type // .role;

def u: .usage // .;

def out_tokens: u.output_tokens // 0;

def in_tokens: (u.input_tokens // 0) + (u.cache_read_tokens // 0) + (u.cache_create_tokens // 0);

def tokens: in_tokens + out_tokens;

# What the run itself reported, for reference only.
def reported_cost: .usage.cost_usd // .cost_usd // 0;

# Conservative estimate used by the guard. $b is the `budget` block of
# config.yml. See the comment there.
def cost($b):
  ($b.price_per_mtok[.actor.model // .model // "default"] // $b.price_per_mtok.default) as $p
  | ( out_tokens * $p.output
    + in_tokens * (1 - $b.assumed_cache_share) * $p.input
    + in_tokens * $b.assumed_cache_share * $p.cache_read ) / 1000000;

def cents: . * 100 | round / 100;

# An execution counts toward limits only when a model consumed tokens.
# Parameter names must not collide with the functions above: in jq, a `$role`
# parameter also defines a function `role` that would shadow ours.
# Daily limits count only the active run ($n), so a new run starts at zero.
# The weekly budget below spans every run: it is real allowance consumption.
def runs($r; $d; $n):
  [ .[] | select(role == $r and .run == $n and (.ts | startswith($d)) and tokens > 0) ] | length;

def summary($today; $since; $b; $n):
  {
    today: { date: $today, run: $n, queen_runs: runs("queen"; $today; $n), worker_runs: runs("worker"; $today; $n) },
    week: {
      since: $since,
      tokens: ([ .[] | select(.ts >= $since) | tokens ] | add // 0),
      cost_usd: ([ .[] | select(.ts >= $since) | cost($b) ] | add // 0 | cents),
      reported_cost_usd: ([ .[] | select(.ts >= $since) | reported_cost ] | add // 0 | cents)
    }
  };
