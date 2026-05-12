"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { PolicyForm } from "@/components/policies/policy-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ShieldCheck, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Project { id: string; name: string; }
interface Policy {
  id: string;
  name: string;
  rule: string;
  applies_to: string;
  severity: "block" | "warn" | "log";
  enabled: boolean;
  created_at: string;
}

const severityColors = {
  block: "destructive" as const,
  warn: "warning" as const,
  log: "secondary" as const,
};

export default function PoliciesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects || []);
        if (d.projects?.length > 0) setSelectedProject(d.projects[0].id);
      });
  }, []);

  const loadPolicies = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    const res = await fetch(`/api/policies?project_id=${selectedProject}`);
    const data = await res.json();
    setPolicies(data.policies || []);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const togglePolicy = async (id: string, enabled: boolean) => {
    await fetch(`/api/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    loadPolicies();
  };

  const deletePolicy = async (id: string) => {
    if (!confirm("Delete this policy?")) return;
    await fetch(`/api/policies/${id}`, { method: "DELETE" });
    loadPolicies();
  };

  return (
    <div>
      <Header title="Policies" description="Define plain-English guardrail rules for your AI apps" />
      <div className="p-8 space-y-6">
        {/* Project selector */}
        {projects.length > 1 && (
          <div className="flex gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedProject === p.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Add policy button */}
        {!showForm && selectedProject && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Policy
          </Button>
        )}

        {/* New policy form */}
        {showForm && selectedProject && (
          <PolicyForm
            projectId={selectedProject}
            onSuccess={() => { setShowForm(false); loadPolicies(); }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* No project */}
        {!selectedProject && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Create a project first to add policies.</p>
            </CardContent>
          </Card>
        )}

        {/* Policy list */}
        {selectedProject && !loading && policies.length === 0 && !showForm && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No policies yet</h3>
              <p className="text-sm text-muted-foreground">
                Add your first guardrail rule to start protecting your AI app.
              </p>
            </CardContent>
          </Card>
        )}

        {policies.length > 0 && (
          <div className="space-y-3">
            {policies.map((policy) => (
              <Card key={policy.id} className={!policy.enabled ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{policy.name}</CardTitle>
                      <Badge variant={severityColors[policy.severity]}>{policy.severity}</Badge>
                      <Badge variant="outline">{policy.applies_to}</Badge>
                      {!policy.enabled && <Badge variant="secondary">Disabled</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePolicy(policy.id, policy.enabled)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={policy.enabled ? "Disable policy" : "Enable policy"}
                      >
                        {policy.enabled ? (
                          <ToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => deletePolicy(policy.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <CardDescription className="mt-1 text-sm font-medium text-foreground/80">
                    &ldquo;{policy.rule}&rdquo;
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
