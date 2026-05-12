"use client";

import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface AuditLog {
  id: string;
  action_taken: "allowed" | "blocked" | "warned";
  provider: string;
  model: string;
  violations: Array<{ policy_name: string; reason: string; severity: string }>;
  latency_ms: number;
  created_at: string;
  blocked_reason?: string;
}

interface LogTableProps {
  logs: AuditLog[];
}

const actionBadge = {
  allowed: <Badge variant="success">Allowed</Badge>,
  blocked: <Badge variant="destructive">Blocked</Badge>,
  warned: <Badge variant="warning">Warned</Badge>,
};

export function LogTable({ logs }: LogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No audit events yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Events will appear here once your app starts sending requests through RailGuardX.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Time</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Action</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Provider / Model</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Violations</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Latency</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </td>
              <td className="px-4 py-3">{actionBadge[log.action_taken]}</td>
              <td className="px-4 py-3">
                <span className="font-medium capitalize">{log.provider}</span>
                <span className="text-muted-foreground"> / {log.model}</span>
              </td>
              <td className="px-4 py-3">
                {log.violations.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="space-y-1">
                    {log.violations.map((v, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-medium">{v.policy_name}:</span>{" "}
                        <span className="text-muted-foreground">{v.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {log.latency_ms ? `${log.latency_ms}ms` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
