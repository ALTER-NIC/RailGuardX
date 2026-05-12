-- ============================================================
-- Migration 002: Organizations / Team Workspace
-- Adds employer org layer on top of the existing developer tools
-- ============================================================

-- Organizations: one per company/employer
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  org_slug text not null unique,
  -- LLM config chosen by the admin for all employees
  llm_provider text not null default 'openai' check (llm_provider in ('openai','anthropic','gemini','groq','mistral','together','perplexity','xai','cohere')),
  llm_model text not null default 'gpt-4o-mini',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Organization members: employees invited by the admin
create table organization_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now() not null,
  unique(org_id, user_id)
);

-- Organization invites: pending email invitations
create table organization_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  email text not null,
  token uuid default uuid_generate_v4() not null unique,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now() not null
);

-- Add org_id to projects (nullable — existing dev projects stay org-less)
alter table projects add column org_id uuid references organizations(id) on delete set null;

-- Add org_member_id to audit_logs (nullable — links org chat to the employee)
alter table audit_logs add column org_member_id uuid references organization_members(id) on delete set null;

-- Add max_seats to plan_limits
alter table plan_limits add column max_seats integer not null default -1;

-- Update existing plan rows with seat limits
update plan_limits set max_seats = 1   where plan = 'free';
update plan_limits set max_seats = 5   where plan = 'starter';
update plan_limits set max_seats = 25  where plan = 'pro';
update plan_limits set max_seats = -1  where plan = 'agency';
update plan_limits set max_seats = -1  where plan = 'enterprise';

-- Insert new org-focused plans
insert into plan_limits (plan, max_projects, max_policies_per_project, max_requests_per_month, log_retention_days, max_seats) values
  ('team',     5,  50,   50000,  30,  10),
  ('business', 10, 100,  500000, 90,  50);

-- Widen the subscriptions plan check constraint to include new plans
alter table subscriptions drop constraint subscriptions_plan_check;
alter table subscriptions add constraint subscriptions_plan_check
  check (plan in ('free', 'starter', 'pro', 'agency', 'enterprise', 'team', 'business'));

-- ---- Row Level Security ----

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_invites enable row level security;

-- Organizations: owner has full access
create policy "Org owner full access"
  on organizations for all using (auth.uid() = owner_id);

-- Organizations: members can view their org
create policy "Org members can view their org"
  on organizations for select using (
    exists (
      select 1 from organization_members
      where organization_members.org_id = organizations.id
        and organization_members.user_id = auth.uid()
    )
  );

-- Members: any member of the org can see all other members
create policy "Members can view org members"
  on organization_members for select using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_members.org_id
        and om.user_id = auth.uid()
    )
  );

-- Members: only admins can insert/update/delete members
create policy "Org admins manage members"
  on organization_members for insert with check (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_members.org_id
        and om.user_id = auth.uid()
        and om.role = 'admin'
    )
  );

create policy "Org admins update members"
  on organization_members for update using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_members.org_id
        and om.user_id = auth.uid()
        and om.role = 'admin'
    )
  );

create policy "Org admins delete members"
  on organization_members for delete using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_members.org_id
        and om.user_id = auth.uid()
        and om.role = 'admin'
    )
  );

-- Invites: admins can manage, public invite acceptance handled via service role
create policy "Org admins manage invites"
  on organization_invites for all using (
    exists (
      select 1 from organization_members
      where organization_members.org_id = organization_invites.org_id
        and organization_members.user_id = auth.uid()
        and organization_members.role = 'admin'
    )
  );

-- ---- Indexes ----
create index idx_organization_members_user_id on organization_members(user_id);
create index idx_organization_members_org_id on organization_members(org_id);
create index idx_organization_invites_token on organization_invites(token);
create index idx_organization_invites_email on organization_invites(email);
create index idx_projects_org_id on projects(org_id);
create index idx_audit_logs_org_member_id on audit_logs(org_member_id);

-- ---- Triggers ----
create trigger update_organizations_updated_at before update on organizations
  for each row execute function update_updated_at();
