import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/app.tsx"],
  outfile: "app.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  metafile: true,
  legalComments: "external",
  define: { "process.env.NODE_ENV": '"production"' },
});
const forbidden = Object.keys(result.metafile.inputs).filter(
  (p) =>
    p.includes(".server.") ||
    p.startsWith("server/") ||
    /node_modules\/(pg|next|drizzle-orm)\//.test(p),
);
if (forbidden.length)
  throw new Error(
    `Server code entered the client bundle: ${forbidden.join(", ")}`,
  );
console.log(
  "Built the static React client. No server providers or database code in the browser bundle.",
);
