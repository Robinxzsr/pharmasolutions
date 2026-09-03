# CLAUDE.md

Working notes for an agent picking this project up. `README.md` explains **what
the architecture is**; this file covers **the conventions to follow, the
invariants not to break, and the traps that have already cost time**.

Read both before changing anything in `src/components/layout/Header.astro`,
`src/components/hero/`, or `src/layouts/BaseLayout.astro` — those three carry
most of the non-obvious decisions.

---

## The project

`pharmacology.solutions` — marketing and enrolment site for a pharmacology
coaching program, plus a shop front selling individual protocol guides.

Astro 7 (static-first) · Tailwind v4 · three.js (hero only) · Stripe.
Node ≥ 22.12. Windows dev box; expect `LF will be replaced by CRLF` warnings
from git — they're noise, not a problem.

## Commands

```bash
npm run dev      # dev server on :4321
npm run build    # production build to dist/
npm run check    # astro check — keep this at 0 errors, 0 warnings
```

Prefer the **background dev server** so it survives across tasks:

```bash
npx astro dev --background --port 4321
```

Manage it with `astro dev status`, `astro dev logs`, `astro dev stop`.
`astro dev logs` is the only place content-collection errors surface — the
browser just renders an empty list (see Traps).

---

## Conventions

**Never hardcode a colour.** Every token lives in one `@theme` block in
`src/styles/global.css`. Components reference the *semantic aliases*
(`surface`, `content`, `brand`, `border`, `border-lit`), not the raw ramps
(`void`, `blue`, `chalk`). Re-theming should mean editing the alias block only.

**The palette is exactly three colours: black, white, and one blue** —
`#202CDE`, exposed as `--color-blue` and aliased to `brand`. There is no blue
ramp. There is no `blue-300`. Do not add one.

The rule that keeps it at three:

> **Blue is a fill. White is the lit state.**

Blue is never text on a dark ground — it is the thing text sits on. Anything
saying "active", "hovered" or "focused" goes **white**: nav links, focus
rings, the caret, lit borders (`--color-border-lit` is chalk). Text on blue
is white; text on white is black.

This replaced a pale `#8fa3ff` tint that existed to carry accent text,
because `#202CDE` on black is 2.5:1 and fails. That tint was a fourth colour
in all but name and it appeared in exactly the places a reader looks first
(nav, prices). If you hit the same contrast wall, the answer is white or a
blue *fill behind* white — never a new tint.

The dark ramp carries a faint blue cast on purpose, so the ground is the same
family as the accent rather than a neutral with a colour sitting on it.

**There are no glow tokens.** `--shadow-glow-sm` / `-lg` are deleted. A
blurred coloured bloom is the single most "modern SaaS" gesture in a UI and
this site is a print object. The only thing allowed to glow is the 3D pill in
the hero, because that is a rendered light source rather than a drawn effect.
Depth and state come from flat colour and rules.

**The hex values in `pill-scene.ts` are light sources, not palette entries.**
They are brighter than `#202CDE` and they are deliberately not tokens: a lamp
pointed at an object is not the ink you would print it in. Do not "fix" them
to the brand blue — it renders the pill an unlit navy lump.

**Three faces, three jobs.** `font-display` (PP NeueBit, pixel) for headlines
and control labels. `font-body` (PP Mondwest, pixel) for UI copy, meta and
labels. `font-prose` (PP Editorial New, serif) for anything a reader actually
sits and reads — both pixel faces are display types and punish at paragraph
length. Editorial New replaced Inter: a neutral system sans under two Pangram
Pangram display cuts read as a fallback nobody ever swapped out.

**Mondwest now ships a REAL bold (700).** The long-standing rule that
"anything bold must use `font-display`, because bolding Mondwest synthesises
it and visibly smears a pixel typeface" is **retired** — `font-bold` on body
copy is a genuine cut again. If you find `font-medium` on a UI label, it is a
leftover workaround from that era, and 500 still resolves to the 400 cut;
use `font-bold`.

**Controls must declare `font-body` when they can land inside prose.**
`PageLayout` wraps its slot in a `prose-body` container, so a form rendered
through it inherits the long-form serif. That is right for the article pages
the container exists for and wrong for controls — a field label is UI, not
reading matter. `EnrolForm` and `NewsletterForm` set `font-body` on their
roots for exactly this reason; anything similar must too.

**Fonts are documented for humans in `README.md`** ("Changing the fonts") —
which file registers a family, which token points a role at it, and why
`prose-body` leaks into forms. Point people there rather than re-explaining.

**Small uppercase text is the `label` utility, not a one-off.** Section
markers, card tags, statuses, meta — one 11px tracked uppercase treatment,
defined once in `global.css`. Four slightly different versions of it is what
"disjointed" looked like.

