"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  ScrollText,
  Key,
  Settings,
  Zap,
  FlaskConical,
  Users,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const devNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/policies", label: "Policies", icon: ShieldCheck },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface OrgInfo {
  role: "admin" | "member" | null;
  hasOrg: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const [org, setOrg] = useState<OrgInfo>({ role: null, hasOrg: false });

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((data) => {
        if (data.org) {
          setOrg({ role: data.role, hasOrg: true });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">RailGuardX</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {devNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}

        {/* Team section — only shown when user belongs to an org */}
        {org.hasOrg && (
          <>
            <div className="mx-3 my-2 border-t" />
            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workspace
            </p>

            {org.role === "admin" && (
              <Link
                href="/team"
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === "/team"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Users className="h-4 w-4" />
                Team
              </Link>
            )}

            <Link
              href="/chat"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/chat"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              AI Chat
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Docs:{" "}
          <a href="/docs" className="underline hover:text-foreground">
            railguardx.ai/docs
          </a>
        </p>
      </div>
    </aside>
  );
}
