-- Optional access control for surveys: 'anonymous' (default, unchanged
-- behavior) requires nothing; 'verified_player' requires a signed-in,
-- RSN-verified account (any verified player, not necessarily in this
-- clan); 'clan_member' additionally requires that RSN to currently be a
-- member of the WOM group roster. When gated, the respondent's identity
-- is captured automatically from their verified profile rather than the
-- free-text optional name used for anonymous surveys.
alter table surveys add column if not exists access_level text not null default 'anonymous'
  check (access_level in ('anonymous', 'verified_player', 'clan_member'));

alter table survey_responses add column if not exists discord_id text;
