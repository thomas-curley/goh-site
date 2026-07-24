-- General feedback: lower-friction than a structured survey, same
-- anonymity model (respondent_name is only set if the submitter chose to
-- share it).
create table if not exists feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  category text,
  respondent_name text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_submissions_status_created
  on feedback_submissions(status, created_at desc);

alter table feedback_submissions enable row level security;

create policy "Authenticated users can manage feedback submissions"
  on feedback_submissions for all
  using (auth.role() = 'authenticated');
