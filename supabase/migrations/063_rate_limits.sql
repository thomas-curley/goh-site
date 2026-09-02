-- Durable rate limiting for public/unauthenticated API routes.
--
-- lib/rate-limit.ts's in-memory limiter is per-process: on Vercel every
-- serverless instance keeps its own counters and a cold start resets them,
-- so an attacker's requests fan out across instances and never add up. It
-- stays as a free first line of defence, but the authoritative count has to
-- live in shared state -- and Supabase already is that. Fixed windows keyed
-- by (key, bucket start); one atomic upsert per request.
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table rate_limits enable row level security;
-- Service-role only (the function below is security definer); no policies.

-- Increments the counter for `p_key` in the current `p_window_seconds`-wide
-- bucket and reports whether it's still within `p_max`. Also sweeps
-- buckets older than a day so the table never grows unbounded.
create or replace function rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz;
  current_hits integer;
begin
  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (key, window_start, hits)
  values (p_key, bucket, 1)
  on conflict (key, window_start)
  do update set hits = rate_limits.hits + 1
  returning hits into current_hits;

  -- Cheap opportunistic cleanup, roughly 1 in 50 calls.
  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return current_hits <= p_max;
end;
$$;

revoke all on function rate_limit_hit(text, integer, integer) from public;
