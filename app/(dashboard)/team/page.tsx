"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UserPlus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Crown,
  User,
  Clock,
  ExternalLink,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Member {
  id: string;
  email: string;
  role: "admin" | "member";
  joined_at: string;
  is_you: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

interface Org {
  id: string;
  name: string;
  org_slug: string;
  llm_provider: string;
  llm_model: string;
}

export default function TeamPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [viewerRole, setViewerRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  // LLM config state
  const [llmProvider, setLlmProvider] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [savingLlm, setSavingLlm] = useState(false);
  const [llmSaved, setLlmSaved] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [orgRes, membersRes] = await Promise.all([
      fetch("/api/org"),
      fetch("/api/org/members"),
    ]);
    const orgData = await orgRes.json();
    const membersData = await membersRes.json();

    if (orgData.org) {
      setOrg(orgData.org);
      setLlmProvider(orgData.org.llm_provider);
      setLlmModel(orgData.org.llm_model);
    }
    setMembers(membersData.members || []);
    setInvites(membersData.invites || []);
    setViewerRole(membersData.viewer_role || "");
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    setInviteLink("");

    const res = await fetch("/api/org/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    setInviting(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setInviteLink(data.inviteUrl);
    setInviteEmail("");
    loadData();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    const res = await fetch(`/api/org/members?member_id=${memberId}`, { method: "DELETE" });
    if (res.ok) loadData();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const res = await fetch(`/api/org/invite?id=${inviteId}`, { method: "DELETE" });
    if (res.ok) loadData();
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "member") => {
    const res = await fetch("/api/org/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, role: newRole }),
    });
    if (res.ok) loadData();
  };

  const handleSaveLlm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLlm(true);
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm_provider: llmProvider, llm_model: llmModel }),
    });
    setSavingLlm(false);
    if (res.ok) {
      setLlmSaved(true);
      setTimeout(() => setLlmSaved(false), 2000);
      loadData();
    }
  };

  const isAdmin = viewerRole === "admin";

  if (loading) {
    return (
      <div>
        <Header title="Team" description="Manage your workspace members" />
        <div className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Team" description={org ? `${org.name} workspace` : "Manage your workspace"} />
      <div className="p-8 space-y-8 max-w-4xl">

        {/* Go to AI Chat */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-semibold">Employee AI Workspace</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Share this link with employees so they can access the secure AI chat.
              </p>
            </div>
            <Link href="/chat">
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Chat
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Members list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members ({members.length})</CardTitle>
            <CardDescription>
              All members can access the AI workspace. Admins can manage policies and team settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {member.email[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {member.email}
                      {member.is_you && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.role === "admin" ? (
                    <Badge variant="secondary" className="gap-1">
                      <Crown className="h-3 w-3" /> Admin
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <User className="h-3 w-3" /> Member
                    </Badge>
                  )}

                  {isAdmin && !member.is_you && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() =>
                          handleChangeRole(member.id, member.role === "admin" ? "member" : "admin")
                        }
                      >
                        Make {member.role === "admin" ? "member" : "admin"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending invites */}
        {invites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Invites ({invites.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })} ·{" "}
                      {invite.role}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleRevokeInvite(invite.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Invite form (admin only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Invite a team member
              </CardTitle>
              <CardDescription>
                Generate an invite link to share with your employee. No email setup required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="inviteEmail">Email address</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      placeholder="employee@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inviteRole">Role</Label>
                    <select
                      id="inviteRole"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" disabled={inviting} className="gap-2">
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Generate invite link
                </Button>
              </form>

              {/* Invite link result */}
              {inviteLink && (
                <div className="mt-4 rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-medium">Invite link ready — copy and share it:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background border rounded px-3 py-2 truncate">
                      {inviteLink}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="gap-1.5 shrink-0"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Link expires in 7 days. The employee will be prompted to sign up or log in.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI config (admin only) */}
        {isAdmin && org && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                AI Configuration
              </CardTitle>
              <CardDescription>
                Choose which AI model your employees will use in the workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveLlm} className="flex gap-3 items-end">
                <div className="space-y-2">
                  <Label htmlFor="llmProvider">Provider</Label>
                  <select
                    id="llmProvider"
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="mistral">Mistral</option>
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="llmModel">Model</Label>
                  <Input
                    id="llmModel"
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                </div>
                <Button type="submit" disabled={savingLlm} className="gap-2">
                  {savingLlm ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : llmSaved ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                  {llmSaved ? "Saved!" : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
