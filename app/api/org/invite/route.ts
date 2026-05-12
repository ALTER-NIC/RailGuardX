import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET /api/org/invite?token=xxx — validate an invite token (public, for the /join page)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const service = createServiceClient();
  const { data: invite, error } = await service
    .from("organization_invites")
    .select("id, email, role, expires_at, accepted_at, org_id, organizations(name, org_slug)")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite link has expired" }, { status: 410 });
  }

  const org = Array.isArray(invite.organizations) ? invite.organizations[0] : invite.organizations;

  return NextResponse.json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      org_id: invite.org_id,
      org_name: org?.name,
    },
  });
}

// POST /api/org/invite — create an invite (admin only)
export async function POST(request: NextRequest) {
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

  let body: { email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "member";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Check seat limits
  const service = createServiceClient();

  const [{ data: org }, { count: memberCount }] = await Promise.all([
    service
      .from("organizations")
      .select("id, owner_id")
      .eq("id", membership.org_id)
      .single(),
    service
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", membership.org_id),
  ]);

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const { data: sub } = await service
    .from("subscriptions")
    .select("plan")
    .eq("user_id", org.owner_id)
    .single();

  const plan = sub?.plan || "free";
  const { data: planLimit } = await service
    .from("plan_limits")
    .select("max_seats")
    .eq("plan", plan)
    .single();

  const maxSeats: number = planLimit?.max_seats ?? 1;
  if (maxSeats !== -1 && (memberCount || 0) >= maxSeats) {
    return NextResponse.json(
      { error: `Seat limit of ${maxSeats} reached for your plan. Upgrade to invite more members.` },
      { status: 429 }
    );
  }

  // Check if already a member or already has a pending invite
  const { data: existingInvite } = await service
    .from("organization_invites")
    .select("id, accepted_at")
    .eq("org_id", membership.org_id)
    .eq("email", email)
    .is("accepted_at", null)
    .single();

  if (existingInvite) {
    return NextResponse.json({ error: "An active invite already exists for this email" }, { status: 409 });
  }

  // Create invite (expires in 7 days)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: inviteError } = await service
    .from("organization_invites")
    .insert({
      org_id: membership.org_id,
      email,
      role,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  // Return the invite link (admin copies and shares it — no email service required for MVP)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/join?token=${invite.token}`;

  return NextResponse.json({ invite, inviteUrl }, { status: 201 });
}

// DELETE /api/org/invite?id=xxx — revoke an invite (admin only)
export async function DELETE(request: NextRequest) {
  const inviteId = request.nextUrl.searchParams.get("id");
  if (!inviteId) return NextResponse.json({ error: "id required" }, { status: 400 });

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

  const service = createServiceClient();
  const { error } = await service
    .from("organization_invites")
    .delete()
    .eq("id", inviteId)
    .eq("org_id", membership.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
