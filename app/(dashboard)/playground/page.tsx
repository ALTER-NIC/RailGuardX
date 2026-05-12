"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, ShieldCheck, ShieldX, AlertTriangle, Zap, Clock } from "lucide-react";

interface Project { id: string; name: string; }
interface ApiKey { id: string; name: string; key_prefix: string; }

interface GuardResult {
  action: "allowed" | "blocked" | "warned";
  content?: string;
  error?: string;
  reason?: string;
  violations?: Array<{ policy: string; reason: string }>;
  latency_ms?: number;
}

const PROVIDERS = [
  { value: "groq", label: "Groq", models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"] },
  { value: "openai", label: "OpenAI", models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-haiku-4-5", "claude-sonnet-4-5"] },
  { value: "gemini", label: "Gemini", models: ["gemini-2.0-flash-lite", "gemini-1.5-pro"] },
  { value: "mistral", label: "Mistral", models: ["mistral-small-latest", "mistral-large-latest"] },
];

export default function PlaygroundPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("llama-3.1-8b-instant");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GuardResult | null>(null);
  const [history, setHistory] = useState<Array<{ message: string; result: GuardResult }>>([]);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : (data.projects ?? []);
      setProjects(list);
      if (list.length > 0) setSelectedProject(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    fetch(`/api/api-keys?project_id=${selectedProject}`).then(r => r.json()).then(data => {
      setApiKeys(data);
      setSelectedKey(data[0]?.id || "");
    });
  }, [selectedProject]);

  const selectedProviderObj = PROVIDERS.find(p => p.value === provider);

  async function handleSend() {
    if (!message.trim() || !rawKey.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/guard", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${rawKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: message }],
          provider,
          model,
        }),
      });

      const data = await res.json();

      let r: GuardResult;
      if (res.ok) {
        r = {
          action: data.railguardx?.action || "allowed",
          content: data.choices?.[0]?.message?.content || data.content || JSON.stringify(data),
          latency_ms: data.railguardx?.latency_ms,
          violations: data.railguardx?.violations > 0 ? [] : [],
        };
      } else {
        r = {
          action: res.status === 403 ? "blocked" : "allowed",
          error: data.error,
          reason: data.reason,
          violations: data.violations || [],
          latency_ms: undefined,
        };
      }

      setResult(r);
      setHistory(prev => [{ message, result: r }, ...prev.slice(0, 9)]);
    } catch {
      setResult({ action: "allowed", error: "Network error — is the server running?" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Playground" description="Test your guardrails in real time" />
      <div className="flex-1 p-6 space-y-6 max-w-5xl">

        {/* Config row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-medium text-muted-foreground">API Key (paste your rgx_live_... key)</label>
            <input
              type="password"
              placeholder="rgx_live_..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              value={rawKey}
              onChange={e => setRawKey(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={provider}
              onChange={e => {
                setProvider(e.target.value);
                const p = PROVIDERS.find(x => x.value === e.target.value);
                if (p) setModel(p.models[0]);
              }}
            >
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={model}
            onChange={e => setModel(e.target.value)}
          >
            {selectedProviderObj?.models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Message</label>
          <textarea
            rows={4}
            placeholder="Type a message to test your guardrails..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleSend(); }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Cmd+Enter to send</p>
            <Button onClick={handleSend} disabled={loading || !message.trim() || !rawKey.trim()}>
              {loading ? (
                <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Checking...</span>
              ) : (
                <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Send</span>
              )}
            </Button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <Card className={
            result.action === "blocked"
              ? "border-destructive/50 bg-destructive/5"
              : result.action === "warned"
              ? "border-yellow-500/50 bg-yellow-500/5"
              : "border-green-500/50 bg-green-500/5"
          }>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.action === "blocked" ? (
                    <ShieldX className="h-5 w-5 text-destructive" />
                  ) : result.action === "warned" ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  )}
                  <CardTitle className="text-base">
                    {result.action === "blocked" ? "Blocked by guardrail" : result.action === "warned" ? "Warning flagged" : "Allowed"}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {result.latency_ms && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{result.latency_ms}ms
                    </Badge>
                  )}
                  <Badge variant={result.action === "blocked" ? "destructive" : result.action === "warned" ? "outline" : "secondary"}>
                    {result.action.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.violations && result.violations.length > 0 && (
                <div className="space-y-1">
                  {result.violations.map((v, i) => (
                    <div key={i} className="rounded-md bg-destructive/10 px-3 py-2 text-sm">
                      <span className="font-medium">{v.policy}:</span> {v.reason}
                    </div>
                  ))}
                </div>
              )}
              {result.reason && !result.violations?.length && (
                <p className="text-sm text-muted-foreground">{result.reason}</p>
              )}
              {result.content && (
                <div className="rounded-md bg-muted/50 px-3 py-3 text-sm whitespace-pre-wrap">
                  {result.content}
                </div>
              )}
              {result.error && !result.content && !result.violations?.length && (
                <p className="text-sm text-destructive">{result.error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* History */}
        {history.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent tests</p>
            {history.slice(1).map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50" onClick={() => setMessage(h.message)}>
                {h.result.action === "blocked" ? <ShieldX className="h-4 w-4 text-destructive shrink-0" /> : <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />}
                <span className="truncate text-muted-foreground">{h.message}</span>
                <Badge variant={h.result.action === "blocked" ? "destructive" : "secondary"} className="ml-auto shrink-0">{h.result.action}</Badge>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
