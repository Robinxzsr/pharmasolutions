// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";
import precompress from "./integrations/precompress.mjs";
import modulePreload from "./integrations/module-preload.mjs";

// https://astro.build/config
export default defineConfig({
  /** Required for canonical URLs, OG tags, and sitemap generation. */
  site: "https://pharmacology.solutions",

  /**
   * Static by default — every marketing page prerenders to HTML.
   * Routes that need a server (checkout, webhooks, form handlers) opt in
   * individually with `export const prerender = false`.
   */
  output: "static",

  adapter: node({ mode: "standalone" }),

  integrations: [
    mdx(),
    sitemap(),
    // Emits the modulepreload for the content-hashed three.js chunk.
    modulePreload(),
    // Must stay last: it compresses whatever the earlier hooks produced.
    precompress(),
  ],

  vite: {
    plugins: [tailwindcss()],
    /**
     * three.js is only pulled in by the hero island. Splitting it into its
     * own chunk keeps it out of the bundle every other page downloads.
     */
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => (id.includes("node_modules/three") ? "three" : undefined),
        },
      },
    },
  },

  /**
   * Fonts are processed at build time, self-hosted, and preloaded with
   * automatic fallback metrics. The `cssVariable` names are consumed by the
   * `@theme` block in `src/styles/global.css`.
   *
   * NOTE: PP NeueBit and PP Mondwest are commercial Pangram Pangram faces.
   * Serving them publicly requires a web licence — see README.
   */
  fonts: [
    {
      provider: fontProviders.local(),
      name: "PP NeueBit",
      cssVariable: "--font-neuebit",
      options: {
        variants: [
          {
            weight: 700,
            style: "normal",
            src: ["./src/assets/fonts/ppneuebit-bold.woff2"],
          },
        ],
      },
      fallbacks: ["ui-monospace", "monospace"],
    },
    {
      /**
       * Mondwest now ships a REAL bold cut, so `font-weight: 700` on body
       * copy is finally a genuine weight rather than a synthesised smear.
       * That lifts the long-standing "anything bold must use font-display"
       * constraint — see CLAUDE.md.
       */
      provider: fontProviders.local(),
      name: "PP Mondwest",
      cssVariable: "--font-mondwest",
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/ppmondwest-regular.woff2"],
          },
          {
            weight: 700,
            style: "normal",
            src: ["./src/assets/fonts/ppmondwest-bold.woff2"],
          },
        ],
      },
      fallbacks: ["ui-monospace", "monospace"],
    },
    {
      /**
       * Long-form reading face, replacing Inter. The pixel faces are display
       * types — punishing at paragraph length — and Inter, while readable,
       * belonged to no one: a neutral system sans under two Pangram Pangram
       * display cuts read as a fallback that never got replaced. Editorial
       * New is a text face with an actual point of view, and it is quiet
       * enough to carry a page of prose.
       *
       * Three cuts, because prose genuinely uses three: roman, italic for
       * emphasis, and a real bold for `<strong>` so MDX articles never
       * synthesise one. Only fetched on pages that render prose.
       */
      provider: fontProviders.local(),
      name: "PP Editorial New",
      cssVariable: "--font-editorial",
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/ppeditorialnew-regular.woff2"],
          },
          {
            weight: 400,
            style: "italic",
            src: ["./src/assets/fonts/ppeditorialnew-italic.woff2"],
          },
          {
            weight: 700,
            style: "normal",
            src: ["./src/assets/fonts/ppeditorialnew-ultrabold.woff2"],
          },
        ],
      },
      fallbacks: ["Georgia", "serif"],
    },
  ],

  image: {
    responsiveStyles: true,
    layout: "constrained",
  },

  /**
   * Typed environment variables. Missing or malformed keys fail the build
   * instead of surfacing as a runtime 500 during checkout.
   */
  env: {
    schema: {
      STRIPE_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      STRIPE_WEBHOOK_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      PUBLIC_STRIPE_PUBLISHABLE_KEY: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      /** Where enrolment enquiries are delivered. */
      ENROL_NOTIFY_EMAIL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
});