**Hover changes what a thing IS, not how lit it is.** One rule, site-wide.
Buttons invert to a different flat colour (`primary` → blue, `glow` → white,
`ghost` → white). Cards use the `flood` utility: the whole panel fills with
brand ink and the cover art duotones blue under its halftone screen. Fields
take a solid white border. Nothing blurs, nothing travels, nothing pulses.

An animated gradient streak used to run around card borders. It was well
built and it was wrong — it read as modern precisely because it did something
a printed object cannot do. If a hover needs more presence, give it more ink,
not more light.

**Repeatable content goes in `src/content/`**, never inline in a page. Typed
collections in `src/content.config.ts`. Swapping to a CMS later should mean
changing a loader, not components.

**Never pick a top padding for a new page.** Page titles are positioned in one
place: `--masthead-top` in `global.css`, consumed by the `masthead-top`
utility. Use `PageHeader.astro` for the standard title + lede (it handles the
Section, Container, and h1 scale too); use the `masthead-top` utility
directly only when the masthead's *content shape* is bespoke, as on
`protocols/[...slug]`. A hardcoded `pt-*` on a masthead is a bug — every page
drifting apart is exactly what this replaced.

Anything passed as children to `PageHeader` renders **inside the same band**,
below the lede. `/protocols` uses that for its card grid so the heading and
grid share one Section; prose pages leave it empty and follow with their own.

**Match the surrounding file.** Components carry long explanatory comments
where a decision is non-obvious — that's deliberate, several of them document
bugs that were fixed the hard way. Don't strip them.

---

## Invariants — things that look wrong but aren't

These have each been "fixed" once and had to be reverted. Verify by measuring
in the browser before changing any of them.

**`<header>` stretches to the full page height, on purpose.** It's a grid item
sharing one cell with `<main>` (both `col-start-1 row-start-1` — see
`BaseLayout.astro`), and it takes the grid default of stretching. Adding
`self-start` to collapse it to its content looks tidier and **breaks the
sticky nav**: a sticky element can never stay stuck past the bottom edge of
its containing block, so the nav would release as soon as the page scrolled
past ~225px.

**`pointer-events-none` on `<header>` + `pointer-events-auto` on the logo and
`<nav>` is what makes that full-height invisible box safe.** Remove it and the
header swallows clicks across the whole page.

**`items-start` on flex columns is load-bearing.** A flex item's outer display
blockifies (`inline-block` silently computes to `block`), then the container's
default `align-items: stretch` stretches children to full width. Invisible
with left-aligned text, but it inflates each link's real hit target and hover
trigger — hovering empty space far to the right of a nav item used to light it
up.

**Only `<nav>` is sticky; the logo is not.** The logo scrolls away with the
page. `position: sticky` on the nav, `top: 0`, no JS.

**`--masthead-top` is two values on purpose.** The nav rail's links run to
`y≈203`, `x≈167`, and the centred content column only clears that horizontally
at ~1400px and up (measured: 1366 → −20px, 1440 → +17px, 1536 → +65px). So
below 2xl the title starts under the rail; at 2xl and up it rises beside it.
One value either collides on a 1280/1366 laptop or wastes the top of a large
display. Every page's title used to be `pt-40`, which actively collided at
1280 — verified before the fix, on `/coaching`.

**Hero asset URLs are passed as `data-` attributes, not `define:vars`.**
`define:vars` forces the script inline, which loses bundling.

**The hero model preload needs `crossorigin`.** GLTFLoader fetches in CORS
mode; a preload whose mode doesn't match is discarded and re-fetched, making
things worse rather than better.

---

## The hero (`src/components/hero/`)

`GLOW` at the top of `pill-scene.ts` is the single tuning surface for the
pill's look — material, lights and bloom together, because they only make
sense tuned against each other.

**The usable bloom range is narrow.** Both ends have been hit:
`bloomThreshold: 0.12` + `bloomRadius: 1.0` floods the entire hero blue and
the pill loses its form; `bloomThreshold: 0.3` drops below the pill's
luminance and the glow vanishes entirely, leaving it flat matte. Move
threshold in steps of ~0.02.

**Sharpness comes from specular, not emission.** If the pill looks harsh,
the culprits are `clearcoat` (a tight highlight layer on top of the base
material) and `rimLight` (white, so it blows the surface toward white),
*not* the bloom.

**Pill placement is in background-image space, not viewport space** —
`PILL_X` / `PILL_Y` are percentages of the source plate (2048×1153), so the
pill tracks the hands as the plate is cover-cropped at different aspect
ratios. `PILL_ANCHOR` picks which point on the pill lands on that target,
solved against the model's measured bounding box.

**`pill.glb` is a committed binary that cannot be regenerated from this
repo.** The pipeline (`build_pill.mjs`) and the raw scan live in the original
standalone prototype folder, not here. Bringing them in is on the follow-up
list.

---

## Traps (all of these have already burned time)

