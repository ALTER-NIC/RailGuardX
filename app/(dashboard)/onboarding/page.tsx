"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";

// Onboarding goes straight to the developer dashboard.
// The team workspace feature is available from the dashboard sidebar once a user creates an org.
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
        <Zap className="h-5 w-5 text-white" />
      </div>
      <p className="text-sm text-zinc-400 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Setting up your account…
      </p>
    </div>
  );
}
