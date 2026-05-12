"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Building2, Loader2, AlertCircle } from "lucide-react";

type JoinState = "loading" | "invalid" | "login" | "accepting" | "done";

interface InviteInfo {
  org_name: string;
  role: string;
  email: string;
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [state, setState] = useState<JoinState>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  // Login/signup form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Step 1: Validate the token
  useEffect(() => {
    if (!token) {
      setState("invalid");
      setErrorMsg("No invite token found in the URL.");
      return;
    }

    const validateToken = async () => {
      const res = await fetch(`/api/org/invite?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const data = await res.json();
        setState("invalid");
        setErrorMsg(data.error || "This invite link is invalid or has expired.");
        return;
      }
      const data = await res.json();
      setInvite(data);

      // Check if user is already logged in
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Accept immediately
        await acceptInvite(token);
      } else {
        setEmail(data.email || "");
        setState("login");
      }
    };

    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const acceptInvite = async (inviteToken: string) => {
    setState("accepting");
    const res = await fetch("/api/org/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: inviteToken }),
    });
    const data = await res.json();

    if (!res.ok && res.status !== 200) {
      setState("invalid");
      setErrorMsg(data.error || "Failed to join the workspace.");
      return;
    }

    setState("done");
    setTimeout(() => router.push("/chat"), 1500);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    let authError: string | null = null;

    if (isSignup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      authError = error?.message || null;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      authError = error?.message || null;
    }

    setAuthLoading(false);

    if (authError) {
      setAuthError(authError);
      return;
    }

    // Proceed to accept
    if (token) await acceptInvite(token);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-2 mb-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold">RailGuardX</span>
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Validating invite…</p>
        </div>
      )}

      {/* Invalid */}
      {state === "invalid" && (
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-semibold">Invalid invite</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Login/Signup */}
      {state === "login" && invite && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Join {invite.org_name}</CardTitle>
            <CardDescription>
              You've been invited as a <strong>{invite.role}</strong>.{" "}
              {isSignup ? "Create an account to continue." : "Sign in to accept."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="joinEmail">Email</Label>
                <Input
                  id="joinEmail"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinPassword">Password</Label>
                <Input
                  id="joinPassword"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {authError && <p className="text-sm text-destructive">{authError}</p>}

              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSignup ? "Create account & join" : "Sign in & join"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => { setIsSignup((s) => !s); setAuthError(""); }}
                className="text-primary underline"
              >
                {isSignup ? "Sign in" : "Sign up"}
              </button>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Accepting */}
      {state === "accepting" && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Joining workspace…</p>
        </div>
      )}

      {/* Done */}
      {state === "done" && (
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold">You've joined {invite?.org_name}!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Redirecting you to the AI workspace…
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
