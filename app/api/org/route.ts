import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(80),
  org_slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  llm_provider: z
    .enum(["openai", "anthropic", "gemini", "groq", "mistral", "together", "perplexity", "xai", "cohere"])
    .default("openai"),
  llm_model: z.string().default("gpt-4o-mini"),
});

// GET /api/org — fetch the current user's org (or null)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find org via membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, org_slug, llm_provider, llm_model, owner_id, created_at)")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ org: null, role: null });
  }

  const org = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return NextResponse.json({ org, role: membership.role });
}

// POST /api/org — create a new organization
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // User must not already be in an org
  const { data: existing } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You are already a member of an organization" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, org_slug, llm_provider, llm_model } = parsed.data;

  // Use service client for writes that span multiple tables
  const service = createServiceClient();

  // 1. Create the organization
  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({ name, org_slug, owner_id: user.id, llm_provider, llm_model })
    .select()
    .single();

  if (orgError) {
    if (orgError.code === "23505") {
      return NextResponse.json({ error: "That slug is already taken. Try a different one." }, { status: 409 });
    }
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  // 2. Add owner as admin member
  await service.from("organization_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "admin",
  });

  // 3. Auto-create the org's policy project
  await service.from("projects").insert({
    user_id: user.id,
    org_id: org.id,
    name: `${name} — AI Workspace`,
    description: "Auto-created policy project for the team AI workspace",
  });

  return NextResponse.json({ org }, { status: 201 });
}

// PATCH /api/org — update org LLM settings (admin only)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const UpdateSchema = z.object({
    llm_provider: z
      .enum(["openai", "anthropic", "gemini", "groq", "mistral", "together", "perplexity", "xai", "cohere"])
      .optional(),
    llm_model: z.string().optional(),
  });

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: org, error } = await service
    .from("organizations")
    .update(parsed.data)
    .eq("id", membership.org_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org });
}
