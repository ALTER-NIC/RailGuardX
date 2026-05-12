"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Policy {
  id: string;
  name: string;
  applies_to: string;
  severity: string;
}

interface PolicyBannerProps {
  policies: Policy[];
}

const severityConfig = {
  block: { label: "Block", icon: ShieldCheck, className: "text-destructive" },
  warn: { label: "Warn", icon: AlertTriangle, className: "text-yellow-600" },
  log: { label: "Monitor", icon: Eye, className: "text-muted-foreground" },
};

export function PolicyBanner({ policies }: PolicyBannerProps) {
  const [open, setOpen] = useState(false);

  const blockCount = policies.filter((p) => p.severity === "block").length;
  const warnCount = policies.filter((p) => p.severity === "warn").length;

  return (
    <div className="border-b bg-muted/40 shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>
            <span className="font-medium text-foreground">{policies.length} active policies</span>
            {blockCount > 0 && (
              <span className="ml-2 text-destructive">{blockCount} blocking</span>
            )}
            {warnCount > 0 && (
              <span className="ml-2 text-yellow-600">{warnCount} warning</span>
            )}
          </span>
        </div>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="px-4 pb-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {policies.map((policy) => {
            const config = severityConfig[policy.severity as keyof typeof severityConfig] || severityConfig.log;
            const Icon = config.icon;
            return (
              <div
                key={policy.id}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
              >
                <Icon className={cn("h-3 w-3 shrink-0", config.className)} />
                <span className="text-xs font-medium truncate">{policy.name}</span>
                <span className={cn("text-xs ml-auto shrink-0", config.className)}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
