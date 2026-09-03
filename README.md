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

The visual language is a **printed object**: black ground, hard square boxes, flat
inks, pixel display faces. Nothing glows and nothing is rounded.

**Exactly three colours: black, white, and one blue (`#202CDE`).** There is no
fourth. The rule that keeps it to three is:

> **Blue is a fill. White is the lit state.**

Blue is never text on a dark ground — it is the thing text sits *on*. Anything that
wants to say "active", "focused" or "hovered" goes **white**, not pale blue. Text on
blue is white; text on white is black. (A pale blue tint used to exist to carry
accent text, because `#202CDE` is too dark to read on black — that tint was a fourth
colour in all but name, so the rule above replaced it.)

- **`src/styles/global.css`** — every token in one `@theme` block. Raw values
  (`void`, `blue`, `chalk`) plus semantic aliases (`surface`, `content`, `brand`,
  `border`, `border-lit`) that components reference. Re-theming means editing the
  alias block only. Never hardcode a hex in a component.
- **`flood`** utility — the card hover: the whole panel fills with brand ink and the
  cover art duotones blue beneath its halftone screen. A press can run a second
  solid plate; it cannot make a card glow.
- **`label`** utility — the one micro-label treatment (11px, uppercase, tracked) for
  tags, prices, statuses and metadata. Used everywhere, defined once.

---

## Changing the fonts

Fonts are wired in **two places**, and you almost always only need the second one.

**1. `astro.config.mjs` — which font FILES exist.** Each entry in the `fonts` array
registers a family and gives it a CSS variable name:

```js
{
  provider: fontProviders.local(),
  name: "PP Mondwest",
  cssVariable: "--font-mondwest",        // <- the handle you use later
  options: {
    variants: [
      { weight: 400, style: "normal", src: ["./src/assets/fonts/ppmondwest-regular.woff2"] },
      { weight: 700, style: "normal", src: ["./src/assets/fonts/ppmondwest-bold.woff2"] },
    ],
  },
  fallbacks: ["ui-monospace", "monospace"],
}
```

To add a new face: drop the `.woff2` in `src/assets/fonts/`, copy that block, change
`name`, `cssVariable` and `src`. For a Google font use `fontProviders.google()` and
list `weights` / `subsets` instead of `variants`. Then add one line to
`src/layouts/BaseLayout.astro` so the `@font-face` is emitted:

```astro
<Font cssVariable="--font-yourfamily" />   {/* add `preload` only for above-the-fold faces */}
```

**2. `src/styles/global.css` — which font is used WHERE.** This is the part to play
with. Three roles, three variables, near the top of the `@theme` block:

```css
--font-display: var(--font-neuebit);    /* headings h1–h4, buttons, card titles  */
--font-body:    var(--font-mondwest);   /* the site default: UI, labels, forms    */
--font-prose:   var(--font-editorial);  /* long-form reading + card descriptions  */
```

Point any of those at any registered family and the whole site follows. Swapping
`--font-prose` to `var(--font-mondwest)` puts articles in the pixel face; swapping
`--font-display` changes every heading and button at once. **You never need to touch
a component to change a font** — that's the whole point of the three roles.

Which role covers what:

| Role | Applied by | Covers |
|---|---|---|
| `--font-display` | the `h1,h2,h3,h4` base rule + `font-display` class | page titles, card titles, all button labels |
| `--font-body` | `font-family` on `html` + `font-body` class | everything not otherwise specified: nav, forms, labels, metadata |
| `--font-prose` | the `prose-body` utility + `font-prose` class | article body, page ledes, card descriptions |

To change **one section only**, put a `font-display` / `font-body` / `font-prose`
class on that element instead of editing the token — e.g. card descriptions carry
`font-prose` explicitly, which is why they read in the serif while the card title
next to them stays pixel.

Two gotchas:

- **Weights only exist if a file is registered for them.** `font-bold` on a family
  with no 700 file makes the browser fake it, which visibly smears a pixel face.
  Mondwest and Editorial New both have real 700s registered; check the config before
  reaching for a weight.
