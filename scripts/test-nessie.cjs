// Compile into an isolated temporary directory, then run without a Next.js server.
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const build = mkdtempSync(join(tmpdir(), "hacknc26-nessie-"));
const forecastSuites = [
  "apps/web/src/app/api/forecast/route.test",
  "packages/shared/src/forecast/engine.test",
  "packages/shared/src/forecast/risk.test",
];
const planSuites = [
  "apps/web/src/lib/gemini/alternatives.test",
  "apps/web/src/app/api/plans/[id]/alternatives/route.test",
  "apps/web/src/lib/plans/store.test",
  "apps/web/src/app/api/plans/route.test",
  "apps/web/src/app/api/plans/[id]/route.test",
];
const webhookSuites = [
  "apps/web/src/lib/gemini/client.test",
  "apps/web/src/app/api/photon/webhook/route.test",
];
const agentSuites = [
  "apps/photon-agent/src/index.test",
  "apps/photon-agent/src/config.test",
  "apps/photon-agent/src/logger.test",
  "apps/photon-agent/src/photon/client.test",
  "apps/photon-agent/src/photon/handlers.test",
  "apps/photon-agent/src/photon/identityMap.test",
  "apps/photon-agent/src/services/bridgeApiClient.test",
  "apps/photon-agent/src/services/pairing.test",
];
const suites = process.argv.includes("agent") ? agentSuites : process.argv.includes("webhook") ? webhookSuites : process.argv.includes("plans") ? planSuites : process.argv.includes("forecast") ? forecastSuites : [
  "apps/web/src/app/api/nessie/customer/route.test",
  "apps/web/src/lib/nessie/adapters.test",
  "apps/web/src/lib/nessie/routes.test",
  ...forecastSuites,
  ...planSuites,
  ...webhookSuites,
];
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit",
    env: { ...process.env, NODE_PATH: [join(root, "apps/web/node_modules"), join(root, "node_modules"),
      process.env.NODE_PATH].filter(Boolean).join(delimiter) } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Test command failed (exit ${result.status})`);
}
try {
  const compiler = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  run([compiler, "--ignoreConfig", "--strict", "--target", "ES2022",
    "--types", "node",
    ...(process.argv.includes("agent") ? ["--skipLibCheck"] : []),
    "--module", "Node16", "--moduleResolution", "Node16", "--rootDir", ".", "--outDir", build,
    "packages/shared/src/index.ts", ...suites.map(suite => `${suite}.ts`)]);
  // Resolve the workspace package to its compiled output rather than source .ts.
  const shared = join(build, "node_modules", "@hacknc26", "shared");
  mkdirSync(shared, { recursive: true });
  writeFileSync(join(shared, "package.json"), JSON.stringify({
    name: "@hacknc26/shared", main: "../../../packages/shared/src/index.js",
  }));
  for (const suite of suites) {
    run([join(build, `${suite}.js`)]);
    console.log(`PASS ${suite}`);
  }
  console.log("All backend tests passed. No live API requests were made.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(build, { recursive: true, force: true });
}
