import fs from "fs";
import path from "path";
import { WORKSPACE, OPENCODE_ROOT } from "../../config.js";
import { runOpencodeRole } from "./runOpencode.js";
import { updateDashboardAndPush } from "../telemetry.js";

function simpleGlob(pattern, cwd) {
  const base = path.dirname(pattern);
  const name = path.basename(pattern);
  const dir = path.resolve(cwd, base);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const re = new RegExp("^" + name.replace(/\./g, ".").replace(/\*/g, ".*") + "$");
  for (const f of fs.readdirSync(dir)) {
    if (re.test(f)) out.push(path.join(base, f));
  }
  return out;
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function updateDashboard(data) {
  updateDashboardAndPush(data);
}

async function getProjectSnapshot(dir) {
  log("🔍 Performing Brownfield Discovery...");
  let snapshot = { patterns: "", deps: "" };
  try {
    const goMod = path.join(dir, "backend/go.mod");
    if (fs.existsSync(goMod)) {
      snapshot.deps += `\nBACKEND DEPS:\n${fs.readFileSync(goMod, "utf8").split("\n").slice(0, 15).join("\n")}`;
    }
    const pkgJson = path.join(dir, "frontend/package.json");
    if (fs.existsSync(pkgJson)) {
      snapshot.deps += `\nFRONTEND DEPS:\n${fs.readFileSync(pkgJson, "utf8")}`;
    }
    const modelsDir = path.join(dir, "backend/internal/models");
    if (fs.existsSync(modelsDir)) {
      const files = fs.readdirSync(modelsDir);
      const firstGo = files.find((f) => f.endsWith(".go"));
      if (firstGo) {
        const firstModel = path.join(modelsDir, firstGo);
        snapshot.patterns += `\nBASE MODEL PATTERN:\n${fs.readFileSync(firstModel, "utf8").slice(0, 600)}`;
      }
    }
    const archDoc = path.join(dir, "docs/ARCHITECTURE.md");
    if (fs.existsSync(archDoc)) {
      snapshot.patterns += `\nEXISTING ARCHITECTURE:\n${fs.readFileSync(archDoc, "utf8").slice(0, 1000)}`;
    } else {
      snapshot.patterns += "\nWARNING: docs/ARCHITECTURE.md is MISSING. Architect must create it.";
    }
  } catch (e) {
    log(`Discovery warning: ${e.message}`);
  }
  return snapshot;
}

function enforceKPIGate() {
  if (process.env.BENCHMARK_MODE) {
    log("🔒 [KPI GATE] Benchmark mode – skipping.");
    return true;
  }
  log("🔒 [KPI GATE] Checking Definition of DONE...");
  const requiredPatterns = [".run/red-test.*", ".run/green-test.*", ".run/contract.md"];
  const kpiResults = {};
  for (const pattern of requiredPatterns) {
    const matches = simpleGlob(pattern, WORKSPACE);
    kpiResults[pattern] = matches.length > 0;
    if (!kpiResults[pattern]) log(`❌ KPI FAIL: Missing ${pattern}`);
    else log(`✅ KPI PASS: ${pattern}`);
  }
  const passCount = Object.values(kpiResults).filter(Boolean).length;
  const totalCount = Object.keys(kpiResults).length;
  log(`🔒 [KPI GATE] ${passCount}/${totalCount} passed`);
  updateDashboard({
    lastKpiGate: { results: kpiResults, passRate: `${passCount}/${totalCount}`, timestamp: new Date().toISOString() },
    phases: { kpi_gate: { status: passCount >= totalCount ? "✅ passed" : "❌ failed", time: new Date().toISOString() } },
  });
  return passCount >= totalCount;
}

export function createNodes() {
  const triage = async (state) => {
    log("⚙️ [TRIAGE] Scientific intake...");
    const snapshot = await getProjectSnapshot(WORKSPACE);
    updateDashboard({
      taskId: state.taskId,
      taskType: "SCIENTIST",
      startTime: Date.now(),
      persona: "🔘 [LangGraph]",
      latestThought: "Scientific intake & brownfield discovery.",
      phases: {
        triage: { status: "✅ done", time: new Date().toISOString() },
        architect: { status: "⚙️ Obelisk Intake: Scientific Triage...", time: "" },
      },
    });
    return {
      taskType: "SCIENTIST",
      snapshot,
      currentPhase: "architect",
      phases: { triage: { status: "done", snapshot } },
    };
  };

  const architect = async (state) => {
    const feedback = `TASK: ${state.taskDescription}\n\nSYSTEM SNAPSHOT:\n${state.snapshot?.deps ?? ""}\n${state.snapshot?.patterns ?? ""}\n\nGOAL: Initialize/Update docs/ARCHITECTURE.md and write .run/contract.md.`;
    const { code, output } = await runOpencodeRole("architect", feedback, "architect");
    const attempts = (state.attemptCount?.architect ?? 0) + 1;
    const status = code === 0 ? "✅ done" : "🔄 retry";
    updateDashboard({
      phases: { architect: { status, time: new Date().toISOString(), attempts } },
      latestThought: code === 0 ? "Contract & ARCHITECTURE.md ready." : (output || "").slice(0, 150),
      persona: "📐 [ARCHITECT]",
    });
    return {
      currentPhase: "hammer",
      phases: { architect: { status: code === 0 ? "done" : "retry", code, output, attempts } },
      attemptCount: { ...state.attemptCount, architect: attempts },
      error: code !== 0 ? output : undefined,
    };
  };

  const hammer = async (state) => {
    const feedback = `TASK: ${state.taskDescription}\nContract and ARCHITECTURE.md must be followed. Implement the contract.`;
    const { code, output } = await runOpencodeRole("hammer", feedback, "hammer");
    const attempts = (state.attemptCount?.hammer ?? 0) + 1;
    const status = code === 0 ? "✅ done" : "🔄 retry";
    updateDashboard({
      phases: { hammer: { status, time: new Date().toISOString(), attempts } },
      latestThought: code === 0 ? "Implementation run complete." : (output || "").slice(0, 150),
      persona: "🔨 [HAMMER]",
    });
    return {
      currentPhase: "kpi_gate",
      phases: { hammer: { status: code === 0 ? "done" : "retry", code, output, attempts } },
      attemptCount: { ...state.attemptCount, hammer: attempts },
      error: code !== 0 ? output : undefined,
    };
  };

  const kpiGate = async (state) => {
    const passed = enforceKPIGate();
    const hammerAttempts = state.attemptCount?.hammer ?? 0;
    const maxHammerRetries = Number(process.env.AGENCY_MAX_HAMMER_RETRIES) || 5;
    const allowMoreHammer = hammerAttempts < maxHammerRetries;
    const nextPhase = passed ? "checker" : (allowMoreHammer ? "hammer" : "checker");
    if (!passed && !allowMoreHammer) log("⚠️ [KPI GATE] Max hammer retries reached; proceeding to checker.");
    return { kpiPassed: passed, currentPhase: nextPhase };
  };

  const checker = async (state) => {
    const feedback = `Verify Red Test → Green Test and contract compliance for: ${state.taskDescription}`;
    const { code, output } = await runOpencodeRole("checker", feedback, "checker");
    const status = code === 0 ? "✅ done" : "❌ fail";
    updateDashboard({
      phases: { checker: { status, time: new Date().toISOString() } },
      latestThought: code === 0 ? "Red/Green test & contract verified." : (output || "").slice(0, 150),
      persona: "🧐 [CHECKER]",
    });
    return {
      currentPhase: "skeptic",
      phases: { checker: { status: code === 0 ? "done" : "fail", code, output } },
    };
  };

  const skeptic = async (state) => {
    const feedback = `Audit quality and structure for: ${state.taskDescription}. Check VETO_LOG and blast radius.`;
    const { code, output } = await runOpencodeRole("skeptic", feedback, "skeptic");
    const status = code === 0 ? "✅ done" : "❌ fail";
    updateDashboard({
      phases: { skeptic: { status, time: new Date().toISOString() } },
      latestThought: code === 0 ? "Quality audit passed." : (output || "").slice(0, 150),
      persona: "⚖️ [SKEPTIC]",
    });
    return {
      currentPhase: "medic",
      phases: { skeptic: { status: code === 0 ? "done" : "fail", code, output } },
    };
  };

  const medic = async (state) => {
    const feedback = `Fix any build/lint/regression issues for: ${state.taskDescription}. Run tests and heal.`;
    const { code, output } = await runOpencodeRole("medic", feedback, "medic");
    const status = code === 0 ? "✅ done" : "❌ fail";
    updateDashboard({
      phases: { medic: { status, time: new Date().toISOString() } },
      latestThought: code === 0 ? "Agency run complete." : (output || "").slice(0, 150),
      persona: "🩹 [MEDIC]",
    });
    return {
      currentPhase: "end",
      phases: { medic: { status: code === 0 ? "done" : "fail", code, output } },
    };
  };

  return {
    triage,
    architect,
    hammer,
    kpiGate,
    checker,
    skeptic,
    medic,
    enforceKPIGate,
  };
}