- **`prose-body` sets a font on a whole container**, so anything nested inside it
  inherits the serif. Forms rendered through `PageLayout` therefore declare
  `font-body` on their own root to opt back out.

> **Font licensing.** PP NeueBit, PP Mondwest and PP Editorial New are all
> commercial Pangram Pangram faces. The `.woff2` files are committed in
> `src/assets/fonts/` and served publicly at build time — this needs a paid web
> licence from Pangram Pangram before the site goes live. Swapping the three
> `--font-*` roles in `global.css` is the escape hatch.

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

### Hero load performance

The hero's assets used to load as a strict serial chain: the parser found the
hero script, the script pulled three.js, and only once three.js had parsed and
executed did GLTFLoader start fetching the model. Each fetch cost a full round
trip waiting on the one before it. Two things fix that.

**Preload hints.** `HeroPreload.astro` renders into BaseLayout's `head` slot
from the home page only, so pages without the hero don't pay for it. It hints
the plate (`as="image"`, high priority) and the model (`as="fetch"`, with
`crossorigin` to match GLTFLoader's CORS mode — a mismatched preload is
discarded and re-fetched). The `modulepreload` for three.js is injected at build
time by `integrations/module-preload.mjs`, because the chunk is content-hashed
and its filename only exists once Rollup has written the bundle.

Measured on the production build, all four critical assets now start together at
~188ms instead of chaining out to 381ms, and the model lands at 212ms instead of
378ms.

**Compression.** `integrations/precompress.mjs` writes `.br` and `.gz` siblings
for every compressible asset at build time — quality 11, which is affordable
once per build but not once per request. It matters most for the three.js chunk:
643 KB raw, 131 KB brotli.

> **Deployment note.** Static hosts and CDNs (Netlify, Vercel, Cloudflare) and
> web servers with `brotli_static` / `gzip_static` (nginx, Caddy) serve those
> files automatically. The `@astrojs/node` **standalone server does not** — it
> serves assets uncompressed. Behind a CDN or reverse proxy that is fine.
> Exposing the standalone server directly to the internet is the one deployment
> where the precompressed files go unused, and it needs a compressing proxy in
> front, or the adapter switched to `middleware` mode with a custom server.

### Content

Everything repeatable lives in `src/content/` as typed collections
(`src/content.config.ts`): `blog`, `curriculum`, `coaches`, `testimonials`, `faq`,
`plans`, and `protocols`. Swapping to a headless CMS later means changing the
loader, not the components.

`plans` holds the Stripe price ids. The displayed price is presentational — Stripe
remains the source of truth for what is actually charged.

### The Protocols shop front

`protocols` are standalone one-time-purchase guides, distinct from `plans` (the
coaching program's own tiers). `/protocols` renders them as a card grid; each card
is a single link through to `/protocols/<slug>`.

The two take **different payment paths**, which is easy to miss: `plans` go through
`/api/checkout` (server-validated against the collection, then Stripe Checkout),
while `protocols` bypass that entirely and link straight to a Stripe **Payment
Link** stored per-protocol as `checkoutUrl`. All three share one link today; the
schema already supports giving each its own.

Cards fall back to `CoverPlaceholder.astro` — an honest "art goes here" marker, not
a fake illustration — and swap to the real image automatically once a `cover` is
set on the entry, with no component change.

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

- Real copy throughout — the seed files in `src/content/` are placeholders, as are
  the protocol prices
- Cover art for the protocols (they currently render `CoverPlaceholder`)
- `/pricing` still has the two-`Section` layout problem `/protocols` had: stacked
  `py-24` on `py-24` making a large dead gap, plus a heading/grid container-width
  mismatch. Same fix — merge into one section at one width.
- Sort out the Pangram Pangram web licence (see above)
- Bring the pill model pipeline (`build_pill.mjs` + the raw scan) into the repo so
  the GLB is reproducible rather than a committed binary
- Wire `/api/newsletter` and `/api/enrol` to a real provider
- Privacy policy and terms need writing and legal review
- An `og-default.png` — the meta tags already point at it
