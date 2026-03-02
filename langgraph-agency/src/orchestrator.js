/**
 * LangGraph orchestrator for the opencode agency.
 * Graph: triage → architect → hammer → kpi_gate → [checker|hammer] → checker → skeptic → medic → end.
 * Each role node invokes opencode's dev-unit.cjs (same roster/SOULs).
 *
 * With USE_LANGGRAPHICS=1: starts a WebSocket server and streams run events for langgraphics-web.
 */
import fs from "fs";
import path from "path";
import { StateGraph, START, END } from "@langchain/langgraph";
import { AgencyStateAnnotation } from "./state.js";
import { createNodes } from "./nodes/agencyNodes.js";
import { OPENCODE_ROOT, WORKSPACE } from "../config.js";

const USE_LANGGRAPHICS = process.env.USE_LANGGRAPHICS === "1" || process.env.USE_LANGGRAPHICS === "true";
const LANGGRAPHICS_WS_PORT = Number(process.env.LANGGRAPHICS_WS_PORT) || 8765;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadTask(taskArg) {
  let taskPath = path.join(OPENCODE_ROOT, "tasks", `${taskArg}.json`);
  if (!fs.existsSync(taskPath)) {
    taskPath = path.join(WORKSPACE, "benchmark", "tasks", `${taskArg}.json`);
  }
  if (!fs.existsSync(taskPath)) {
    throw new Error(`Task file not found: ${taskPath}`);
  }
  return JSON.parse(fs.readFileSync(taskPath, "utf8"));
}

function parseTaskInput() {
  const argv = process.argv.slice(2);
  const taskIndex = argv.indexOf("--task");
  let input;
  if (taskIndex >= 0 && argv[taskIndex + 1] != null) {
    input = argv[taskIndex + 1];
  } else if (argv[0] != null && !argv[0].startsWith("-")) {
    input = argv[0];
  } else {
    return null;
  }
  const hasSpaces = /\s/.test(input);
  const taskIdLike = /^[a-zA-Z0-9_-]+$/.test(input) && input.length < 80;
  const asTaskArg = taskIdLike ? (input.includes("-") ? input : `benchmark-${input}`) : null;
  const taskPath = asTaskArg
    ? path.join(OPENCODE_ROOT, "tasks", `${asTaskArg}.json`)
    : null;
  const taskPathExists = taskPath && fs.existsSync(taskPath);
  if (taskPathExists) return loadTask(asTaskArg);
  return {
    id: "ad-hoc",
    name: "Ad-hoc",
    description: input,
    status: "pending",
    priority: "high",
    created_at: new Date().toISOString(),
  };
}

function buildGraph() {
  const nodes = createNodes();
  const graph = new StateGraph(AgencyStateAnnotation)
    .addNode("triage", nodes.triage)
    .addNode("architect", nodes.architect)
    .addNode("hammer", nodes.hammer)
    .addNode("kpi_gate", nodes.kpiGate)
    .addNode("checker", nodes.checker)
    .addNode("skeptic", nodes.skeptic)
    .addNode("medic", nodes.medic)
    .addEdge(START, "triage")
    .addEdge("triage", "architect")
    .addEdge("architect", "hammer")
    .addEdge("hammer", "kpi_gate")
    .addConditionalEdges("kpi_gate", (state) => (state.currentPhase === "checker" ? "checker" : "hammer"))
    .addEdge("checker", "skeptic")
    .addEdge("skeptic", "medic")
    .addEdge("medic", END);
  return graph.compile();
}

async function runWithViewport(app, initialState) {
  const { createViewport, Broadcaster, extract } = await import("langgraphics-js");
  const topology = await extract(app);
  const wsHost = process.env.LANGGRAPHICS_WS_HOST || "localhost";
  const broadcaster = new Broadcaster(topology, { host: wsHost, port: LANGGRAPHICS_WS_PORT });
  await broadcaster.start({ host: wsHost, port: LANGGRAPHICS_WS_PORT });
  log(`📡 LangGraphics WS: ws://${wsHost}:${LANGGRAPHICS_WS_PORT}`);
  const viewport = await createViewport(app, broadcaster);
  const result = await viewport.invoke(initialState, {
    recursionLimit: Number(process.env.AGENCY_RECURSION_LIMIT) || 50,
  });
  if (process.env.LANGGRAPHICS_KEEP_OPEN === "1" || process.env.LANGGRAPHICS_KEEP_OPEN === "true") {
    log("📡 Keeping WebSocket server open. Connect UI to see topology and replay.");
    await new Promise(() => {});
  }
  await broadcaster.close();
  return result;
}

async function main() {
  const task = parseTaskInput() ?? loadTask("benchmark-bench-002");
  log(`🏁 Starting Task: ${task.name ?? task.id}`);

  const app = buildGraph();
  const initialState = {
    taskId: task.id,
    taskDescription: task.description ?? "",
    taskType: "SCIENTIST",
    snapshot: null,
    currentPhase: "",
    phases: {},
    kpiPassed: false,
    attemptCount: {},
    error: undefined,
  };

  const result = USE_LANGGRAPHICS
    ? await runWithViewport(app, initialState)
    : await app.invoke(initialState, {
        recursionLimit: Number(process.env.AGENCY_RECURSION_LIMIT) || 50,
      });
  log(`✅ Graph finished. Final phase: ${result.currentPhase ?? "end"}`);
  if (result.error) log(`⚠️ Last error: ${result.error}`);
  return result;
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
