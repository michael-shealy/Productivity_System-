-- ============================================================
-- Four-week reviews: multi-select goals (goal_ids array)
-- ============================================================

alter table public.four_week_reviews
  add column if not exists goal_ids uuid[] not null default '{}';

update public.four_week_reviews
  set goal_ids = case
    when goal_id is not null then array[goal_id]
    else '{}'
  end;

alter table public.four_week_reviews
  drop column if exists goal_id;
