import Link from "next/link";
import { ArrowRight, ShieldCheck, ScrollText, Zap, Key, CheckCircle, ChevronRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* Background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-violet-700/10 rounded-full blur-[120px]" />
        <div className="absolute top-[60%] -left-40 w-[500px] h-[500px] bg-blue-700/8 rounded-full blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 border-b border-white/5">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-white tracking-tight">RailGuardX</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              Start free <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
          EU AI Act & SOC 2 compliance ready
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 max-w-4xl mx-auto">
          AI guardrails for{" "}
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            any model, any team
          </span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          RailGuardX sits between your app and any LLM — enforcing custom policies,
          blocking bad outputs, and logging every event. Ship AI faster, stay compliant.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#features"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
          >
            See how it works
          </Link>
        </div>

        {/* Social proof strip */}
        <div className="flex items-center justify-center gap-6 mt-14 text-xs text-zinc-600">
          <span>No credit card required</span>
          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
          <span>1,000 free requests/month</span>
          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
          <span>Works with OpenAI, Claude, Gemini</span>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="relative z-10 border-t border-white/5 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Everything to ship AI safely</h2>
            <p className="text-zinc-400 max-w-lg mx-auto">
              One integration. Any model. Real-time enforcement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: ShieldCheck,
                title: "Plain-English Policies",
                description: "Write rules in plain English. Our LLM-as-judge enforces them semantically — no regex, no keyword lists.",
                color: "text-violet-400",
                bg: "bg-violet-500/10",
              },
              {
                icon: ScrollText,
                title: "Immutable Audit Logs",
                description: "Every request logged. Exportable for EU AI Act, SOC 2, and HIPAA reporting at any time.",
                color: "text-blue-400",
                bg: "bg-blue-500/10",
              },
              {
                icon: Zap,
                title: "Parallel Evaluation",
                description: "Policies run in parallel, never in your critical path. Designed for sub-100ms production environments.",
                color: "text-amber-400",
                bg: "bg-amber-500/10",
              },
              {
                icon: Key,
                title: "Model Agnostic",
                description: "Claude, GPT-4o, Gemini, Mistral, Groq — one integration protects all of them uniformly.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
              },
            ].map(({ icon: Icon, title, description, color, bg }) => (
              <div
                key={title}
                className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} mb-4`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two products section */}
      <section className="relative z-10 border-t border-white/5 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Two products, one platform</h2>
            <p className="text-zinc-400 max-w-lg mx-auto">
              Whether you're a developer building AI apps or a company giving employees AI access, we've got you covered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Developer API */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 mb-6">
                <Key className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Developer API</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Swap your LLM base URL for ours. Your app instantly gains policy enforcement, output filtering, and compliance logging with zero architecture changes.
              </p>
              <ul className="space-y-2.5">
                {["Custom policy engine", "Real-time audit logs", "Multi-model support", "SDK for JS/TS"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <CheckCircle className="h-4 w-4 text-violet-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Team Workspace */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 mb-6">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Team Workspace</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Give your whole team governed AI access. Invite employees via link — they get a clean chat interface, you control what they can and can't ask.
              </p>
              <ul className="space-y-2.5">
                {["Invite employees by link", "Per-org AI policies", "Admin audit dashboard", "No employee API keys needed"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 border-t border-white/5 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Pricing</h2>
            <p className="text-zinc-400">Start free. Upgrade as you grow.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              {
                plan: "Free",
                price: "$0",
                sub: "forever",
                features: ["1 project", "5 policies", "1,000 requests/mo", "7-day log retention"],
                cta: "Start free",
                highlight: false,
              },
              {
                plan: "Starter",
                price: "$49",
                sub: "per month",
                features: ["3 projects", "20 policies", "50K requests/mo", "30-day retention"],
                cta: "Get started",
                highlight: false,
              },
              {
                plan: "Pro",
                price: "$149",
                sub: "per month",
                features: ["10 projects", "Unlimited policies", "500K requests/mo", "Compliance exports (EU AI Act, SOC 2)"],
                cta: "Go pro",
                highlight: true,
              },
              {
                plan: "Agency",
                price: "$499",
                sub: "per month",
                features: ["Unlimited everything", "Multi-client dashboard", "1yr log retention", "Priority support"],
                cta: "Contact sales",
                highlight: false,
              },
            ].map(({ plan, price, sub, features, cta, highlight }) => (
              <div
                key={plan}
                className={`relative rounded-2xl p-6 border ${
                  highlight
                    ? "bg-violet-600/10 border-violet-500/40"
                    : "bg-zinc-900/60 border-white/5"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}
                <h3 className="font-semibold text-white mb-1">{plan}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">{price}</span>
                </div>
                <p className="text-xs text-zinc-500 mb-5">{sub}</p>
                <ul className="space-y-2 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block w-full text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                    highlight
                      ? "bg-violet-600 hover:bg-violet-500 text-white"
                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 border-t border-white/5 py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Ready to ship AI responsibly?
          </h2>
          <p className="text-zinc-400 mb-8">
            Join developers and teams using RailGuardX to govern their AI. Free to start, no credit card needed.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-8 py-3.5 rounded-xl transition-colors"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-600/80">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span>RailGuardX</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
            <Link href="mailto:support@railguardx.ai" className="hover:text-zinc-400 transition-colors">Support</Link>
          </div>
          <span>© 2026 RailGuardX</span>
        </div>
      </footer>
    </div>
  );
}
