#!/usr/bin/env node
/**
 * Run benchmark tasks with LangGraph agency, optionally with reset and checks.
 *
 * Usage:
 *   node scripts/benchmark-with-checks.js
 *   WORKSPACE=/path/to/repo node scripts/benchmark-with-checks.js
 *
 * If WORKSPACE has benchmark/runner.cjs (e.g. Erp_dev_bench-1): resets to baseline before each task, runs agency, then backend/frontend checks.
 * If WORKSPACE has no benchmark runner (e.g. EmpoweredPixels): no-reset mode — runs agency then checks only; no git reset.
 */
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORKSPACE = process.env.WORKSPACE || path.resolve(ROOT, "..", "..", "Erp_dev_bench-1");
const BENCHMARK_DIR = path.join(WORKSPACE, "benchmark");
const ORCHESTRATOR = path.join(ROOT, "src", "orchestrator.js");

const BENCHMARK_TASKS = ["bench-001", "bench-002", "bench-003"];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || process.cwd(),
    env: opts.env || process.env,
    encoding: "utf8",
    stdio: opts.stdio ?? "inherit",
  });
  return { ...r, ok: r.status === 0 };
}

function benchmarkReset() {
  log("🧹 Resetting workspace to baseline...");
  const r = run("node", ["runner.cjs", "reset"], { cwd: BENCHMARK_DIR, stdio: "pipe" });
  if (!r.ok) {
    log("⚠️  No baseline. Running setup then reset...");
    run("node", ["runner.cjs", "setup"], { cwd: BENCHMARK_DIR });
    run("node", ["runner.cjs", "reset"], { cwd: BENCHMARK_DIR });
  }
}

function benchmarkPrepare() {
  run("node", ["runner.cjs", "reset"], { cwd: BENCHMARK_DIR, stdio: "pipe" });
}

function runLangGraph(taskId) {
  const taskArg = `benchmark-${taskId}`;
  log(`🤖 LangGraph agency: task ${taskArg}`);
  const r = run("node", [ORCHESTRATOR, "--task", taskArg], {
    cwd: ROOT,
    env: { ...process.env, WORKSPACE },
  });
  return r.ok;
}

function checkBackend() {
  const backendDir = path.join(WORKSPACE, "backend");
  if (!fs.existsSync(backendDir)) return null;
  log("📋 Check: backend tests (go test ./...)");
  const r = run("go", ["test", "./..."], {
    cwd: backendDir,
    stdio: "pipe",
  });
  return r.ok;
}

function checkFrontend() {
  const frontendDir = path.join(WORKSPACE, "frontend");
  if (!fs.existsSync(frontendDir)) return null;
  const nodeModules = path.join(frontendDir, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    log("   Installing frontend deps (node_modules was cleaned)...");
    run("npm", ["install"], { cwd: frontendDir, stdio: "pipe" });
  }
  log("📋 Check: frontend unit tests (vitest run)");
  const r = run("npx", ["vitest", "run"], {
    cwd: frontendDir,
    stdio: "pipe",
    timeout: 60000,
  });
  return r.ok;
}

function runChecks() {
  const backendOk = checkBackend();
  const frontendOk = checkFrontend();
  const backendSkipped = backendOk === null;
  const frontendSkipped = frontendOk === null;
  log(`   Backend: ${backendSkipped ? "N/A (no backend/)" : (backendOk ? "✅" : "❌")}`);
  log(`   Frontend: ${frontendSkipped ? "N/A (no frontend/)" : (frontendOk ? "✅" : "❌")}`);
  const ok = (backendSkipped || backendOk) && (frontendSkipped || frontendOk);
  return { backendOk: backendOk ?? true, frontendOk: frontendOk ?? true, ok };
}

async function main() {
  const hasBenchmarkRunner = fs.existsSync(BENCHMARK_DIR) && fs.existsSync(path.join(BENCHMARK_DIR, "runner.cjs"));

  console.log("\n" + "=".repeat(60));
  console.log("LangGraph Agency • Benchmark with step-by-step checks");
  console.log("WORKSPACE:", WORKSPACE);
  console.log("Mode:", hasBenchmarkRunner ? "reset + agency + checks" : "no-reset (agency + checks only)");
  console.log("=".repeat(60) + "\n");

  if (!fs.existsSync(WORKSPACE)) {
    console.error("Workspace not found:", WORKSPACE);
    process.exit(1);
  }

  if (hasBenchmarkRunner) {
    log("Ensuring baseline exists...");
    run("node", ["runner.cjs", "setup"], { cwd: BENCHMARK_DIR });
    benchmarkReset();
  } else {
    log("No benchmark/runner.cjs in workspace; skipping reset (no-reset mode).");
  }

  const results = [];

  for (let i = 0; i < BENCHMARK_TASKS.length; i++) {
    const taskId = BENCHMARK_TASKS[i];
    console.log("\n" + "─".repeat(60));
    console.log(`TASK ${i + 1}/${BENCHMARK_TASKS.length}: ${taskId}`);
    console.log("─".repeat(60));

    if (hasBenchmarkRunner) benchmarkPrepare();
    const agencyOk = runLangGraph(taskId);
    const checks = runChecks();

    results.push({
      taskId,
      agencyExitOk: agencyOk,
      backendOk: checks.backendOk,
      frontendOk: checks.frontendOk,
      allOk: agencyOk && checks.ok,
    });

    log(`Result ${taskId}: agency=${agencyOk ? "✅" : "❌"} backend=${checks.backendOk ? "✅" : "❌"} frontend=${checks.frontendOk ? "✅" : "❌"}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  results.forEach((r) => {
    console.log(`  ${r.taskId}: agency ${r.agencyExitOk ? "✅" : "❌"} | backend ${r.backendOk ? "✅" : "❌"} | frontend ${r.frontendOk ? "✅" : "❌"}`);
  });
  const allAgency = results.every((r) => r.agencyExitOk);
  const allBackend = results.every((r) => r.backendOk);
  const allFrontend = results.every((r) => r.frontendOk);
  console.log("\n  All agency runs OK:", allAgency ? "✅" : "❌");
  console.log("  All backend checks OK:", allBackend ? "✅" : "❌");
  console.log("  All frontend checks OK:", allFrontend ? "✅" : "❌");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
