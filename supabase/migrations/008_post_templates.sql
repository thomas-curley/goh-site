-- Reusable Discord post templates: a library of named "sections" (post_sections)
-- and per-post-type "templates" (post_templates) assembled from ordered,
-- independently-editable copies of library sections. See lib/post-templates.ts
-- for the renderer that interprets these.

create table if not exists post_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  block_type text not null check (block_type in ('role_ping_prefix','line','paragraph','list','static_text')),
  config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists post_templates (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('announcement','event_post','event_recap','signup_thread')),
  name text not null,
  description text not null default '',
  is_default boolean not null default false,
  sections jsonb not null default '[]',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- At most one default template per content type (routes fall back to it
-- when no templateId is given).
create unique index if not exists idx_post_templates_one_default
  on post_templates(content_type) where (is_default);

create index if not exists idx_post_templates_content_type on post_templates(content_type);

alter table post_sections enable row level security;
alter table post_templates enable row level security;

-- Same trust model as custom_commands (006): any authenticated user can
-- manage these tables directly via the browser client; enforcement is the
-- admin page's checkPermission gate, not RLS.
create policy "Authenticated users can manage post sections"
  on post_sections for all
  using (auth.role() = 'authenticated');

create policy "Authenticated users can manage post templates"
  on post_templates for all
  using (auth.role() = 'authenticated');

-- ============================================================
-- Seed: section library
-- ============================================================

insert into post_sections (id, name, description, block_type, config) values
('00000000-0000-4000-8000-000000000001', 'Role Ping Prefix', 'Renders selected role mentions (@everyone, @here, or roles) as the first line, if any are selected.', 'role_ping_prefix', '{}'),

('00000000-0000-4000-8000-000000000002', 'Announcement Header', 'The bolded announcement title line.', 'line', '{"emoji":"📢","template":"{emoji} **{title}**","requireKeys":["title"]}'),
('00000000-0000-4000-8000-000000000003', 'Announcement Body', 'The announcement content paragraph.', 'paragraph', '{"bindKey":"content"}'),

('00000000-0000-4000-8000-000000000004', 'Event Header (Pings)', 'The bolded event title line.', 'line', '{"emoji":"📢","template":"{emoji} @Event Pings **{title}** {emoji}","requireKeys":["title"]}'),
('00000000-0000-4000-8000-000000000028', 'Raid Header', 'Alternate event header styled for raids.', 'line', '{"emoji":"🗡️","template":"{emoji} @Event Pings **{title}** {emoji}","requireKeys":["title"]}'),
('00000000-0000-4000-8000-000000000029', 'Skilling Header', 'Alternate event header styled for skilling events.', 'line', '{"emoji":"⛏️","template":"{emoji} @Event Pings **{title}** {emoji}","requireKeys":["title"]}'),
('00000000-0000-4000-8000-000000000030', 'Social Header', 'Alternate event header styled for social events.', 'line', '{"emoji":"🎉","template":"{emoji} @Event Pings **{title}** {emoji}","requireKeys":["title"]}'),
('00000000-0000-4000-8000-000000000031', 'Drop Party Header', 'Alternate event header styled for drop parties.', 'line', '{"emoji":"💰","template":"{emoji} @Event Pings **{title}** {emoji}","requireKeys":["title"]}'),

('00000000-0000-4000-8000-000000000005', 'Event Recap Header', 'The bolded recap title line.', 'line', '{"emoji":"🏰","template":"{emoji} **Event Recap: {title}** {emoji}","requireKeys":["title"]}'),
('00000000-0000-4000-8000-000000000006', 'Sign-up Header', 'The bolded signup-thread title line.', 'line', '{"emoji":"📋","template":"{emoji} **Sign-ups: {title}**","requireKeys":["title"]}'),

('00000000-0000-4000-8000-000000000007', 'Description Paragraph', 'The event/recap description, if provided.', 'paragraph', '{"bindKey":"description"}'),

