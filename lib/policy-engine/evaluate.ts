import type { PolicyEvaluated, PolicyViolation } from "@/lib/audit/logger";

export interface Policy {
  id: string;
  name: string;
  rule: string;
  applies_to: "input" | "output" | "both";
  severity: "block" | "warn" | "log";
}

export interface EvaluationResult {
  passed: boolean;
  violations: PolicyViolation[];
  action: "allowed" | "blocked" | "warned";
  blocked_reason?: string;
  policies_evaluated: PolicyEvaluated[];
}

// Structured, unambiguous prompt — keeps judge focused and consistent
const JUDGE_PROMPT = `You are a strict content policy enforcement system. Evaluate whether the text below violates the policy rule.

POLICY RULE: {RULE}

TEXT TO EVALUATE:
{TEXT}

Respond ONLY with valid JSON, no other text:
{"violated": true, "reason": "one sentence explaining the violation"}
OR
{"violated": false, "reason": "compliant"}

Be precise. Only flag clear, direct violations. Do not be overly restrictive.`;

interface JudgeResult {
  violated: boolean;
  reason: string;
}

function parseJudgeResponse(content: string): JudgeResult {
  const match = content.match(/\{[\s\S]*?\}/);
  if (!match) return { violated: true, reason: "judge_parse_error_failing_safe" };
  try {
    const parsed = JSON.parse(match[0]) as { violated?: unknown; reason?: unknown };
    if (typeof parsed.violated !== "boolean") {
      return { violated: true, reason: "judge_invalid_response_failing_safe" };
    }
    return {
      violated: parsed.violated,
      reason: typeof parsed.reason === "string" ? parsed.reason : "no_reason",
    };
  } catch {
    return { violated: true, reason: "judge_parse_error_failing_safe" };
  }
}

async function judgeWithGroq(text: string, rule: string): Promise<JudgeResult> {
  const prompt = JUDGE_PROMPT.replace("{RULE}", rule).replace("{TEXT}", text);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.POLICY_ENGINE_MODEL || "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Groq judge error: ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return parseJudgeResponse(data.choices?.[0]?.message?.content || "");
}

async function judgeWithOpenAI(text: string, rule: string): Promise<JudgeResult> {
  const prompt = JUDGE_PROMPT.replace("{RULE}", rule).replace("{TEXT}", text);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.POLICY_ENGINE_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI judge error: ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return parseJudgeResponse(data.choices?.[0]?.message?.content || "");
}

async function judgeWithAnthropic(text: string, rule: string): Promise<JudgeResult> {
  const prompt = JUDGE_PROMPT.replace("{RULE}", rule).replace("{TEXT}", text);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.POLICY_ENGINE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic judge error: ${res.status}`);
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const content = data.content?.find((c) => c.type === "text")?.text || "";
  return parseJudgeResponse(content);
}

async function judgeWithGemini(text: string, rule: string): Promise<JudgeResult> {
  const model = process.env.POLICY_ENGINE_MODEL || "gemini-2.0-flash-lite";
  const prompt = JUDGE_PROMPT.replace("{RULE}", rule).replace("{TEXT}", text);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY || ""}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini judge error: ${res.status}`);
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseJudgeResponse(content);
}

async function judgePolicy(text: string, rule: string): Promise<JudgeResult> {
  const provider = process.env.POLICY_ENGINE_PROVIDER || "groq";
  try {
    if (provider === "anthropic") return await judgeWithAnthropic(text, rule);
    if (provider === "gemini") return await judgeWithGemini(text, rule);
    if (provider === "openai") return await judgeWithOpenAI(text, rule);
    return await judgeWithGroq(text, rule);
  } catch (err) {
    // FAIL CLOSED: if the judge can't run, we treat it as a violation to protect the user
    console.error("[PolicyEngine] Judge failed, failing closed. Rule:", rule, "Error:", err);
    return { violated: true, reason: "policy_engine_unavailable" };
  }
}

function messagesToText(messages: unknown[]): string {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((m: unknown) => {
      if (typeof m === "object" && m !== null && "content" in m) {
        const msg = m as { role?: string; content: unknown };
        const role = typeof msg.role === "string" ? msg.role.toUpperCase() : "USER";
        const content =
          typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return `${role}: ${content}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export async function evaluatePolicies(
  inputMessages: unknown[],
  outputContent: string | undefined,
  policies: Policy[]
): Promise<EvaluationResult> {
  const violations: PolicyViolation[] = [];
  const policies_evaluated: PolicyEvaluated[] = policies.map((p) => ({
    id: p.id,
    name: p.name,
    rule: p.rule,
    applies_to: p.applies_to,
    severity: p.severity,
  }));

  const inputText = messagesToText(inputMessages);

  const checks = await Promise.all(
    policies.map(async (policy) => {
      const checksToRun: Array<{ text: string; applies_to: "input" | "output" }> = [];
      if ((policy.applies_to === "input" || policy.applies_to === "both") && inputText) {
        checksToRun.push({ text: inputText, applies_to: "input" });
      }
      if ((policy.applies_to === "output" || policy.applies_to === "both") && outputContent) {
        checksToRun.push({ text: outputContent, applies_to: "output" });
      }

      const results = await Promise.all(
        checksToRun.map(async ({ text, applies_to }) => {
          const result = await judgePolicy(text, policy.rule);
          if (result.violated) {
            return {
              policy_id: policy.id,
              policy_name: policy.name,
              rule: policy.rule,
              severity: policy.severity,
              reason: result.reason,
              applies_to,
            } as PolicyViolation;
          }
          return null;
        })
      );

      return results.filter((r): r is PolicyViolation => r !== null);
    })
  );

  checks.forEach((pv) => violations.push(...pv));

  let action: "allowed" | "blocked" | "warned" = "allowed";
  let blocked_reason: string | undefined;

  const blocking = violations.find((v) => v.severity === "block");
  const warning = violations.find((v) => v.severity === "warn");

  if (blocking) {
    action = "blocked";
    blocked_reason = `Policy "${blocking.policy_name}" violated: ${blocking.reason}`;
  } else if (warning) {
    action = "warned";
  }

  return { passed: action !== "blocked", violations, action, blocked_reason, policies_evaluated };
}
