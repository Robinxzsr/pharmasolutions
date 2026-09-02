# pharmacology.solutions

Marketing and enrolment site for the pharmacology coaching program.

Built with **Astro 7** (static-first, server routes where needed), **Tailwind v4**,
**three.js** for the hero, and **Stripe Checkout**.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Copy `.env.example` to `.env` before touching checkout — everything else builds
without any keys.

| Command           | What it does                        |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Dev server on http://localhost:4321 |
| `npm run build`   | Production build to `dist/`         |
| `npm run preview` | Serve the built output              |
| `npm run check`   | Astro + TypeScript diagnostics      |

## Architecture

### Rendering

`output: "static"` — every marketing page prerenders to HTML. Routes needing a
server opt in individually with `export const prerender = false`; today that's only
`src/pages/api/**`. The Node adapter is a one-line swap for Vercel/Netlify/Cloudflare
if the deploy target changes.

### The design system

The visual language is *dark clinical*: black ground, violet emissive accent, ember
counter-light, pixel display faces, fully-rounded controls. The palette is sampled
from the hero's own three-point lighting rig so the 2D UI and the 3D scene sit in
the same light.

- **`src/styles/global.css`** — all design tokens in one `@theme` block. Raw ramps
  (`void`, `violet`, `ember`, `chalk`) plus semantic aliases (`surface`, `content`,
  `brand`, `accent`, `border`) that components actually reference. Re-theming means
  editing the alias block only. Never hardcode a hex in a component.
- **`src/components/ui/Section.astro`** — a page band: ground tone, vertical rhythm,
  and an optional violet wash that echoes the hero's bloom.
- **`glass`** utility — the frosted capsule used by the nav and any floating control.

**Typography.** `PP NeueBit` (display) and `PP Mondwest` (UI/body) are the brand
faces. NeueBit is the only true bold available — asking for bold Mondwest would
synthesise it, which smears a pixel typeface, so every bold thing uses NeueBit.
Long-form article copy uses **Inter** via the `prose-body` utility: the pixel faces
are display types and are punishing at paragraph length. Inter is only fetched on
pages that actually render prose.

> **Font licensing.** PP NeueBit and PP Mondwest are commercial Pangram Pangram
> faces. The `.woff2` files are committed in `src/assets/fonts/` and are served
> publicly at build time — this needs a paid web licence from Pangram Pangram before
> the site goes live. Swap `--font-display` / `--font-body` in `global.css` if you'd
> rather not licence them.

### The hero

`src/components/hero/` — a full-viewport three.js scene: a background plate, a lit
pill, and selective bloom.

How the reveal works: the CSS background paints the plate as soon as it decodes,
long before three.js is ready. The canvas later draws the same image with the same
cover-fit on top, so the handoff is invisible. Copy stays hidden until *both* assets
are ready and a frame has actually rendered, so the hero arrives as one deliberate
fade rather than text, then background, then pill. `renderer.compile()` front-loads
shader compilation so the first visible frame isn't the one that stalls. A 3s
timeout guarantees the copy shows even if WebGL fails or an asset hangs.

Bloom is selective: meshes on layer 1 glow, everything else is swapped to a black
material for the bloom pass and restored afterwards. Bloom renders at half
resolution — it's a blur, so nobody can tell, and it roughly halves the
post-processing cost.

Changes made when porting from the standalone prototype:

- three.js is an npm dependency in its own Rollup chunk, not a CDN importmap. It is
  only requested by the hero script, so no other page downloads it.
- `initPillScene()` returns a teardown, wired to `astro:before-swap`, so client-side
  navigation doesn't leak a rAF loop and a WebGL context per visit.
- The render loop pauses when the hero scrolls out of view or the tab is hidden. The
  prototype was a single non-scrolling page and could afford to render forever; a
  real site cannot.
- Reduced-motion is honoured — the scene still renders, it just holds a still frame
  instead of spinning and pulsing.
- The pill model is imported through Vite (`?url`), so it is content-hashed rather
  than served unversioned from `public/`.

The model is pre-centred and normalised at build time, which is why it spins on its
own axis with no runtime bounding-box maths.

### Content

Everything repeatable lives in `src/content/` as typed collections
(`src/content.config.ts`): `blog`, `curriculum`, `coaches`, `testimonials`, `faq`,
and `plans`. Swapping to a headless CMS later means changing the loader, not the
components.

`plans` holds the Stripe price ids. The displayed price is presentational — Stripe
remains the source of truth for what is actually charged.

### Server routes

| Route                       | Purpose                           |
| --------------------------- | --------------------------------- |
| `POST /api/newsletter`      | Footer email capture              |
| `POST /api/enrol`           | Enrolment application             |
| `POST /api/checkout`        | Creates a Stripe Checkout session |
| `POST /api/webhooks/stripe` | Signature-verified Stripe events  |

All of them parse input through a Zod schema in `src/lib/validation.ts` and reply in
the shared `{ ok, message }` shape from `src/lib/api.ts`. Forms post normally without
JS and upgrade to `fetch` when it's available. Both public forms carry a honeypot.

`/api/checkout` validates the requested price against the `plans` collection before
calling Stripe, so a crafted request can't buy an arbitrary price off the account.
Access is granted from the **webhook**, never from the success page.

## Still to do

- Real copy throughout — the seed files in `src/content/` are placeholders
- The design pass below the hero: those Sections are structural stubs
- Sort out the Pangram Pangram web licence (see above)
- Bring the pill model pipeline (`build_pill.mjs` + the raw scan) into the repo so
  the GLB is reproducible rather than a committed binary
- Wire `/api/newsletter` and `/api/enrol` to a real provider
- Privacy policy and terms need writing and legal review
- An `og-default.png` — the meta tags already point at it
