import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const AcceptSchema = z.object({
  token: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  // Requires the user to be authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AcceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { token } = parsed.data;
  const service = createServiceClient();

  // 1. Validate the invite token
  const { data: invite } = await service
    .from("organization_invites")
    .select("id, org_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }

  // 2. Optionally enforce that the invited email matches (commented — relax for MVP)
  // if (invite.email && invite.email !== user.email) {
  //   return NextResponse.json({ error: "This invite was sent to a different email address" }, { status: 403 });
  // }

  // 3. Check the user is not already a member of this org
  const { data: existingMember } = await service
    .from("organization_members")
    .select("id")
    .eq("org_id", invite.org_id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    // Already a member — just redirect them in
    return NextResponse.json({ success: true, org_id: invite.org_id });
  }

  // 4. Add user to org
  const { error: insertError } = await service.from("organization_members").insert({
    org_id: invite.org_id,
    user_id: user.id,
    role: invite.role,
  });

  if (insertError) {
    console.error("[/api/org/accept] insert member error:", insertError);
    return NextResponse.json({ error: "Failed to join workspace" }, { status: 500 });
  }

  // 5. Mark invite as accepted
  await service
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ success: true, org_id: invite.org_id });
}
