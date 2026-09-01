import type { APIRoute } from "astro";
import { enrolSchema } from "../../lib/validation";
import { parseBody, ok } from "../../lib/api";

export const prerender = false;

/**
 * Enrolment enquiry handler.
 *
 * Captures the application and hands off. Payment is deliberately a separate
 * step (/api/checkout) so an enquiry is never lost because a card failed.
 */
export const POST: APIRoute = async ({ request }) => {
  const parsed = await parseBody(request, enrolSchema);
  if (!parsed.success) return parsed.response;

  const { company, ...application } = parsed.data;

  if (company) return ok();

  // TODO: persist the application and notify ENROL_NOTIFY_EMAIL.
  console.info("[enrol] application", application);

  return ok({ message: "Application received. We'll be in touch within two working days." });
};
