import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUTURE_ROOT = path.resolve(__dirname, "..");

export const OPENCODE_ROOT = process.env.AGENCY_HOME || path.join(FUTURE_ROOT, "opencode");
export const WORKSPACE = process.env.WORKSPACE || path.join(FUTURE_ROOT, "..", "Erp_dev_bench-1");
export const DASHBOARD_FILE = path.join(OPENCODE_ROOT, ".run", "telemetry_state.json");
export const DEV_UNIT_PATH = path.join(OPENCODE_ROOT, "dev-unit.cjs");
export const TASKS_DIR = path.join(OPENCODE_ROOT, "tasks");
