import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";

/**
 * Stripe client, lazily constructed.
 *
 * Building the site must not require live keys — only the checkout and
 * webhook routes call this, and they surface a clean 503 when it is missing
 * rather than crashing the server.
 */

let client: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured. Set STRIPE_SECRET_KEY.");
    this.name = "StripeNotConfiguredError";
  }
}

export function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) throw new StripeNotConfiguredError();

  client ??= new Stripe(STRIPE_SECRET_KEY, {
    // Pin the version so a Stripe-side upgrade can't change behaviour under us.
    apiVersion: "2026-08-26.dahlia",
    appInfo: { name: "Pharmasolutions" },
  });

  return client;
}

export const isStripeConfigured = () => Boolean(STRIPE_SECRET_KEY);