('00000000-0000-4000-8000-000000000008', 'Event Field: Event', 'Restates the event title as a labeled line.', 'line', '{"emoji":"⚔️","template":"{emoji} Event: {title}","requireKeys":["title"]}'),
('00000000-0000-4000-8000-000000000009', 'Event Field: Host', 'Host RSN line.', 'line', '{"emoji":"🤠","template":"{emoji} Host: {host_rsn}","requireKeys":["host_rsn"]}'),
('00000000-0000-4000-8000-000000000010', 'Event Field: Date', 'Event date line.', 'line', '{"emoji":"📅","template":"{emoji} Date: {dateStr}","requireKeys":["dateStr"]}'),
('00000000-0000-4000-8000-000000000011', 'Event Field: Time', 'Event time line.', 'line', '{"emoji":"⏰","template":"{emoji} Time: {timeStr}","requireKeys":["timeStr"]}'),
('00000000-0000-4000-8000-000000000012', 'Event Field: World', 'OSRS world line.', 'line', '{"emoji":"🌍","template":"{emoji} World: {world}","requireKeys":["world"]}'),
('00000000-0000-4000-8000-000000000013', 'Event Field: Meet', 'Meet location line.', 'line', '{"emoji":"📍","template":"{emoji} Meet: {meet_location}","requireKeys":["meet_location"]}'),
('00000000-0000-4000-8000-000000000014', 'Event Field: Spots', 'Spots line (always shown if set).', 'line', '{"emoji":"👥","template":"{emoji} Spots: {spots}","requireKeys":["spots"]}'),
('00000000-0000-4000-8000-000000000015', 'Event Field: Signup', 'Signup type line.', 'line', '{"emoji":"📝","template":"{emoji} Signup: {signup_type}","requireKeys":["signup_type"]}'),
('00000000-0000-4000-8000-000000000016', 'Event Field: Voice', 'Voice channel line.', 'line', '{"emoji":"🔊","template":"{emoji} Voice: {voice_channel}","requireKeys":["voice_channel"]}'),
('00000000-0000-4000-8000-000000000017', 'Event Field: Prize Pool', 'Prize pool line.', 'line', '{"emoji":"🏆","template":"{emoji} Prize Pool: {prize_pool}","requireKeys":["prize_pool"]}'),

('00000000-0000-4000-8000-000000000018', 'Requirements List', 'Bulleted requirements list (one per line of the detailed field), falling back to the short summary field if no list was entered.', 'list', '{"bindKey":"requirements_list","splitNewlines":true,"style":"bullet","itemPrefix":"• ","itemTemplate":"{value}","headingEmoji":"🎆","headingTemplate":"{emoji} Recommended Requirements","fallbackBindKey":"requirements","fallbackTemplate":"{emoji} Requirements: {value}"}'),
('00000000-0000-4000-8000-000000000019', 'Event Guide', 'Event-specific guide/mechanics text, with a heading.', 'paragraph', '{"bindKey":"guide_text","headingEmoji":"📄","headingTemplate":"{emoji} Event-Specific Guide: {title} Mechanics"}'),
('00000000-0000-4000-8000-000000000020', 'Video Guide Link', 'Video guide URL line.', 'line', '{"emoji":"","template":"Video Guide: {video_url}","requireKeys":["video_url"]}'),

('00000000-0000-4000-8000-000000000021', 'Highlights List', 'Bulleted list of recap highlights.', 'list', '{"bindKey":"highlights","splitNewlines":false,"style":"bullet","itemPrefix":"• ","itemTemplate":"{value}","headingEmoji":"⭐","headingTemplate":"{emoji} **Highlights**"}'),
('00000000-0000-4000-8000-000000000022', 'Winners List (Medals)', 'Winners list with medal emoji by rank.', 'list', '{"bindKey":"winners","splitNewlines":false,"style":"medal","itemTemplate":"**{rsn}**{prizeSuffix}","headingEmoji":"🏆","headingTemplate":"{emoji} **Winners**"}'),
('00000000-0000-4000-8000-000000000023', 'Recap Signoff', 'Fixed recap sign-off line.', 'static_text', '{"emoji":"🌳","template":"Thanks for coming! See you at the next one {emoji}"}'),
('00000000-0000-4000-8000-000000000024', 'Author Signoff', 'Attribution line.', 'line', '{"emoji":"","template":"— {author}","requireKeys":["author"]}'),

