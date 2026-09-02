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
        ],
      },
      fallbacks: ["ui-monospace", "monospace"],
    },
    {
      /**
       * Long-form reading face. The pixel faces are display types — they are
       * punishing at paragraph length, so articles get a real text face.
       */
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["400", "500"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["system-ui", "sans-serif"],
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
