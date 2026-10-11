// Compile isolated component interaction tests and run without a browser/server.
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "..");
const build = mkdtempSync(join(tmpdir(), "hacknc26-dashboard-"));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit",
    env: { ...process.env, NODE_PATH: [join(root, "apps/web/node_modules"), join(root, "node_modules")].join(delimiter) } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Dashboard checks failed (exit ${result.status})`);
}
try {
  const config = join(build, "tsconfig.json");
  writeFileSync(config, JSON.stringify({
    extends: join(root, "apps/web/tsconfig.json"),
    compilerOptions: { module: "Node16", moduleResolution: "Node16", jsx: "react-jsx",
      noEmit: false, incremental: false, rootDir: join(root, "apps/web/src"), outDir: build, types: ["node"],
      typeRoots: [join(root, "node_modules/@types")], plugins: [] },
    include: [join(root, "apps/web/src/components/dashboard/PlanAlternatives.test.tsx")], exclude: [],
  }));
  const compiler = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  run([compiler, "--project", config]);
  run([join(build, "components/dashboard/PlanAlternatives.test.js")]);
  console.log("PASS plan alternatives: generation, explicit apply, failures, and stale requests");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { rmSync(build, { recursive: true, force: true }); }
