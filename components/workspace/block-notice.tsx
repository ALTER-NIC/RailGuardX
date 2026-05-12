"use client";

import { ShieldX, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Violation {
  policy_name: string;
  reason: string;
  severity: string;
}

interface BlockNoticeProps {
  action: "blocked" | "warned";
  violations: Violation[];
}

export function BlockNotice({ action, violations }: BlockNoticeProps) {
  const isBlock = action === "blocked";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        isBlock
          ? "bg-destructive/5 border-destructive/20 text-destructive"
          : "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700/30 dark:text-yellow-400"
      )}
    >
      <div className="flex items-center gap-2 font-medium mb-1">
        {isBlock ? (
          <ShieldX className="h-4 w-4 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        )}
        {isBlock ? "Message blocked by policy" : "Policy warning"}
      </div>

      {violations.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {violations.map((v, i) => (
            <li key={i} className="text-xs opacity-90">
              <span className="font-semibold">{v.policy_name}:</span> {v.reason}
            </li>
          ))}
        </ul>
      )}

      {violations.length === 0 && (
        <p className="text-xs mt-1 opacity-80">
          {isBlock
            ? "This message was stopped before reaching the AI."
            : "This message triggered a policy warning. Your admin has been notified."}
        </p>
      )}

      {isBlock && (
        <p className="text-xs mt-2 opacity-70">
          If you think this is a mistake, contact your workspace admin.
        </p>
      )}
    </div>
  );
}
