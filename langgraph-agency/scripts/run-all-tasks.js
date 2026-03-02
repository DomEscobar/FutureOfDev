#!/usr/bin/env node
/**
 * Run the LangGraph agency against the workspace for every task in opencode/tasks.
 * Usage: WORKSPACE=/path/to/repo node scripts/run-all-tasks.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OPENCODE_TASKS = path.join(ROOT, "..", "opencode", "tasks");
const ORCHESTRATOR = path.join(ROOT, "src", "orchestrator.js");

const tasksDir = process.env.OPENCODE_TASKS || OPENCODE_TASKS;
const workspace = process.env.WORKSPACE || path.join(ROOT, "..", "Erp_dev_bench-1");

if (!fs.existsSync(tasksDir)) {
  console.error("Tasks dir not found:", tasksDir);
  process.exit(1);
}

const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".json"));
const taskIds = files.map((f) => path.basename(f, ".json")).sort();

console.log(`Running ${taskIds.length} tasks against WORKSPACE=${workspace}\n`);

for (const id of taskIds) {
  console.log(`\n--- Task: ${id} ---`);
  const r = spawnSync("node", [ORCHESTRATOR, "--task", id], {
    cwd: ROOT,
    env: { ...process.env, WORKSPACE: workspace },
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`Task ${id} exited with ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

console.log(`\n✅ All ${taskIds.length} tasks finished.`);
