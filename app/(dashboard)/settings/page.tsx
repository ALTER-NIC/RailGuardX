"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/lib/stripe/plans";
import { CheckCircle } from "lucide-react";

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string | null;
}

export default function SettingsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => setSubscription(d.subscription));
  }, []);

  const handleUpgrade = async (plan: string) => {
    setLoading(true);
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  };

  const handleManageBilling = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  };

  const currentPlan = subscription?.plan || "free";

  return (
    <div>
      <Header title="Settings" description="Manage your plan and billing" />
      <div className="p-8 space-y-8 max-w-4xl">
        {/* Current plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold capitalize">{currentPlan}</span>
                <Badge variant={subscription?.status === "active" ? "success" : "secondary"}>
                  {subscription?.status || "active"}
                </Badge>
              </div>
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground mt-1">
                  Renews {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            {currentPlan !== "free" && (
              <Button variant="outline" onClick={handleManageBilling} disabled={loading}>
                Manage Billing
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Plan cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Upgrade Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["starter", "pro", "agency"] as const).map((plan) => {
              const config = PLANS[plan];
              const isCurrent = currentPlan === plan;
              const isHigher = ["free", "starter", "pro"].indexOf(currentPlan) < ["starter", "pro", "agency"].indexOf(plan);

              return (
                <Card key={plan} className={isCurrent ? "border-primary ring-2 ring-primary ring-offset-2" : ""}>
                  <CardHeader>
                    {isCurrent && <Badge className="w-fit mb-2">Current plan</Badge>}
                    <CardTitle className="text-base">{config.name}</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-bold text-foreground">${config.price}</span>/mo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {config.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || loading || !isHigher}
                      onClick={() => !isCurrent && handleUpgrade(plan)}
                    >
                      {isCurrent ? "Current plan" : `Upgrade to ${config.name}`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
