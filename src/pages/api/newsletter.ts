import type { APIRoute } from "astro";
import { newsletterSchema } from "../../lib/validation";
import { parseBody, ok } from "../../lib/api";

/** Server route — needs a request at runtime, so it can't prerender. */
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const parsed = await parseBody(request, newsletterSchema);
  if (!parsed.success) return parsed.response;

  const { email, company } = parsed.data;

  // Honeypot tripped: respond 200 so bots learn nothing, but do no work.
  if (company) return ok();

  // TODO: forward to the email provider (Buttondown / Resend / Mailchimp).
  // Kept as a single call site so swapping providers touches only this block.
  console.info("[newsletter] subscribe", email);

  return ok({ message: "You're on the list." });
};
