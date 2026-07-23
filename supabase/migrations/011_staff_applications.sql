-- Staff application process: existing members apply for a staff role via
-- /apply, staff review + approve/reject via /admin/staff-applications.
-- Not a recruitment form — applicants must already be authenticated members.

create table if not exists staff_applications (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  discord_username text not null,
  rsn text,
  answers jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_applications_status_created
  on staff_applications(status, created_at desc);

alter table staff_applications enable row level security;

-- Same trust model as post_templates/event_recap_posts: enforcement is the
-- admin UI's checkPermission gate, not RLS.
create policy "Authenticated users can manage staff applications"
  on staff_applications for all
  using (auth.role() = 'authenticated');
