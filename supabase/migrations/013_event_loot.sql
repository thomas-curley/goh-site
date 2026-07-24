-- Loot tracked per event from the Loot Split calculator (app/loot-split),
-- surfaced later in that event's recap. One record per event (upsert on
-- save), not an accumulating history -- the calculator is a live working
-- tool, not an audit log.
create table if not exists event_loot (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade unique,
  items jsonb not null default '[]', -- [{ name: string, unitPrice: number, qty: number }]
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table event_loot enable row level security;

create policy "Authenticated users can manage event loot"
  on event_loot for all
  using (auth.role() = 'authenticated');

-- Recaps embed a formatted snapshot of loot at post time (plain strings,
-- same shape as highlights) independent of event_loot's live state.
alter table event_recap_posts add column if not exists loot_items jsonb not null default '[]';

-- Library section only -- deliberately NOT spliced into the existing
-- default event_recap template's `sections` array, since that may already
-- be customized live via the TemplateEditor UI. Add "Loot List" to it via
-- Admin > Post Templates > Event Recap > add from library (one-time step).
insert into post_sections (id, name, description, block_type, config) values
('00000000-0000-4000-8000-000000000032', 'Loot List', 'Bulleted list of loot tracked for the event, pulled in from the Loot Split calculator.', 'list',
 '{"bindKey":"lootItems","splitNewlines":false,"style":"bullet","itemPrefix":"• ","itemTemplate":"{value}","headingEmoji":"💰","headingTemplate":"{emoji} **Loot**"}')
on conflict (id) do nothing;
