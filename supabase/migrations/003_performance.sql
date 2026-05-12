-- Migration 003: Performance indexes
-- Speeds up the monthly quota COUNT query in /api/guard
-- which filters audit_logs by project_id AND created_at together

create index if not exists idx_audit_logs_project_created
  on audit_logs(project_id, created_at desc);

-- Speeds up policy lookups per project (project_id + enabled filter)
create index if not exists idx_policies_project_enabled
  on policies(project_id, enabled);

-- Speeds up subscription lookups by user
create index if not exists idx_subscriptions_user_id
  on subscriptions(user_id);
