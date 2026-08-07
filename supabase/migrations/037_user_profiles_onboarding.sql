-- First-login onboarding prompt: "rsn is null and not onboarding_skipped"
-- means "never answered yet" -- choosing "I'm a guest" sets this true so
-- they're never re-prompted; linking an RSN satisfies the other branch
-- without needing its own flag.
alter table user_profiles add column if not exists onboarding_skipped boolean not null default false;
