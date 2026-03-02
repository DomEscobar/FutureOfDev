/**
 * Telemetry reporting and Telegram pushes for the LangGraph agency.
 * Writes state to opencode/.run/telemetry_state.json and sends/edits a live pulse message to Telegram.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { OPENCODE_ROOT, DASHBOARD_FILE } from "../config.js";

const CONFIG_FILE = path.join(OPENCODE_ROOT, "config.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function readState() {
  const defaultState = {
    taskId: "—",
    startTime: Date.now(),
    taskType: "SCIENTIST",
    phases: {
      triage: { status: "⏳ Queued", time: "" },
      architect: { status: "⏳ Queued", time: "" },
      hammer: { status: "⏳ Queued", time: "" },
      kpi_gate: { status: "⏳ Queued", time: "" },
      checker: { status: "⏳ Queued", time: "" },
      skeptic: { status: "⏳ Queued", time: "" },
      medic: { status: "⏳ Queued", time: "" },
    },
    latestThought: "Waking up...",
    persona: "🔘 [LangGraph]",
    messageId: null,
    lastKpiGate: null,
    metrics: {},
  };
  if (!fs.existsSync(DASHBOARD_FILE)) return defaultState;
  try {
    const state = JSON.parse(fs.readFileSync(DASHBOARD_FILE, "utf8"));
    const phases = { ...defaultState.phases, ...state.phases };
    return { ...defaultState, ...state, phases };
  } catch {
    return defaultState;
  }
}

function renderPulse(state) {
  const elapsed = Math.round((Date.now() - (state.startTime || Date.now())) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const phaseKeys = ["triage", "architect", "hammer", "kpi_gate", "checker", "skeptic", "medic"];
  const completed = phaseKeys.filter(
    (k) => state.phases[k] && (state.phases[k].status === "done" || String(state.phases[k].status || "").includes("✅"))
  ).length;
  const pct = Math.min(100, phaseKeys.length ? Math.round((completed / phaseKeys.length) * 100) : 0);
  const bar = "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));

  let text = `🏛️ *LangGraph Agency • ${state.taskId || "—"}*
[${bar}] ${pct}%

⚙️ *TRIAGE*:    ${(state.phases.triage && state.phases.triage.status) || "—"}
📐 *ARCHITECT*: ${(state.phases.architect && state.phases.architect.status) || "—"}
🔨 *HAMMER*:    ${(state.phases.hammer && state.phases.hammer.status) || "—"}
🔒 *KPI GATE*:  ${(state.phases.kpi_gate && state.phases.kpi_gate.status) || (state.lastKpiGate ? `${state.lastKpiGate.passRate} passed` : "—")}
🧐 *CHECKER*:   ${(state.phases.checker && state.phases.checker.status) || "—"}
⚖️ *SKEPTIC*:   ${(state.phases.skeptic && state.phases.skeptic.status) || "—"}
🩹 *MEDIC*:     ${(state.phases.medic && state.phases.medic.status) || "—"}

---
💭 *LATEST (${state.persona || "LangGraph"}):*
_"${(state.latestThought || "—").replace(/"/g, "'").substring(0, 200)}"_`;

  if (state.lastKpiGate) {
    text += `\n\n🔒 *KPI*: \`${state.lastKpiGate.passRate}\` ${state.lastKpiGate.timestamp || ""}`;
  }
  if (state.metrics && (state.metrics.tokens || state.metrics.cost)) {
    text += `\n\n💰 Tokens: \`${state.metrics.tokens || "—"}\` • Cost: \`$${state.metrics.cost || "0.00"}\``;
  }
  text += `\n\n⏱️ *Runtime*: ${m}m ${s}s`;
  return text;
}

function sendToTelegram(text, state) {
  const config = loadConfig();
  const token = config.TELEGRAM_BOT_TOKEN;
  const chatId = config.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const payload = {
    chat_id: chatId,
    text: text.substring(0, 4000),
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };
  const runDir = path.dirname(DASHBOARD_FILE);
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
  const payloadPath = path.join(runDir, "tg_payload.json");
  fs.writeFileSync(payloadPath, JSON.stringify(payload));

  try {
    if (!state.messageId) {
      const response = JSON.parse(execSync(`curl -s -X POST https://api.telegram.org/bot${token}/sendMessage -H "Content-Type: application/json" -d @${payloadPath}`).toString());
      if (response.ok && response.result) {
        state.messageId = response.result.message_id;
        fs.writeFileSync(DASHBOARD_FILE, JSON.stringify(state, null, 2));
      }
    } else {
      payload.message_id = state.messageId;
      fs.writeFileSync(payloadPath, JSON.stringify(payload));
      execSync(`curl -s -X POST https://api.telegram.org/bot${token}/editMessageText -H "Content-Type: application/json" -d @${payloadPath}`);
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] 📡 Telegram error:`, e.message);
  }
}

/**
 * Merge partial state into dashboard file and push to Telegram.
 * @param {object} partial - Fields to merge (taskId, phases, latestThought, persona, lastKpiGate, metrics, etc.)
 */
export function updateDashboardAndPush(partial) {
  const state = readState();
  if (partial.phases) {
    state.phases = { ...state.phases, ...partial.phases };
    const rest = { ...partial };
    delete rest.phases;
    Object.assign(state, rest);
  } else {
    Object.assign(state, partial);
  }
  const dir = path.dirname(DASHBOARD_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DASHBOARD_FILE, JSON.stringify(state, null, 2));
  const text = renderPulse(state);
  sendToTelegram(text, state);
}
