import { z } from "zod";

/**
 * Shared helpers for API routes — consistent JSON shapes so client code can
 * handle every endpoint the same way.
 */

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });

export const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  json({ ok: false, message, ...extra }, status);

/**
 * Parses a form-encoded or JSON request body against a schema.
 *
 * Returns a discriminated result rather than throwing, so routes stay linear
 * and always emit a shaped error.
 */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<{ success: true; data: z.infer<S> } | { success: false; response: Response }> {
  let raw: unknown;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    raw = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return { success: false, response: fail("Could not read request body.", 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Surface the first field message — enough for a form, no schema leak.
    const { fieldErrors } = z.flattenError(parsed.error);
    const first = Object.values(fieldErrors).flat()[0] ?? "Invalid submission.";
    return { success: false, response: fail(String(first), 422, { errors: fieldErrors }) };
  }

  return { success: true, data: parsed.data };
}
