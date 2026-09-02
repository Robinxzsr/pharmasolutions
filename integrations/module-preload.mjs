import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Injects a `<link rel="modulepreload">` for the three.js chunk into every
 * prerendered page that actually uses it.
 *
 * Why an integration rather than a plain <link> in the template: the chunk is
 * content-hashed by Rollup, so its filename only exists after the bundle is
 * written. This hook runs at `astro:build:done`, finds the emitted chunk, and
 * patches the HTML.
 *
 * Without it the browser can't discover three.js until it has downloaded and
 * parsed the hero's entry script — costing a round trip before the largest
 * asset on the page even starts.
 *
 * Pages are matched by the script that imports the chunk, so pages without the
 * hero are left untouched and don't pay for a library they never load.
 */
export default function modulePreload({
  chunk = "three",
  entrySignature = "Hero.astro_astro_type_script",
} = {}) {
  return {
    name: "hero-module-preload",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);

        /** Recursively collect files, since routes nest into subdirectories. */
        async function walk(current) {
          const entries = await readdir(current, { withFileTypes: true });
          const found = [];
          for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) found.push(...(await walk(full)));
            else found.push(full);
          }
          return found;
        }

        let files;
        try {
          files = await walk(outDir);
        } catch {
          logger.warn(`Could not read build output at ${outDir}; skipping.`);
          return;
        }

        const assetDir = path.join(outDir, "_astro");
        const chunkFile = files
          .filter((f) => path.dirname(f) === assetDir)
          .map((f) => path.basename(f))
          .find((name) => name.startsWith(`${chunk}.`) && name.endsWith(".js"));

        if (!chunkFile) {
          // Loud on purpose: a silent no-op here is a performance regression
          // that would only show up in a profile months later.
          logger.warn(
            `No "${chunk}.*.js" chunk found — modulepreload not injected. ` +
              `Has the manualChunks config in astro.config.mjs changed?`
          );
          return;
        }

        const tag = `<link rel="modulepreload" href="/_astro/${chunkFile}">`;
        let patched = 0;

        for (const file of files.filter((f) => f.endsWith(".html"))) {
          const html = await readFile(file, "utf8");

          // Only pages that load the chunk, and never twice.
          if (!html.includes(entrySignature)) continue;
          if (html.includes(tag)) continue;

          await writeFile(file, html.replace("</head>", `${tag}</head>`), "utf8");
          patched++;
        }

        logger.info(`Injected modulepreload for ${chunkFile} into ${patched} page(s).`);
      },
    },
  };
}