('00000000-0000-4000-8000-000000000025', 'Signup Thread: React Prompt', 'Fixed call-to-action line for signup threads.', 'static_text', '{"template":"React with ✅ to sign up, or reply with your RSN and role!"}'),
('00000000-0000-4000-8000-000000000026', 'Signup Thread: Date', 'Event date line (unlabeled, for the signup thread).', 'line', '{"emoji":"📅","template":"{emoji} {dateStr}","requireKeys":["dateStr"]}'),
('00000000-0000-4000-8000-000000000027', 'Signup Thread: Spots (hide if Open)', 'Spots line, hidden when spots is left as the default "Open".', 'line', '{"emoji":"👥","template":"{emoji} Spots: {spots}","requireKeys":["spots"],"skipIf":{"key":"spots","equals":"Open"}}')

on conflict (id) do nothing;

-- ============================================================
-- Seed: default templates (reproduce today's hardcoded output exactly)
-- ============================================================

insert into post_templates (content_type, name, description, is_default, sections) values
(
  'announcement',
  'Default Announcement',
  'Matches the announcement format used before templates existed.',
  true,
  jsonb_build_array(
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000001', 'block_type', 'role_ping_prefix', 'label', 'Role Ping Prefix', 'blankLineBefore', false, 'config', '{}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000002', 'block_type', 'line', 'label', 'Announcement Header', 'blankLineBefore', false, 'config', '{"emoji":"📢","template":"{emoji} **{title}**","requireKeys":["title"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000003', 'block_type', 'paragraph', 'label', 'Announcement Body', 'blankLineBefore', true, 'config', '{"bindKey":"content"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000024', 'block_type', 'line', 'label', 'Author Signoff', 'blankLineBefore', true, 'config', '{"emoji":"","template":"— {author}","requireKeys":["author"]}'::jsonb)
  )
),
(
  'event_post',
  'Default Event Post',
  'Matches the event post format used before templates existed.',
  true,
  jsonb_build_array(
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000001', 'block_type', 'role_ping_prefix', 'label', 'Role Ping Prefix', 'blankLineBefore', false, 'config', '{}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000004', 'block_type', 'line', 'label', 'Event Header (Pings)', 'blankLineBefore', true, 'config', '{"emoji":"📢","template":"{emoji} @Event Pings **{title}** {emoji}","requireKeys":["title"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000007', 'block_type', 'paragraph', 'label', 'Description Paragraph', 'blankLineBefore', true, 'config', '{"bindKey":"description"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000008', 'block_type', 'line', 'label', 'Event Field: Event', 'blankLineBefore', true, 'config', '{"emoji":"⚔️","template":"{emoji} Event: {title}","requireKeys":["title"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000009', 'block_type', 'line', 'label', 'Event Field: Host', 'blankLineBefore', false, 'config', '{"emoji":"🤠","template":"{emoji} Host: {host_rsn}","requireKeys":["host_rsn"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000010', 'block_type', 'line', 'label', 'Event Field: Date', 'blankLineBefore', false, 'config', '{"emoji":"📅","template":"{emoji} Date: {dateStr}","requireKeys":["dateStr"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000011', 'block_type', 'line', 'label', 'Event Field: Time', 'blankLineBefore', false, 'config', '{"emoji":"⏰","template":"{emoji} Time: {timeStr}","requireKeys":["timeStr"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000012', 'block_type', 'line', 'label', 'Event Field: World', 'blankLineBefore', false, 'config', '{"emoji":"🌍","template":"{emoji} World: {world}","requireKeys":["world"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000013', 'block_type', 'line', 'label', 'Event Field: Meet', 'blankLineBefore', false, 'config', '{"emoji":"📍","template":"{emoji} Meet: {meet_location}","requireKeys":["meet_location"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000014', 'block_type', 'line', 'label', 'Event Field: Spots', 'blankLineBefore', false, 'config', '{"emoji":"👥","template":"{emoji} Spots: {spots}","requireKeys":["spots"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000015', 'block_type', 'line', 'label', 'Event Field: Signup', 'blankLineBefore', false, 'config', '{"emoji":"📝","template":"{emoji} Signup: {signup_type}","requireKeys":["signup_type"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000016', 'block_type', 'line', 'label', 'Event Field: Voice', 'blankLineBefore', false, 'config', '{"emoji":"🔊","template":"{emoji} Voice: {voice_channel}","requireKeys":["voice_channel"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000017', 'block_type', 'line', 'label', 'Event Field: Prize Pool', 'blankLineBefore', false, 'config', '{"emoji":"🏆","template":"{emoji} Prize Pool: {prize_pool}","requireKeys":["prize_pool"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000018', 'block_type', 'list', 'label', 'Requirements List', 'blankLineBefore', true, 'config', '{"bindKey":"requirements_list","splitNewlines":true,"style":"bullet","itemPrefix":"• ","itemTemplate":"{value}","headingEmoji":"🎆","headingTemplate":"{emoji} Recommended Requirements","fallbackBindKey":"requirements","fallbackTemplate":"{emoji} Requirements: {value}"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000019', 'block_type', 'paragraph', 'label', 'Event Guide', 'blankLineBefore', true, 'config', '{"bindKey":"guide_text","headingEmoji":"📄","headingTemplate":"{emoji} Event-Specific Guide: {title} Mechanics"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000020', 'block_type', 'line', 'label', 'Video Guide Link', 'blankLineBefore', true, 'config', '{"emoji":"","template":"Video Guide: {video_url}","requireKeys":["video_url"]}'::jsonb)
  )
),
(
  'event_recap',
  'Default Event Recap',
  'Matches the event recap format used before templates existed.',
  true,
  jsonb_build_array(
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000001', 'block_type', 'role_ping_prefix', 'label', 'Role Ping Prefix', 'blankLineBefore', false, 'config', '{}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000005', 'block_type', 'line', 'label', 'Event Recap Header', 'blankLineBefore', true, 'config', '{"emoji":"🏰","template":"{emoji} **Event Recap: {title}** {emoji}","requireKeys":["title"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000007', 'block_type', 'paragraph', 'label', 'Description Paragraph', 'blankLineBefore', true, 'config', '{"bindKey":"description"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000021', 'block_type', 'list', 'label', 'Highlights List', 'blankLineBefore', true, 'config', '{"bindKey":"highlights","splitNewlines":false,"style":"bullet","itemPrefix":"• ","itemTemplate":"{value}","headingEmoji":"⭐","headingTemplate":"{emoji} **Highlights**"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000022', 'block_type', 'list', 'label', 'Winners List (Medals)', 'blankLineBefore', true, 'config', '{"bindKey":"winners","splitNewlines":false,"style":"medal","itemTemplate":"**{rsn}**{prizeSuffix}","headingEmoji":"🏆","headingTemplate":"{emoji} **Winners**"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000023', 'block_type', 'static_text', 'label', 'Recap Signoff', 'blankLineBefore', true, 'config', '{"emoji":"🌳","template":"Thanks for coming! See you at the next one {emoji}"}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000024', 'block_type', 'line', 'label', 'Author Signoff', 'blankLineBefore', false, 'config', '{"emoji":"","template":"— {author}","requireKeys":["author"]}'::jsonb)
  )
),
(
  'signup_thread',
  'Default Signup Thread',
  'Matches the signup-thread format used before templates existed.',
  true,
  jsonb_build_array(
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000006', 'block_type', 'line', 'label', 'Sign-up Header', 'blankLineBefore', false, 'config', '{"emoji":"📋","template":"{emoji} **Sign-ups: {title}**","requireKeys":["title"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000026', 'block_type', 'line', 'label', 'Signup Thread: Date', 'blankLineBefore', true, 'config', '{"emoji":"📅","template":"{emoji} {dateStr}","requireKeys":["dateStr"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000009', 'block_type', 'line', 'label', 'Event Field: Host', 'blankLineBefore', false, 'config', '{"emoji":"🤠","template":"{emoji} Host: {host_rsn}","requireKeys":["host_rsn"]}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000027', 'block_type', 'line', 'label', 'Signup Thread: Spots (hide if Open)', 'blankLineBefore', false, 'config', '{"emoji":"👥","template":"{emoji} Spots: {spots}","requireKeys":["spots"],"skipIf":{"key":"spots","equals":"Open"}}'::jsonb),
    jsonb_build_object('instance_id', gen_random_uuid(), 'source_section_id', '00000000-0000-4000-8000-000000000025', 'block_type', 'static_text', 'label', 'Signup Thread: React Prompt', 'blankLineBefore', true, 'config', '{"template":"React with ✅ to sign up, or reply with your RSN and role!"}'::jsonb)
  )
);