**Content-collection schema changes silently empty the collection in dev.**
Add a required field and the page renders zero items with no browser error —
only `astro dev logs` shows `The collection "…" does not exist or is empty`.
Fix: `rm -rf .astro` and restart the dev server.

**`window.scrollTo()` under browser automation doesn't reliably fire a
`scroll` event.** It produced a convincing false negative on the sticky-nav
work. Drive real mouse-wheel scroll instead, or dispatch the event manually to
isolate listener logic from event delivery.

**Screenshots lie on this site, in two specific ways.** Pages containing the
WebGL canvas capture as solid black once scrolled; captures taken right after
a `position: sticky` transition can be stale. Both were verified as capture
artifacts, not page bugs. Cross-check with `getBoundingClientRect()` and
`getComputedStyle()` before believing a screenshot, and force a repaint
(resize by 1px and back) if you need a clean one.

**`.focus()` does not trigger `:focus-visible`** in Chromium — it's
input-modality heuristic. Testing keyboard states requires a real Tab press.

**Separate JS-eval tool calls can drop `:hover` / focus state** between calls.
Batch the interaction and the assertion, or read computed styles in the same
call that triggers the state.

**`astro:page-load` listeners throughout the codebase are currently dead
code.** There's no `<ClientRouter />`, so this is a plain MPA — every
navigation is a full page load and the direct `init()` calls do the work. The
listeners are kept defensively in `EnrolForm`, `NewsletterForm`, `Hero`,
`Reveal` and `pricing.astro` so nothing breaks if view transitions are added
later. Don't "clean them up" without adding the router.

---

## Server routes

All under `src/pages/api/**`, all `export const prerender = false`. Input goes
through a Zod schema in `src/lib/validation.ts`; responses use the shared
`{ ok, message }` shape from `src/lib/api.ts`. Forms post normally without JS
and upgrade to `fetch`. Both public forms carry a honeypot.

**`/api/checkout` validates the requested price against the `plans`
collection before calling Stripe** — that's what stops a crafted request
buying an arbitrary price off the account. Access is granted from the
**webhook**, never from the success page.

Note the split: `plans` (coaching tiers) go through `/api/checkout`.
`protocols` (individual guides) bypass it entirely and link straight to a
Stripe Payment Link stored per-protocol in the collection.

---

## Deployment note that actually matters

`integrations/precompress.mjs` writes `.br`/`.gz` siblings at build time.
CDNs and nginx/Caddy serve them automatically. **The `@astrojs/node`
standalone server does not** — it serves assets uncompressed, which means the
643 KB three.js chunk ships uncompressed instead of 131 KB. Behind a CDN or
reverse proxy this is fine; exposed directly it needs a compressing proxy in
front, or the adapter switched to `middleware` mode.

---

## Current state / follow-ups

Blocking launch:

- **Font licence.** `PP NeueBit`, `PP Mondwest` and `PP Editorial New` are all
  commercial Pangram Pangram faces. The `.woff2` files are committed and served
  publicly — this needs a paid web licence, and Editorial New adds a third
  family to whatever is bought. Swapping `--font-display` / `--font-body` /
  `--font-prose` in `global.css` is the escape hatch. Editorial New was
  supplied as OTF and converted to woff2 with fonttools; only Regular, Italic
  and Ultrabold are registered in `astro.config.mjs`, but all six cuts are in
  `src/assets/fonts/` if more are wanted later.
- **All copy is placeholder**, including every `src/content/` entry and the
  protocol prices.
- **Legal pages are stubs** and need writing plus review.
- **No `public/og-default.png`** — the meta tags already point at it.

Known, unfixed, deliberately out of scope so far:

- **`/pricing` has the same two-`Section` layout problem `/protocols` had**:
  stacked `py-24` on `py-24` creating a large dead gap, and a heading/grid
  container-width mismatch. Same fix applies — merge into one section, one
  container width.
- `/api/newsletter` and `/api/enrol` log to console; not wired to a provider.
- All three protocols share one Stripe Payment Link; each should get its own
  (the schema already supports it — `checkoutUrl` is per-protocol).
- `build_pill.mjs` + raw model not in the repo (see hero section above).

Worth raising with the owner rather than silently changing:

- The site's copy ("Enhance or be left behind", "Personalized pharmacology for
  those who know the world is theirs for the taking") reads as selling
  enhancement compounds, while the product is described as coaching and
  education. That gap is a positioning and possibly an advertising-claims
  question, not a code one. It has been flagged; the copy is intentional as
  far as this repo is concerned.

---

## Design work

The `impeccable` skill has been used for the UI work in this repo and its
conventions are reflected throughout. If you continue design work with it,
`node <skill>/scripts/context.mjs` runs once per session, and its mechanical
detector is worth running over changed UI files:

```bash
node <skill-path>/scripts/detect.mjs --json <changed files>
```

There is no `PRODUCT.md` or `DESIGN.md`; `global.css` and the components are
the design authority.
