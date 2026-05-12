# RailGuardX — Complete Setup & Launch Guide

---

## WHAT WAS FIXED IN THIS BUILD

| File | What changed |
|---|---|
| `lib/stripe/plans.ts` | Pricing corrected: Pro=$149, Agency=$499 |
| `lib/policy-engine/evaluate.ts` | Now FAILS CLOSED — if judge errors, request is blocked (not passed) |
| `lib/policy-engine/forward.ts` | Full streaming support for all 9 providers |
| `app/api/guard/route.ts` | Streaming mode, audit log always awaited, cleaner quota check |
| `app/(dashboard)/onboarding/page.tsx` | Goes straight to dashboard (no confusing path choice) |
| `supabase/migrations/003_performance.sql` | Composite indexes for quota query speed |
| `app/page.tsx` | Pricing copy aligned with plans.ts |

---

## STEP 1 — Supabase: Run Migrations

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Click **New query**
3. Paste the contents of `supabase/migrations/001_initial.sql` → click **Run**
4. New query → paste `supabase/migrations/002_organizations.sql` → **Run**
5. New query → paste `supabase/migrations/003_performance.sql` → **Run**

**Then disable email confirmation** (so signups work immediately):
- Dashboard → **Authentication** → **Providers** → **Email**
- Toggle OFF **"Confirm email"**
- Click Save

> You can re-enable this later once you add a transactional email service (Resend.com, $0 to start).

---

## STEP 2 — Stripe: Create Live Prices

Your current Stripe price IDs are TEST MODE at wrong amounts. Before going live, create production prices.

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Make sure you are in LIVE mode** (toggle top-left)
3. Go to **Products** → **Add product** for each:

| Plan | Price | Billing |
|---|---|---|
| Starter | $49.00 | Monthly recurring |
| Pro | $149.00 | Monthly recurring |
| Agency | $499.00 | Monthly recurring |

4. After creating each product, copy the **Price ID** (starts with `price_`)
5. Update `.env.local`:
```
STRIPE_PRICE_STARTER=price_REAL_STARTER_ID
STRIPE_PRICE_PRO=price_REAL_PRO_ID
STRIPE_PRICE_AGENCY=price_REAL_AGENCY_ID
```

---

## STEP 3 — Update .env.local

Fix the app URL (critical for Stripe redirects and invite links):
```
NEXT_PUBLIC_APP_URL=https://railguardx.com
```

Remove placeholder team/business price IDs (not used):
```
# Delete these two lines:
# STRIPE_PRICE_TEAM=price_placeholder_team
# STRIPE_PRICE_BUSINESS=price_placeholder_business
```

Full `.env.local` should look like:
```
NEXT_PUBLIC_SUPABASE_URL=https://qijkdjrkrdweqikksgzw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_PROJECT_ID=qijkdjrkrdweqikksgzw

STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
STRIPE_PRICE_STARTER=price_REAL_STARTER_ID
STRIPE_PRICE_PRO=price_REAL_PRO_ID
STRIPE_PRICE_AGENCY=price_REAL_AGENCY_ID

GROQ_API_KEY=gsk_your_groq_key
POLICY_ENGINE_PROVIDER=groq
POLICY_ENGINE_MODEL=llama-3.1-8b-instant

NEXT_PUBLIC_APP_URL=https://railguardx.com
```

---

## STEP 4 — Deploy to Vercel

1. Push your code to GitHub (create a private repo at github.com)
   ```
   cd "d:\AI SAAS"
   git init
   git add .
   git commit -m "Initial production build"
   git remote add origin https://github.com/YOUR_USERNAME/railguardx.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo

3. In Vercel project settings → **Environment Variables** → add every variable from your `.env.local`

4. Deploy. Vercel auto-detects Next.js — no config needed.

5. In Vercel project settings → **Domains** → add `railguardx.com`
   - Follow their instructions to point your domain's DNS to Vercel (add an A record or CNAME)

---

## STEP 5 — Stripe Webhook for Production

1. Go to Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**
2. URL: `https://railguardx.com/api/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** (starts with `whsec_`)
5. Update `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
6. Redeploy (Vercel → your project → Deployments → Redeploy)

---

## STEP 6 — Verify Everything Works

Test this sequence end to end:

### A. Signup flow
- Go to `https://railguardx.com/signup`
- Create an account
- Should redirect to `/dashboard` (not `/onboarding`)

