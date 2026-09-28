import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const temp = await mkdtemp(join(tmpdir(), "flight-rewards-tests-"));
try {
  const outfile = join(temp, "domain.test.mjs");
  await build({
    entryPoints: [new URL("../tests/domain.test.ts", import.meta.url).pathname],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  });
  const run = spawnSync(process.execPath, ["--test", outfile], {
    stdio: "inherit",
  });
  process.exitCode = run.status ?? 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
