export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceId: null as null,
    features: [
      "1 project",
      "5 policies",
      "1,000 requests/month",
      "7-day log retention",
      "Community support",
    ],
  },
  starter: {
    name: "Starter",
    price: 49,
    priceId: process.env.STRIPE_PRICE_STARTER as string | undefined,
    features: [
      "3 projects",
      "20 policies",
      "50,000 requests/month",
      "30-day log retention",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    price: 149,
    priceId: process.env.STRIPE_PRICE_PRO as string | undefined,
    features: [
      "10 projects",
      "Unlimited policies",
      "500,000 requests/month",
      "90-day log retention",
      "Compliance exports (EU AI Act, SOC 2)",
      "Priority email support",
    ],
  },
  agency: {
    name: "Agency",
    price: 499,
    priceId: process.env.STRIPE_PRICE_AGENCY as string | undefined,
    features: [
      "Unlimited projects",
      "Unlimited policies",
      "Unlimited requests",
      "1-year log retention",
      "Multi-client dashboard",
      "White-label reports",
      "Priority support + Slack",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;
