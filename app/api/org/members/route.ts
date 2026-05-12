import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET /api/org/members — list all members of the current user's org
export async function GET() {
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

  if (!membership) return NextResponse.json({ error: "Not a member of any organization" }, { status: 403 });

  // Fetch all members with their auth user emails via service role
  const service = createServiceClient();

  const { data: members, error } = await service
    .from("organization_members")
    .select("id, role, joined_at, user_id")
    .eq("org_id", membership.org_id)
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch emails from auth.users for each member
  const memberIds = (members || []).map((m: { user_id: string }) => m.user_id);
  const emailMap: Record<string, string> = {};

  if (memberIds.length > 0) {
    const { data: usersData } = await service.auth.admin.listUsers();
    if (usersData?.users) {
      for (const u of usersData.users) {
        if (memberIds.includes(u.id)) {
          emailMap[u.id] = u.email || "";
        }
      }
    }
  }

  const enriched = (members || []).map((m: { id: string; role: string; joined_at: string; user_id: string }) => ({
    ...m,
    email: emailMap[m.user_id] || "",
    is_you: m.user_id === user.id,
  }));

  // Also return pending invites
  const { data: invites } = await service
    .from("organization_invites")
    .select("id, email, role, expires_at, created_at")
    .eq("org_id", membership.org_id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ members: enriched, invites: invites || [], viewer_role: membership.role });
}

// PATCH /api/org/members — change a member's role (admin only)
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

  let body: { member_id?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.member_id || !["admin", "member"].includes(body.role || "")) {
    return NextResponse.json({ error: "member_id and valid role required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify the target member is in the same org
  const { data: target } = await service
    .from("organization_members")
    .select("id, user_id")
    .eq("id", body.member_id)
    .eq("org_id", membership.org_id)
    .single();

  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Prevent demoting the only admin
  if (body.role === "member") {
    const { count: adminCount } = await service
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", membership.org_id)
      .eq("role", "admin");

    if ((adminCount || 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 400 });
    }
  }

  const { error } = await service
    .from("organization_members")
    .update({ role: body.role })
    .eq("id", body.member_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/org/members?member_id=xxx — remove a member (admin only, or self-leave)
export async function DELETE(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, role, org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not in an organization" }, { status: 403 });

  const isSelf = membership.id === memberId;
  const isAdmin = membership.role === "admin";

  // Only admins can remove others; anyone can remove themselves
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const service = createServiceClient();

  // Verify target is in same org
  const { data: target } = await service
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("org_id", membership.org_id)
    .single();

  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Prevent removing the last admin
  if (target.role === "admin") {
    const { count: adminCount } = await service
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", membership.org_id)
      .eq("role", "admin");

    if ((adminCount || 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 400 });
    }
  }

  const { error } = await service.from("organization_members").delete().eq("id", memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
