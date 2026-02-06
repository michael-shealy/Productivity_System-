-- ============================================================
-- Seed script for Productivity System
-- Run AFTER creating your user account in Supabase Auth dashboard.
-- Replace YOUR_USER_ID_HERE with your actual auth.users UUID.
-- ============================================================

-- Seed goals (from frontend/src/lib/goals.ts)
INSERT INTO public.goals (user_id, slug, title, domain, description, season, active, sort_order)
VALUES
  ('YOUR_USER_ID_HERE', 'health-fitness',   'Build a sustainable health & fitness foundation', 'Health & Fitness',           'Weight loss through calorie awareness, consistent movement (gym, running, walking), and embodied care rather than punishment.', 'Phase 1 — building minimums', true, 0),
  ('YOUR_USER_ID_HERE', 'emotional-growth', 'Grow emotionally through identity-based practice', 'Emotional Growth',          'Daily grounding, presence, curiosity sparks, and identity check-ins that reinforce who I am becoming rather than what I produce.', 'Ongoing — daily practice', true, 1),
  ('YOUR_USER_ID_HERE', 'marriage',         'Nurture my marriage and partnership',              'Marriage & Relationship',    'Intentional date nights, present connection with my partner, wedding planning momentum, and genuine care over performance.', 'Engaged — wedding season', true, 2),
  ('YOUR_USER_ID_HERE', 'mba',             'Excel in my graduate program program',                          'graduate program',                        'Engage meaningfully with coursework, build professional skills, and leverage the graduate program network without losing balance.', 'Active enrollment', true, 3),
  ('YOUR_USER_ID_HERE', 'bcg-career',      'Launch strong at Employer',                           'Career — Employer',             'Prepare for internship and career with technical skill building (Python, causal inference, ML), professional presence, and strategic learning.', 'Pre-internship prep', true, 4),
  ('YOUR_USER_ID_HERE', 'relationships',   'Maintain meaningful relationships',                 'Relationships & Community',  'Stay connected with family, friends, and community through regular check-ins, social events, and genuine presence.', 'Ongoing', true, 5),
  ('YOUR_USER_ID_HERE', 'daily-identity',  'Live from identity, not output',                    'Daily Identity',             'Anchor each day in values (presence, grounded confidence, curiosity) rather than productivity metrics. The system serves identity, not the reverse.', 'Core operating principle', true, 6)
ON CONFLICT (user_id, slug) DO NOTHING;

-- To seed habits and habit_sessions from CSV exports, use a script or
-- import them via the Supabase dashboard CSV import feature. The CSV files
-- are in the repo at export_1770248675244/activities.csv and sessions.csv.
-- Map `id` from the CSV to `external_id` in the habits table.