### B. Create a project + API key
- Dashboard → **API Keys** → create a project → generate key
- Copy the key (starts with `rgx_live_`)

### C. Test the guard API
```bash
curl -X POST https://railguardx.com/api/guard \
  -H "Authorization: Bearer rgx_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello, how are you?"}],
    "provider": "groq",
    "model": "llama-3.1-8b-instant"
  }'
```
Expected: 200 with AI response + `railguardx` field showing action: "allowed"

### D. Test streaming
```bash
curl -X POST https://railguardx.com/api/guard \
  -H "Authorization: Bearer rgx_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Tell me a joke"}],
    "provider": "groq",
    "model": "llama-3.1-8b-instant",
    "stream": true
  }'
```
Expected: SSE stream of `data: {...}` chunks

### E. Test policy blocking
- Dashboard → **Policies** → create policy:
  - Name: "No profanity"
  - Rule: "Block any message containing profanity or offensive language"
  - Applies to: Input
  - Severity: Block
  - Enable it
```bash
curl -X POST https://railguardx.com/api/guard \
  -H "Authorization: Bearer rgx_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "You stupid piece of crap"}],
    "provider": "groq"
  }'
```
Expected: 403 with `error: "Request blocked by guardrail policy"`

### F. Test Stripe checkout
- Dashboard → **Settings** → click Upgrade to Starter
- Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
- Should redirect back to settings showing Starter plan

---

## STEP 7 — Founding Member Offer (First Sales)

Before you launch publicly, add this to the pricing section of your landing page:

> **Founding Member Deal** — First 20 customers get Starter for **$29/mo locked forever** (normally $49).

This creates urgency and rewards early adopters. Update `app/page.tsx` to add a banner.
The 20 spots create FOMO. When they're gone, they're gone.

---

## HOW THE GUARD API WORKS (for your docs/README)

Developers use RailGuardX by changing one line in their code:

**Before:**
```javascript
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: userMessage }]
});
```

**After (with RailGuardX):**
```javascript
const response = await fetch("https://railguardx.com/api/guard", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rgx_live_YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    provider: "openai",
    model: "gpt-4o",
    messages: [{ role: "user", content: userMessage }]
  })
});
```

That's the pitch. One URL change. Instant guardrails.

---

## QUICK REFERENCE — All Supported Providers

| Provider | Value | Notes |
|---|---|---|
| OpenAI | `"openai"` | Needs `OPENAI_API_KEY` |
| Anthropic | `"anthropic"` | Needs `ANTHROPIC_API_KEY` |
| Google Gemini | `"gemini"` | Needs `GOOGLE_AI_API_KEY` |
| Groq | `"groq"` | Needs `GROQ_API_KEY` (set, working) |
| Mistral | `"mistral"` | Needs `MISTRAL_API_KEY` |
| Together AI | `"together"` | Needs `TOGETHER_API_KEY` |
| Perplexity | `"perplexity"` | Needs `PERPLEXITY_API_KEY` |
| xAI (Grok) | `"xai"` | Needs `XAI_API_KEY` |
| Cohere | `"cohere"` | Needs `COHERE_API_KEY` |

Only set the keys for providers you want to support. Groq is the default and is already working.

---

## WHEN THINGS BREAK

| Problem | Fix |
|---|---|
| Signup redirects to login | Run migration 001 in Supabase SQL editor |
| Stripe checkout 500 error | Check `STRIPE_SECRET_KEY` is live mode key, not test |
| Guard API returns 401 | API key not created or wrong format (must start with `rgx_live_`) |
| Policy not blocking | Make sure policy is toggled ON and `applies_to` matches input/output |
| Stripe webhook not firing | Verify webhook URL in Stripe dashboard matches your Vercel domain |
| DB connection error | Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars |
