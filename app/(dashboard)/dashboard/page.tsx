import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ShieldCheck, ShieldX, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .limit(5);

  const projectIds = projects?.map((p) => p.id) || [];

  // Stats — last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalRequests }, { count: blockedCount }, { count: warnedCount }] =
    await Promise.all([
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).in("project_id", projectIds).gte("created_at", thirtyDaysAgo),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).in("project_id", projectIds).eq("action_taken", "blocked").gte("created_at", thirtyDaysAgo),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).in("project_id", projectIds).eq("action_taken", "warned").gte("created_at", thirtyDaysAgo),
    ]);

  // Recent logs
  const { data: recentLogs } = await supabase
    .from("audit_logs")
    .select("id, action_taken, provider, model, created_at, violations")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(8);

  const hasProjects = projectIds.length > 0;

  return (
    <div>
      <Header title="Dashboard" description="Overview of your AI guardrail activity" />
      <div className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Requests (30d)"
            value={totalRequests ?? 0}
            description="All intercepted requests"
            icon={Activity}
          />
          <StatsCard
            title="Blocked"
            value={blockedCount ?? 0}
            description="Requests stopped by policy"
            icon={ShieldX}
          />
          <StatsCard
            title="Warned"
            value={warnedCount ?? 0}
            description="Requests flagged, not blocked"
            icon={AlertTriangle}
          />
          <StatsCard
            title="Active Projects"
            value={projectIds.length}
            description="Apps connected to RailGuardX"
            icon={ShieldCheck}
          />
        </div>

        {!hasProjects && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Create your first project</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Connect an AI app to RailGuardX to start enforcing guardrails and logging requests.
              </p>
              <Button asChild>
                <Link href="/api-keys">Create project + get API key</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {hasProjects && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {!recentLogs?.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity yet. Make a request through the guard endpoint to see it here.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            log.action_taken === "blocked"
                              ? "destructive"
                              : log.action_taken === "warned"
                              ? "warning"
                              : "success"
                          }
                        >
                          {log.action_taken}
                        </Badge>
                        <span className="text-sm text-muted-foreground capitalize">
                          {log.provider} / {log.model}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
