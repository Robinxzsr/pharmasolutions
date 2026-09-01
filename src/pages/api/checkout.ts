import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { checkoutSchema } from "../../lib/validation";
import { parseBody, json, fail } from "../../lib/api";
import { getStripe, isStripeConfigured } from "../../lib/stripe";

export const prerender = false;

/**
 * Creates a Stripe Checkout session and returns its URL.
 *
 * The requested price is validated against the `plans` collection first —
 * that stops a crafted request buying an arbitrary price from the account.
 */
export const POST: APIRoute = async ({ request, url }) => {
  if (!isStripeConfigured()) {
    return fail("Payments are not configured yet.", 503);
  }

  const parsed = await parseBody(request, checkoutSchema);
  if (!parsed.success) return parsed.response;

  const { priceId, email } = parsed.data;

  const plans = await getCollection("plans");
  const plan = plans.find((p) => p.data.stripePriceId === priceId);
  if (!plan) return fail("Unknown plan.", 404);

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: plan.data.interval === "month" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: new URL("/enrol/success?session_id={CHECKOUT_SESSION_ID}", url.origin).toString(),
      cancel_url: new URL("/pricing", url.origin).toString(),
      metadata: { planId: plan.id },
    });

    if (!session.url) return fail("Stripe did not return a checkout URL.", 502);

    return json({ ok: true, url: session.url });
  } catch (error) {
    // Never leak Stripe internals to the client.
    console.error("[checkout] session creation failed", error);
    return fail("Could not start checkout. Please try again.", 502);
  }
};
