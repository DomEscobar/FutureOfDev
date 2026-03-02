import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { WORKSPACE, OPENCODE_ROOT } from "../../config.js";

const OPENCODE_BIN = process.env.OPENCODE_BIN || "/root/.opencode/bin/opencode";

const ROLE_TO_AGENT = {
  architect: "dev-unit",
  hammer: "dev-unit",
  checker: "code-reviewer",
  skeptic: "code-reviewer",
  medic: "dev-unit",
};

function loadSoul(role) {
  const soulPath = path.join(OPENCODE_ROOT, "roster", role, "SOUL.md");
  if (fs.existsSync(soulPath)) {
    return fs.readFileSync(soulPath, "utf8");
  }
  return "";
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function parseJsonEvents(raw) {
  const lines = raw.split("\n").filter(Boolean);
  const textParts = [];
  const toolCalls = [];
  let cost = 0;
  let tokens = {};

  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === "text" && evt.part?.text) {
        textParts.push(evt.part.text);
      } else if (evt.type === "tool_call" && evt.part) {
        toolCalls.push({ tool: evt.part.tool, args: evt.part.args });
      } else if (evt.type === "step_finish" && evt.part) {
        cost += evt.part.cost || 0;
        tokens = evt.part.tokens || tokens;
      }
    } catch {
      // non-JSON line, skip
    }
  }

  return {
    text: textParts.join(""),
    toolCalls,
    cost,
    tokens,
  };
}

/**
 * Runs an opencode roster role via `opencode run --agent <agent> --dir <workspace>`.
 * Uses --format json for clean, parseable output. SOUL.md is prepended as context.
 */
export function runOpencodeRole(role, message, phase = "") {
  return new Promise((resolve) => {
    const agent = ROLE_TO_AGENT[role] || "dev-unit";
    const soul = loadSoul(role);
    const fullMessage = soul
      ? `${soul}\n\n---\n\nTASK:\n${message}`
      : message;

    log(`[${role}] invoking opencode agent="${agent}" dir="${WORKSPACE}"`);

    const proc = spawn(OPENCODE_BIN, [
      "run",
      "--agent", agent,
      "--dir", WORKSPACE,
      "--format", "json",
      fullMessage,
    ], {
      cwd: WORKSPACE,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AGENT_PHASE: phase, AGENCY_ROOT: OPENCODE_ROOT },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      const chunk = d.toString();
      stdout += chunk;
    });

    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      const parsed = parseJsonEvents(stdout);
      log(`[${role}] exit=${code} cost=$${parsed.cost.toFixed(4)} tokens=${JSON.stringify(parsed.tokens)}`);
      if (parsed.text) {
        log(`[${role}] response: ${parsed.text.slice(0, 500)}`);
      }
      if (parsed.toolCalls.length > 0) {
        log(`[${role}] tool calls: ${parsed.toolCalls.map(t => t.tool).join(", ")}`);
      }

      resolve({
        code: code ?? 1,
        output: parsed.text || stderr,
        toolCalls: parsed.toolCalls,
        cost: parsed.cost,
        tokens: parsed.tokens,
      });
    });

    proc.on("error", (err) => {
      log(`[${role}] spawn error: ${err.message}`);
      resolve({ code: 1, output: err.message, toolCalls: [], cost: 0, tokens: {} });
    });
  });
}
