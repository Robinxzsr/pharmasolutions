import { z } from "zod";

/**
 * Request schemas shared by the API routes.
 *
 * Every server route parses its input through one of these — never trust a
 * form body, even from our own pages.
 */

/** Anti-spam: a hidden field only a bot would populate. */
const honeypot = z.string().max(0, "Rejected.").optional();

export const newsletterSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  company: honeypot,
});

export const enrolSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.email("Enter a valid email address.").trim(),
  /** Free-text: "2nd year pharmacy", "F1 doctor", etc. */
  stage: z.string().trim().min(2, "Let us know your stage of study.").max(160),
  goals: z.string().trim().max(2000).optional(),
  planId: z.string().trim().optional(),
  /**
   * Checkboxes arrive as the string "on" from a form POST and as a boolean
   * from a JSON body — accept both, reject anything that means "unchecked".
   */
  consent: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v !== false, { message: "Please accept the privacy policy." }),
  company: honeypot,
});

export const checkoutSchema = z.object({
  /** Must match a `stripePriceId` in the `plans` collection. */
  priceId: z.string().trim().min(1),
  email: z.email().trim().optional(),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
export type EnrolInput = z.infer<typeof enrolSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
