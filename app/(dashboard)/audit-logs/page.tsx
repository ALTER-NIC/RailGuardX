"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { LogTable } from "@/components/audit/log-table";
import { Button } from "@/components/ui/button";

interface Project { id: string; name: string; }

export default function AuditLogsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects || []);
        if (d.projects?.length > 0) setSelectedProject(d.projects[0].id);
      });
  }, []);

  const loadLogs = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    const params = new URLSearchParams({
      project_id: selectedProject,
      limit: String(limit),
      offset: String(offset),
    });
    if (filter) params.set("action", filter);

    const res = await fetch(`/api/logs?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [selectedProject, filter, offset]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <div>
      <Header title="Audit Logs" description="Every request intercepted by RailGuardX — tamper-evident and exportable" />
      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {projects.length > 1 && projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProject(p.id); setOffset(0); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                selectedProject === p.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              {p.name}
            </button>
          ))}
          <div className="flex gap-2 ml-auto">
            {["", "blocked", "warned", "allowed"].map((a) => (
              <button
                key={a}
                onClick={() => { setFilter(a); setOffset(0); }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filter === a ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                }`}
              >
                {a === "" ? "All" : a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {total} total events
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <LogTable logs={logs} />
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
