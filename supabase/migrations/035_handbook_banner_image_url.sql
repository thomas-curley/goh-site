-- Per-section admin-editable banner image, replacing the hardcoded
-- slug->image mapping that lived in app/staff-handbook/[slug]/page.tsx.
-- Seeds the 9 top-level sections with the illustrations already pulled
-- from the source docx (public/images/handbook/*.png) -- admins can swap
-- these out via the ImageUploader in the handbook editor.
alter table handbook_sections add column if not exists banner_image_url text;

update handbook_sections set banner_image_url = '/images/handbook/' || slug || '.png'
where slug in (
  'preface', 'forest-explained', 'duties-expectations', 'discipline',
  'events-challenges', 'onboarding-mentoring', 'promotion-growth',
  'inactivity-stepping-down', 'appendix-clan-rules'
);
