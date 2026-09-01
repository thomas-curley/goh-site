-- Recurring "series" nights (PVM Thursday, Skilling Friday, etc.) already
-- auto-import as real `events` rows per occurrence via the Discord
-- recurring-scheduled-event sync (see 018_events_recurrence_key.sql). Admins
-- don't want a second, redundant event record just to announce what the
-- night's specific activity is -- they want a lightweight, trackable/editable
-- Discord post keyed to the series (by its shared discord_event_id), same as
-- event_recap_posts is keyed to an event. Not FK'd to events.discord_event_id
-- since that's not a unique/primary key on that table, just a shared grouping
-- value across occurrence rows.

alter table post_templates drop constraint post_templates_content_type_check;
alter table post_templates add constraint post_templates_content_type_check
  check (content_type in ('announcement','event_post','event_recap','signup_thread','series_update'));

insert into post_sections (id, name, description, block_type, config) values
('00000000-0000-4000-8000-000000000032', 'Series Update Header', 'The bolded series-night header line naming which series this update is for.', 'line', '{"emoji":"📌","template":"{emoji} **{series_title}: Tonight''s Plan** {emoji}","requireKeys":["series_title"]}')
on conflict (id) do nothing;

create table if not exists series_update_posts (
  id uuid primary key default gen_random_uuid(),
  discord_event_id text,
  series_title text not null,
  description text not null,
  ping_roles jsonb not null default '[]',
  template_id uuid references post_templates(id) on delete set null,
  destination_channel_id text not null,
  discord_message_id text,
  author_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_series_update_posts_created on series_update_posts(created_at desc);
create index if not exists idx_series_update_posts_discord_event_id on series_update_posts(discord_event_id);

alter table series_update_posts enable row level security;

-- Same trust model as post_templates/event_recap_posts: enforcement is the
-- admin UI's checkPermission gate, not RLS.
create policy "Authenticated users can manage series update posts"
  on series_update_posts for all
  using (auth.role() = 'authenticated');

insert into post_templates (content_type, name, description, is_default, sections) values
(
  'series_update',
  'Default Series Update',
  'Announces the specific activity for tonight''s occurrence of a recurring series night.',
  true,
  jsonb_build_array(
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000001', 'block_type', 'role_ping_prefix', 'label', 'Role Ping Prefix', 'blankLineBefore', false, 'config', '{}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000032', 'block_type', 'line', 'label', 'Series Update Header', 'blankLineBefore', true, 'config', '{"emoji":"📌","template":"{emoji} **{series_title}: Tonight''s Plan** {emoji}","requireKeys":["series_title"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000007', 'block_type', 'paragraph', 'label', 'Description Paragraph', 'blankLineBefore', true, 'config', '{"bindKey":"description"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000024', 'block_type', 'line', 'label', 'Author Signoff', 'blankLineBefore', true, 'config', '{"emoji":"","template":"— {author}","requireKeys":["author"]}'::jsonb)
  )
)
on conflict do nothing;
