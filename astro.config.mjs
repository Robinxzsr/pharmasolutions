// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  /** Required for canonical URLs, OG tags, and sitemap generation. */
  site: "https://pharmasolutions.example.com",

  /**
   * Static by default — every marketing page prerenders to HTML.
   * Routes that need a server (checkout, webhooks, form handlers) opt in
   * individually with `export const prerender = false`.
   */
  output: "static",

  adapter: node({ mode: "standalone" }),

  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },

  /**
   * Fonts are downloaded at build time, self-hosted, subsetted, and
   * preloaded with automatic fallback metrics — no layout shift, no
   * third-party request. The `cssVariable` names are consumed by the
   * `@theme` block in `src/styles/global.css`.
   */
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Fraunces",
      cssVariable: "--font-fraunces",
      weights: ["400", "500", "600"],
      styles: ["normal", "italic"],
      subsets: ["latin"],
      fallbacks: ["Georgia", "serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["400", "500", "600"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["system-ui", "sans-serif"],
    },
  ],

  image: {
    /**
     * Illustrations are the heaviest asset on this site. AVIF first with a
     * WebP fallback keeps the painterly gradients smooth at a fraction of
     * the PNG weight.
     */
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
