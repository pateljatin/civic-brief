-- Extend feedback_type CHECK to allow 'reverification' (system-written, not user-submittable).
-- The app enforces user/system separation via USER_FEEDBACK_TYPES; the DB constraint covers both.
alter table community_feedback
  drop constraint if exists community_feedback_feedback_type_check;

alter table community_feedback
  add constraint community_feedback_feedback_type_check
  check (feedback_type in (
    'factual_error', 'missing_info', 'misleading',
    'translation_error', 'outdated', 'helpful',
    'reverification'
  ));
