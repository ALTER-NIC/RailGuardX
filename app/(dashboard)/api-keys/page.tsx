"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Project { id: string; name: string; }
interface ApiKey { id: string; name: string; key_prefix: string; last_used_at: string | null; created_at: string; }

export default function ApiKeysPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects || []);
        if (d.projects?.length > 0) setSelectedProject(d.projects[0].id);
      });
  }, []);

  const loadKeys = useCallback(async () => {
    if (!selectedProject) return;
    const res = await fetch(`/api/api-keys?project_id=${selectedProject}`);
    const data = await res.json();
    setApiKeys(data.api_keys || []);
  }, [selectedProject]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName }),
    });
    const data = await res.json();
    setProjects((prev) => [data.project, ...prev]);
    setSelectedProject(data.project.id);
    setNewProjectName("");
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !selectedProject) return;
    setLoading(true);

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: selectedProject, name: newKeyName }),
    });
    const data = await res.json();
    setCreatedKey(data.api_key.full_key);
    setNewKeyName("");
    setShowKey(true);
    loadKeys();
    setLoading(false);
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
    loadKeys();
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Header title="API Keys" description="Manage projects and authentication keys for your AI apps" />
      <div className="p-8 space-y-8">
        {/* Create project */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects</CardTitle>
            <CardDescription>Each project represents one AI app. Policies and logs are scoped per project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={createProject} className="flex gap-3">
              <Input
                placeholder="New project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Create Project
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedProject === p.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* New key created alert */}
        {createdKey && (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-green-800 mb-2">
                API key created — copy it now. You won&apos;t see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white border px-3 py-2 text-sm font-mono break-all">
                  {showKey ? createdKey : "rgx_live_" + "•".repeat(40)}
                </code>
                <button onClick={() => setShowKey(!showKey)} className="p-2 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={() => copyToClipboard(createdKey)} className="p-2 text-muted-foreground hover:text-foreground">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              {copied && <p className="text-xs text-green-700 mt-1">Copied!</p>}
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreatedKey(null)}>
                Done
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create new key */}
        {selectedProject && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Keys</CardTitle>
              <CardDescription>Use these keys to authenticate requests from your app to RailGuardX.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={createKey} className="flex gap-3">
                <Input
                  placeholder="Key name (e.g. production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="max-w-xs"
                />
                <Button type="submit" size="sm" disabled={loading}>
                  <Plus className="h-4 w-4 mr-1" /> Generate Key
                </Button>
              </form>

              {/* Keys list */}
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No API keys yet.</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{key.name}</span>
                          <Badge variant="outline">
                            <code className="text-xs">{key.key_prefix}…</code>
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                          {key.last_used_at && ` · Last used ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}`}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteKey(key.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Integration guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integration</CardTitle>
            <CardDescription>Drop RailGuardX into any existing Node.js app in seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-zinc-950 text-zinc-100 p-5 text-sm font-mono space-y-1">
              <div className="text-zinc-500"># Install</div>
              <div>npm install railguardx</div>
              <div className="mt-3 text-zinc-500"># Usage</div>
              <div><span className="text-pink-400">import</span> <span className="text-yellow-300">RailGuardX</span> <span className="text-pink-400">from</span> <span className="text-green-400">&apos;railguardx&apos;</span>;</div>
              <div><span className="text-pink-400">const</span> <span className="text-yellow-300">guard</span> = <span className="text-pink-400">new</span> <span className="text-blue-400">RailGuardX</span>{"({ apiKey: 'rgx_live_...' })"}</div>
              <div><span className="text-pink-400">const</span> <span className="text-yellow-300">reply</span> = <span className="text-pink-400">await</span> <span className="text-yellow-300">guard</span>.chat{"({ provider: 'openai', model: 'gpt-4o', messages })"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
