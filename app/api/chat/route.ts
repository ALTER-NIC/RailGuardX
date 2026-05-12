import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { evaluatePolicies } from "@/lib/policy-engine/evaluate";
import { forwardToLLM, type LLMProvider } from "@/lib/policy-engine/forward";
import { logAuditEvent } from "@/lib/audit/logger";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(32_000),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Authenticate via Supabase session (cookie-based — employees are regular users)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Verify org membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, role, org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of any workspace" },
      { status: 403 }
    );
  }

  const service = createServiceClient();

  // 3. Load org config (LLM provider + model)
  const { data: org } = await service
    .from("organizations")
    .select("id, llm_provider, llm_model, owner_id")
    .eq("id", membership.org_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // 4. Enforce monthly request quota based on org owner's subscription
  const { data: sub } = await service
    .from("subscriptions")
    .select("plan")
    .eq("user_id", org.owner_id)
    .single();

  const plan = sub?.plan || "free";

  const { data: planLimit } = await service
    .from("plan_limits")
    .select("max_requests_per_month")
    .eq("plan", plan)
    .single();

  const maxRequests: number = planLimit?.max_requests_per_month ?? 1000;

  if (maxRequests !== -1) {
    // Get the org's project to count requests
    const { data: orgProject } = await service
      .from("projects")
      .select("id")
      .eq("org_id", org.id)
      .single();

    if (orgProject) {
      const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).toISOString();

      const { count: monthlyCount } = await service
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("project_id", orgProject.id)
        .gte("created_at", startOfMonth);

      if ((monthlyCount || 0) >= maxRequests) {
        return NextResponse.json(
          {
            error: `Your workspace has reached its monthly request limit (${maxRequests.toLocaleString()}). Ask your admin to upgrade the plan.`,
          },
          { status: 429 }
        );
      }
    }
  }

  // 5. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { messages } = parsed.data;

  // 6. Load the org's project + policies
  const { data: orgProject } = await service
    .from("projects")
    .select("id")
    .eq("org_id", org.id)
    .single();

  let activePolicies: Array<{
    id: string;
    name: string;
    rule: string;
    applies_to: "input" | "output" | "both";
    severity: "block" | "warn" | "log";
  }> = [];

  if (orgProject) {
    const { data: policies } = await service
      .from("policies")
      .select("id, name, rule, applies_to, severity")
      .eq("project_id", orgProject.id)
      .eq("enabled", true);
    activePolicies = policies || [];
  }

  // 7. Evaluate input against input/both policies
  const inputPolicies = activePolicies.filter(
    (p) => p.applies_to === "input" || p.applies_to === "both"
  );

  let inputEval: Awaited<ReturnType<typeof evaluatePolicies>> = {
    passed: true,
    violations: [],
    action: "allowed",
    policies_evaluated: [],
  };

  if (inputPolicies.length > 0) {
    inputEval = await evaluatePolicies(messages, undefined, inputPolicies);
  }

  if (!inputEval.passed) {
    if (orgProject) {
      logAuditEvent({
        project_id: orgProject.id,
        org_member_id: membership.id,
        input_messages: messages,
        provider: org.llm_provider,
        model: org.llm_model,
        policies_evaluated: inputEval.policies_evaluated,
        violations: inputEval.violations,
        action_taken: "blocked",
        blocked_reason: inputEval.blocked_reason,
        latency_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json(
      {
        content: "",
        action: "blocked",
        violations: inputEval.violations.map((v) => ({
          policy_name: v.policy_name,
          reason: v.reason,
          severity: v.severity,
        })),
      },
      { status: 403 }
    );
  }

  // 8. Forward to LLM
  let llmResponse: { content: string; model: string };
  try {
    llmResponse = await forwardToLLM({
      provider: org.llm_provider as LLMProvider,
      model: org.llm_model,
      messages: messages as unknown[],
    });
  } catch (err) {
    console.error("[/api/chat] LLM forward error:", err);
    return NextResponse.json(
      { error: "The AI service is unavailable right now. Please try again." },
      { status: 502 }
    );
  }

  // 9. Evaluate output against output/both policies
  const outputPolicies = activePolicies.filter(
    (p) => p.applies_to === "output" || p.applies_to === "both"
  );

  let outputEval: Awaited<ReturnType<typeof evaluatePolicies>> = {
    passed: true,
    violations: [],
    action: "allowed",
    policies_evaluated: [],
  };

  if (outputPolicies.length > 0) {
    outputEval = await evaluatePolicies(messages, llmResponse.content, outputPolicies);
  }

  const finalAction =
    !outputEval.passed
      ? "blocked"
      : inputEval.action === "warned" || outputEval.action === "warned"
      ? "warned"
      : "allowed";

  const allViolations = [...inputEval.violations, ...outputEval.violations];

  // 10. Log the completed request (fire-and-forget)
  if (orgProject) {
    logAuditEvent({
      project_id: orgProject.id,
      org_member_id: membership.id,
      input_messages: messages,
      output_content: llmResponse.content,
      provider: org.llm_provider,
      model: llmResponse.model,
      policies_evaluated: [
        ...inputEval.policies_evaluated,
        ...outputEval.policies_evaluated.filter(
          (p) => !inputEval.policies_evaluated.find((e) => e.id === p.id)
        ),
      ],
      violations: allViolations,
      action_taken: finalAction,
      blocked_reason: !outputEval.passed ? outputEval.blocked_reason : undefined,
      latency_ms: Date.now() - startTime,
    });
  }

  // Output was blocked — log it but don't return the content
  if (!outputEval.passed) {
    return NextResponse.json(
      {
        content: "",
        action: "blocked",
        violations: outputEval.violations.map((v) => ({
          policy_name: v.policy_name,
          reason: v.reason,
          severity: v.severity,
        })),
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    content: llmResponse.content,
    action: finalAction,
    violations: allViolations.map((v) => ({
      policy_name: v.policy_name,
      reason: v.reason,
      severity: v.severity,
    })),
  });
}
