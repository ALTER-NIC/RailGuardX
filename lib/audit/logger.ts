import { createServiceClient } from "@/lib/supabase/server";

interface AuditLogEntry {
  project_id: string;
  api_key_id?: string;
  org_member_id?: string;
  input_messages: unknown[];
  output_content?: string;
  provider: string;
  model: string;
  policies_evaluated: PolicyEvaluated[];
  violations: PolicyViolation[];
  action_taken: "allowed" | "blocked" | "warned";
  blocked_reason?: string;
  latency_ms?: number;
}

export interface PolicyEvaluated {
  id: string;
  name: string;
  rule: string;
  applies_to: string;
  severity: string;
}

export interface PolicyViolation {
  policy_id: string;
  policy_name: string;
  rule: string;
  severity: string;
  reason: string;
  applies_to: "input" | "output";
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("audit_logs").insert(entry);
  } catch (error) {
    // Audit logging must never crash the main request
    console.error("[AuditLogger] Failed to write log:", error);
  }
}
