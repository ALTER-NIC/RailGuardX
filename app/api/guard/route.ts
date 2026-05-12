import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashApiKey } from "@/lib/utils";
import { createServiceClient } from "@/lib/supabase/server";
import { evaluatePolicies, type EvaluationResult } from "@/lib/policy-engine/evaluate";
import { forwardToLLM, streamFromLLM, type LLMProvider } from "@/lib/policy-engine/forward";
import { logAuditEvent } from "@/lib/audit/logger";

const GuardRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .min(1),
  provider: z
    .enum(["openai", "anthropic", "gemini", "groq", "mistral", "together", "perplexity", "xai", "cohere"])
    .default("groq"),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().default(false),
});

const EMPTY_EVAL: EvaluationResult = {
  passed: true,
  violations: [],
  action: "allowed",
  policies_evaluated: [],
  blocked_reason: undefined,
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Authenticate
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith("rgx_live_")) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const keyHash = hashApiKey(rawKey);

  // 2. Look up key → project → user
  const { data: apiKeyRow, error: keyError } = await supabase
    .from("api_keys")
    .select("id, project_id, projects(id, user_id)")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !apiKeyRow) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const projectId = apiKeyRow.project_id;
  const apiKeyId = apiKeyRow.id;
  const projectData = apiKeyRow.projects as { id: string; user_id: string } | Array<{ id: string; user_id: string }>;
  const userId = Array.isArray(projectData) ? projectData[0]?.user_id : projectData?.user_id;

  // Update last_used_at (fire-and-forget, non-blocking)
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKeyId).then(() => {});

  // 3. Quota enforcement
  if (userId) {
    const [subResult, projectsResult] = await Promise.all([
      supabase.from("subscriptions").select("plan").eq("user_id", userId).single(),
      supabase.from("projects").select("id").eq("user_id", userId),
    ]);

    const plan = subResult.data?.plan || "free";
    const userProjectIds = (projectsResult.data || []).map((p: { id: string }) => p.id);

    const { data: planLimit } = await supabase
      .from("plan_limits")
      .select("max_requests_per_month")
      .eq("plan", plan)
      .single();

    const maxRequests: number = planLimit?.max_requests_per_month ?? 1000;

    if (maxRequests !== -1 && userProjectIds.length > 0) {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .in("project_id", userProjectIds)
        .gte("created_at", startOfMonth);

      if ((count || 0) >= maxRequests) {
        return NextResponse.json(
          {
            error: `Monthly limit of ${maxRequests.toLocaleString()} requests reached. Upgrade at railguardx.ai/settings`,
          },
          { status: 429 }
        );
      }
    }
  }

  // 4. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = GuardRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, provider, model, temperature, max_tokens, stream } = parsed.data;
  const resolvedModel = model || getDefaultModel(provider);

  // 5. Load active policies
  const { data: policiesData } = await supabase
    .from("policies")
    .select("id, name, rule, applies_to, severity")
    .eq("project_id", projectId)
    .eq("enabled", true);

  const activePolicies = (policiesData || []) as Array<{
    id: string;
    name: string;
    rule: string;
    applies_to: "input" | "output" | "both";
    severity: "block" | "warn" | "log";
  }>;

  // 6. Evaluate INPUT policies
  let inputEval: EvaluationResult = EMPTY_EVAL;
  if (activePolicies.length > 0) {
    const inputPolicies = activePolicies.filter((p) => p.applies_to === "input" || p.applies_to === "both");
    if (inputPolicies.length > 0) {
      inputEval = await evaluatePolicies(messages, undefined, inputPolicies);
    }
  }

  // 7. Block on input violation
  if (!inputEval.passed) {
    const latency = Date.now() - startTime;
    await logAuditEvent({
      project_id: projectId,
      api_key_id: apiKeyId,
      input_messages: messages,
      provider,
      model: resolvedModel,
      policies_evaluated: inputEval.policies_evaluated,
      violations: inputEval.violations,
      action_taken: "blocked",
      blocked_reason: inputEval.blocked_reason,
      latency_ms: latency,
    });
    return NextResponse.json(
      {
        error: "Request blocked by guardrail policy",
        reason: inputEval.blocked_reason,
        violations: inputEval.violations.map((v) => ({ policy: v.policy_name, reason: v.reason })),
      },
      { status: 403 }
    );
  }

  // 8a. STREAMING path — input-only policy enforcement, stream response directly
  if (stream) {
    let readable: ReadableStream<Uint8Array>;
    try {
      readable = await streamFromLLM({ provider: provider as LLMProvider, model: resolvedModel, messages, temperature, max_tokens });
    } catch (err) {
      return NextResponse.json({ error: "LLM provider error", details: (err as Error).message }, { status: 502 });
    }

    // Log async — don't block the stream
    logAuditEvent({
      project_id: projectId,
      api_key_id: apiKeyId,
      input_messages: messages,
      provider,
      model: resolvedModel,
      policies_evaluated: inputEval.policies_evaluated,
      violations: inputEval.violations,
      action_taken: inputEval.action === "warned" ? "warned" : "allowed",
      latency_ms: Date.now() - startTime,
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-RailGuardX-Action": inputEval.action,
      },
    });
  }

  // 8b. NON-STREAMING path — full input + output policy enforcement
  let llmResponse;
  try {
    llmResponse = await forwardToLLM({ provider: provider as LLMProvider, model: resolvedModel, messages, temperature, max_tokens });
  } catch (err) {
    return NextResponse.json({ error: "LLM provider error", details: (err as Error).message }, { status: 502 });
  }

  // 9. Evaluate OUTPUT policies
  let outputViolations = inputEval.violations.slice(0); // start with input warn/log violations
  let outputAction: "allowed" | "blocked" | "warned" = "allowed";
  let outputBlockedReason: string | undefined;

  if (activePolicies.length > 0) {
    const outputPolicies = activePolicies.filter((p) => p.applies_to === "output" || p.applies_to === "both");
    if (outputPolicies.length > 0) {
      const outputEval = await evaluatePolicies([], llmResponse.content, outputPolicies);
      outputViolations = [...inputEval.violations, ...outputEval.violations];
      outputAction = outputEval.action;
      outputBlockedReason = outputEval.blocked_reason;
    }
  }

  const finalAction =
    outputAction === "blocked" ? "blocked"
    : inputEval.action === "warned" || outputAction === "warned" ? "warned"
    : "allowed";

  const latency = Date.now() - startTime;

  // 10. Log (always await for non-streaming so we don't lose compliance data)
  await logAuditEvent({
    project_id: projectId,
    api_key_id: apiKeyId,
    input_messages: messages,
    output_content: llmResponse.content,
    provider,
    model: llmResponse.model,
    policies_evaluated: inputEval.policies_evaluated,
    violations: outputViolations,
    action_taken: finalAction,
    blocked_reason: outputBlockedReason,
    latency_ms: latency,
  });

  // 11. Block on output violation
  if (outputAction === "blocked") {
    return NextResponse.json(
      {
        error: "Response blocked by guardrail policy",
        reason: outputBlockedReason,
        violations: outputViolations
          .filter((v) => v.applies_to === "output")
          .map((v) => ({ policy: v.policy_name, reason: v.reason })),
      },
      { status: 403 }
    );
  }

  // 12. Return OpenAI-compatible response
  return NextResponse.json({
    id: `rgx_${Date.now()}`,
    object: "chat.completion",
    model: llmResponse.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: llmResponse.content },
        finish_reason: "stop",
      },
    ],
    usage: llmResponse.usage,
    railguardx: {
      latency_ms: latency,
      action: finalAction,
      violations: outputViolations.length,
    },
  });
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "anthropic":  return "claude-haiku-4-5-20251001";
    case "gemini":     return "gemini-2.0-flash-lite";
    case "groq":       return "llama-3.1-8b-instant";
    case "mistral":    return "mistral-small-latest";
    case "together":   return "meta-llama/Llama-3-8b-chat-hf";
    case "perplexity": return "llama-3.1-sonar-small-128k-online";
    case "xai":        return "grok-2-latest";
    case "cohere":     return "command-r-plus";
    default:           return "gpt-4o-mini";
  }
}
