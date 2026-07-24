-- Survey builder: admin-authored surveys (rating / multiple-choice / free
-- text questions) with public, anonymous-by-default responses. Anonymity is
-- a per-response choice, not a survey setting -- respondent_name is filled
-- in only if the respondent chose to identify themselves.
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  questions jsonb not null default '[]', -- [{id, type: 'rating'|'multiple_choice'|'text', prompt, options?: string[], required}]
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  answers jsonb not null default '[]', -- [{question_id, value}]
  respondent_name text,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_survey_responses_survey on survey_responses(survey_id);

alter table surveys enable row level security;
alter table survey_responses enable row level security;

create policy "Authenticated users can manage surveys"
  on surveys for all
  using (auth.role() = 'authenticated');

create policy "Authenticated users can manage survey responses"
  on survey_responses for all
  using (auth.role() = 'authenticated');
