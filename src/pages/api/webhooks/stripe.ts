import type { APIRoute } from "astro";
import { STRIPE_WEBHOOK_SECRET } from "astro:env/server";
import { getStripe, isStripeConfigured } from "../../../lib/stripe";
import { ok, fail } from "../../../lib/api";

export const prerender = false;

/**
 * Stripe webhook receiver.
 *
 * Signature verification is mandatory — this endpoint is public, and the
 * raw body must be read as text (not parsed) for the signature to check out.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isStripeConfigured() || !STRIPE_WEBHOOK_SECRET) {
    return fail("Webhooks are not configured.", 503);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return fail("Missing signature.", 400);

  const payload = await request.text();

  let event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.warn("[stripe-webhook] signature verification failed", error);
    return fail("Invalid signature.", 400);
  }

  switch (event.type) {
    case "checkout.session.completed":
      // TODO: grant program access and send the welcome email.
      // Must be idempotent — Stripe retries, and duplicates are expected.
      console.info("[stripe-webhook] checkout completed", event.data.object.id);
      break;

    case "invoice.payment_failed":
      // TODO: notify the learner that their payment needs attention.
      console.info("[stripe-webhook] payment failed", event.data.object.id);
      break;

    default:
      // Acknowledge unhandled events so Stripe stops retrying them.
      break;
  }

  return ok();
};
