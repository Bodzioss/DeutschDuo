-- Daily goal (minutes) in effect when a review was made.
-- A day is judged by its own goal, so changing the goal later does not rewrite streak history.
-- Nullable: older reviews have no snapshot and fall back to the current goal.
alter table public.reviews
  add column goal_min smallint check (goal_min between 1 and 240);
