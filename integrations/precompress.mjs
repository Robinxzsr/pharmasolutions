import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { brotliCompress, gzip, constants } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/**
 * Writes `.br` and `.gz` siblings for every compressible build asset.
 *
 * Compression is the single largest win available on this site: the three.js
 * chunk is 643 KB raw and 131 KB brotli, and it sits directly in front of the
 * hero. Doing it at build time rather than per-request means quality 11 is
 * affordable — an on-the-fly proxy typically runs quality 4-5 to stay cheap.
 *
 * Static hosts and CDNs (Netlify, Vercel, Cloudflare) and web servers with
 * `brotli_static` / `gzip_static` (nginx, Caddy) serve these automatically.
 *
 * NOTE: the `@astrojs/node` standalone server does NOT read them — it serves
 * assets uncompressed. Behind a CDN or reverse proxy that's fine. Serving that
 * standalone server directly to the internet is the one deployment where this
 * has no effect.
 */
export default function precompress({
  /** Formats that are already compressed gain nothing and cost build time. */
  extensions = [".js", ".css", ".html", ".svg", ".json", ".xml", ".txt", ".glb", ".map"],
  /** Below this, framing overhead outweighs any saving. */
  minBytes = 1024,
} = {}) {
  return {
    name: "precompress",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);

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

        const targets = files.filter(
          (f) => extensions.includes(path.extname(f)) && !f.endsWith(".br") && !f.endsWith(".gz")
        );

        let count = 0;
        let rawTotal = 0;
        let brTotal = 0;

        await Promise.all(
          targets.map(async (file) => {
            const { size } = await stat(file);
            if (size < minBytes) return;

            const source = await readFile(file);

            const [br, gz] = await Promise.all([
              brotliAsync(source, {
                params: {
                  [constants.BROTLI_PARAM_QUALITY]: 11,
                  [constants.BROTLI_PARAM_SIZE_HINT]: size,
                },
              }),
              gzipAsync(source, { level: 9 }),
            ]);

            // Keep only what actually pays for itself.
            if (br.length < size) await writeFile(`${file}.br`, br);
            if (gz.length < size) await writeFile(`${file}.gz`, gz);

            count++;
            rawTotal += size;
            brTotal += br.length;
          })
        );

        const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
        logger.info(
          `Precompressed ${count} asset(s): ${kb(rawTotal)} -> ${kb(brTotal)} brotli ` +
            `(${(100 - (brTotal / rawTotal) * 100).toFixed(0)}% smaller).`
        );
      },
    },
  };
}
