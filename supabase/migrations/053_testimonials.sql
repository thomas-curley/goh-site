-- Google-review-style clan testimonials: a verified member leaves a star
-- rating + message about the clan, an admin approves/rejects it, and
-- approved ones can be marked "featured" for homepage/About placement.
-- unique(user_id) is deliberate -- one testimonial per member (like one
-- Google review per account); resubmitting replaces it and resets it to
-- pending for re-review.
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  rsn text not null,
  rating int not null check (rating between 1 and 5),
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  featured boolean not null default false,
  review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_testimonials_status on testimonials(status);

alter table testimonials enable row level security;

create policy "Authenticated users can manage testimonials"
  on testimonials for all
  using (auth.role() = 'authenticated');
