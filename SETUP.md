# RailGuardX — Setup Guide

## 1. Install dependencies
```bash
npm install
```

## 2. Configure environment variables
```bash
cp .env.example .env.local
```
Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY` — create these in Stripe Dashboard
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for the policy engine judge
- `POLICY_ENGINE_PROVIDER` — `openai` or `anthropic`
- `POLICY_ENGINE_MODEL` — `gpt-4o-mini` (recommended for cost) or `claude-haiku-4-5`

## 3. Set up Supabase
1. Create a new project at supabase.com
2. Go to SQL Editor and run the contents of `supabase/migrations/001_initial.sql`
3. Enable Email Auth under Authentication → Providers

## 4. Set up Stripe
1. Create products + prices in Stripe Dashboard for Starter ($49), Pro ($149), Agency ($499)
2. Add a webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`
3. Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

## 5. Run locally
```bash
npm run dev
```
Open http://localhost:3000

## 6. Deploy
Deploy to Vercel:
```bash
npx vercel --prod
```
Set all env vars in Vercel dashboard → Settings → Environment Variables.

## Architecture

```
User's App
    ↓
POST /api/guard  (Bearer rgx_live_...)
    ↓
Auth (hash API key → look up project)
    ↓
Load policies for project
    ↓
Evaluate INPUT against policies (LLM-as-judge, parallel)
    ↓
If blocked → 403 + log
    ↓
Forward to LLM (OpenAI / Anthropic / Gemini)
    ↓
Evaluate OUTPUT against policies
    ↓
Log audit event (async, non-blocking)
    ↓
Return response in OpenAI-compatible format
```

## SDK Usage
See `sdk/README.md` for integration instructions.
The npm package is in `sdk/` — publish it with `cd sdk && npm publish`.
