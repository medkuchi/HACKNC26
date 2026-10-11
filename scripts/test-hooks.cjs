const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "..");
const build = mkdtempSync(join(tmpdir(), "hacknc26-hooks-"));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit",
    env: { ...process.env, NODE_PATH: [join(root, "apps/web/node_modules"), join(root, "node_modules")].join(delimiter) } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Hook checks failed (exit ${result.status})`);
}
try {
  const compiler = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  run([compiler, "--ignoreConfig", "--strict", "--target", "ES2022", "--module", "Node16",
    "--moduleResolution", "Node16", "--rootDir", "apps/web/src/hooks", "--outDir", build,
    "apps/web/src/hooks/useForecast.test.ts", "apps/web/src/hooks/usePlans.test.ts"]);
  run([join(build, "useForecast.test.js")]);
  console.log("PASS useForecast: fetching, refresh, errors, settings changes, and cancellation");
  run([join(build, "usePlans.test.js")]);
  console.log("PASS usePlans: CRUD, filtering, refresh, errors, and cancellation");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(build, { recursive: true, force: true });
}
