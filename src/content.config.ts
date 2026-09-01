import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Content collections.
 *
 * All marketing copy that repeats or needs ordering lives here as files —
 * typed, version-controlled, and migratable to a CMS later by swapping the
 * loader without touching a single component.
 */

/** Long-form articles. MDX so posts can drop in illustrations and callouts. */
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      author: reference("coaches"),
      /** Wide illustration for the post header and OG card. */
      cover: image().optional(),
      coverAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

/** Program modules, rendered as the curriculum timeline. */
const curriculum = defineCollection({
  loader: glob({ base: "./src/content/curriculum", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** Controls display sequence — modules are inherently ordered. */
    order: z.number(),
    /** e.g. "2 weeks" */
    duration: z.string(),
    topics: z.array(z.string()).default([]),
  }),
});

/** Coaches. Referenced by blog posts and shown on the About page. */
const coaches = defineCollection({
  loader: glob({ base: "./src/content/coaches", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      credentials: z.string().optional(),
      portrait: image().optional(),
      order: z.number().default(0),
    }),
});

/** Social proof. Data-only, so `.json` keeps them terse. */
const testimonials = defineCollection({
  loader: glob({ base: "./src/content/testimonials", pattern: "**/*.json" }),
  schema: z.object({
    quote: z.string(),
    name: z.string(),
    role: z.string(),
    featured: z.boolean().default(false),
  }),
});

/** FAQ entries. Answers are markdown so they can carry links. */
const faq = defineCollection({
  loader: glob({ base: "./src/content/faq", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    question: z.string(),
    category: z.enum(["program", "pricing", "logistics"]).default("program"),
    order: z.number().default(0),
  }),
});

/**
 * Purchasable plans. Kept in content (not hardcoded in the pricing page) so
 * price changes are a one-file edit. `stripePriceId` is the join key to
 * Stripe — the amount here is display-only; Stripe remains the source of
 * truth for what is actually charged.
 */
const plans = defineCollection({
  loader: glob({ base: "./src/content/plans", pattern: "**/*.json" }),
  schema: z.object({
    name: z.string(),
    blurb: z.string(),
    priceDisplay: z.string(),
    interval: z.enum(["one-time", "month"]).default("one-time"),
    stripePriceId: z.string(),
    features: z.array(z.string()),
    highlighted: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { blog, curriculum, coaches, testimonials, faq, plans };
