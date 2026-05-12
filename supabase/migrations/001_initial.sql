-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects: each user can have multiple AI apps connected to RailGuardX
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- API Keys: hashed keys used by the SDK to authenticate
create table api_keys (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  key_hash text not null unique,  -- sha256 hash of the actual key
  key_prefix text not null,       -- first 8 chars shown to user e.g. "rgx_live"
  last_used_at timestamptz,
  created_at timestamptz default now() not null
);

-- Policies: plain-English guardrail rules per project
create table policies (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  description text,
  rule text not null,             -- the plain-English rule
  applies_to text not null default 'both' check (applies_to in ('input', 'output', 'both')),
  severity text not null default 'block' check (severity in ('block', 'warn', 'log')),
  enabled boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Audit Logs: every request intercepted, flagged or clean
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  api_key_id uuid references api_keys(id) on delete set null,
  input_messages jsonb not null,               -- the messages array sent
  output_content text,                          -- the LLM response (if any)
  provider text,                                -- openai / anthropic / gemini
  model text,                                   -- the model used
  policies_evaluated jsonb not null default '[]',  -- which policies were checked
  violations jsonb not null default '[]',           -- which policies fired
  action_taken text not null check (action_taken in ('allowed', 'blocked', 'warned')),
  blocked_reason text,
  latency_ms integer,
  created_at timestamptz default now() not null
);

-- Subscriptions: Stripe billing data
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'agency', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Plan limits table for enforcing usage quotas
create table plan_limits (
  plan text primary key,
  max_projects integer not null,
  max_policies_per_project integer not null,
  max_requests_per_month integer not null,
  log_retention_days integer not null
);

insert into plan_limits values
  ('free',       1,  5,    1000,   7),
  ('starter',    3,  20,   50000,  30),
  ('pro',        10, 100,  500000, 90),
  ('agency',     -1, -1,   -1,     365),
  ('enterprise', -1, -1,   -1,     -1);

-- Row Level Security
alter table projects enable row level security;
alter table api_keys enable row level security;
alter table policies enable row level security;
alter table audit_logs enable row level security;
alter table subscriptions enable row level security;

-- RLS Policies
create policy "Users own their projects"
  on projects for all using (auth.uid() = user_id);

create policy "Users own their api_keys via projects"
  on api_keys for all using (
    exists (select 1 from projects where projects.id = api_keys.project_id and projects.user_id = auth.uid())
  );

create policy "Users own their policies via projects"
  on policies for all using (
    exists (select 1 from projects where projects.id = policies.project_id and projects.user_id = auth.uid())
  );

create policy "Users own their audit_logs via projects"
  on audit_logs for all using (
    exists (select 1 from projects where projects.id = audit_logs.project_id and projects.user_id = auth.uid())
  );

create policy "Users own their subscription"
  on subscriptions for all using (auth.uid() = user_id);

-- Indexes for performance
create index idx_audit_logs_project_id on audit_logs(project_id);
create index idx_audit_logs_created_at on audit_logs(created_at desc);
create index idx_audit_logs_action_taken on audit_logs(action_taken);
create index idx_policies_project_id on policies(project_id);
create index idx_api_keys_key_hash on api_keys(key_hash);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_projects_updated_at before update on projects
  for each row execute function update_updated_at();
create trigger update_policies_updated_at before update on policies
  for each row execute function update_updated_at();
create trigger update_subscriptions_updated_at before update on subscriptions
  for each row execute function update_updated_at();

-- Auto-create a free subscription on user sign-up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
