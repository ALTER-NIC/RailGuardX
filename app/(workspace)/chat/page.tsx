import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/workspace/chat-interface";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get org info + membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, role, organizations(id, name, llm_provider, llm_model)")
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/onboarding");

  const org = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  if (!org) redirect("/onboarding");

  // Get the org's project (auto-created on org setup)
  const { data: orgProject } = await supabase
    .from("projects")
    .select("id")
    .eq("org_id", org.id)
    .single();

  // Get active policies (names only — employees see policy names, not exact rule text)
  let policies: { id: string; name: string; applies_to: string; severity: string }[] = [];
  if (orgProject) {
    const { data } = await supabase
      .from("policies")
      .select("id, name, applies_to, severity")
      .eq("project_id", orgProject.id)
      .eq("enabled", true);
    policies = data || [];
  }

  return (
    <ChatInterface
      user={{ id: user.id, email: user.email || "" }}
      org={{ id: org.id, name: org.name, llm_provider: org.llm_provider, llm_model: org.llm_model }}
      policies={policies}
      isAdmin={membership.role === "admin"}
    />
  );
}
