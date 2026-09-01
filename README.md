# Pharmasolutions

Marketing and enrolment site for the Pharmasolutions pharmacology coaching program.

Built with **Astro 7** (static-first, server routes where needed), **Tailwind v4**, and
**Stripe Checkout**.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Copy `.env.example` to `.env` before touching checkout — the marketing pages build
without any keys.

| Command         | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Dev server on http://localhost:4321           |
| `npm run build` | Production build to `dist/`                   |
| `npm run preview` | Serve the built output                      |
| `npm run check` | Astro + TypeScript diagnostics                |

## Architecture

### Rendering

`output: "static"` — every marketing page prerenders to HTML. Routes needing a
server opt in individually with `export const prerender = false`; today that's only
`src/pages/api/**`. The Node adapter is a one-line swap for Vercel/Netlify/Cloudflare
if the deploy target changes.

### The design system

The site's visual language is *illustrated editorial*: full-bleed painted bands
stacked vertically, content floating over the artwork, a warm sky-to-field palette,
and a display serif for every heading.

Three pieces carry that:

- **`src/styles/global.css`** — all design tokens in one `@theme` block. Raw colour
  ramps (`sky`, `ridge`, `field`, `clay`, `cream`, `ink`) plus semantic aliases
  (`surface`, `content`, `brand`, `accent`) that components actually reference.
  Re-theming means editing the alias block only. Never hardcode a hex in a component.
- **`src/components/scene/Scene.astro`** — one full-bleed illustrated band. Owns the
  ground colour, height, grain overlay, and content plane.
- **`src/components/scene/SceneLayer.astro`** — one painted plane inside a Scene.
  Handles depth stacking and parallax drift (distant layers move less). A single
  shared rAF loop drives every layer on the page; it no-ops under reduced-motion.

Fonts are self-hosted and subsetted at build time by Astro's Fonts API (`fonts` in
`astro.config.mjs`), exposed to CSS as `--font-fraunces` / `--font-inter`. No
third-party request, no layout shift.

### Content

Everything repeatable lives in `src/content/` as typed collections
(`src/content.config.ts`): `blog`, `curriculum`, `coaches`, `testimonials`, `faq`,
and `plans`. Swapping to a headless CMS later means changing the loader, not the
components.

`plans` holds the Stripe price ids. The displayed price is presentational — Stripe
remains the source of truth for what is actually charged.

### Server routes

| Route                     | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `POST /api/newsletter`    | Footer email capture                               |
| `POST /api/enrol`         | Enrolment application                              |
| `POST /api/checkout`      | Creates a Stripe Checkout session                  |
| `POST /api/webhooks/stripe` | Signature-verified Stripe events                 |

All of them parse input through a Zod schema in `src/lib/validation.ts` and reply in
the shared `{ ok, message }` shape from `src/lib/api.ts`. Forms post normally without
JS and upgrade to `fetch` when it's available. Both public forms carry a honeypot.

`/api/checkout` validates the requested price against the `plans` collection before
calling Stripe, so a crafted request can't buy an arbitrary price off the account.
Access is granted from the **webhook**, never from the success page.

## Still to do

- Illustrations for the Scene layers (`src/assets/illustrations/`)
- Real copy throughout — the seed files in `src/content/` are placeholders
- The design pass itself: this scaffold sets up the structure, not the finished look
- Wire `/api/newsletter` and `/api/enrol` to a real provider
- Privacy policy and terms need writing and legal review
