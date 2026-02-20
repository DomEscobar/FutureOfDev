import { onTaskComplete, onTaskFail } from '@opencode/agent';
import * as fs from 'fs';
import * as path from 'path';

// Load credentials from local JSON to bypass environment variable issues
const credPath = path.join(__dirname, '../credentials.json');
let TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (fs.existsSync(credPath)) {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    TELEGRAM_TOKEN = creds.TELEGRAM_BOT_TOKEN || TELEGRAM_TOKEN;
    TELEGRAM_CHAT_ID = creds.TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID;
}

/**
 * OpenCode Telegram Notifier Plugin
 * Sends real-time task updates directly to Telegram.
 */
async function sendTelegram(message: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in environment.');
    return;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    if (!response.ok) {
        throw new Error(`Telegram API responded with ${response.status}`);
    }
  } catch (e) {
    console.error('Failed to send Telegram notification', e);
  }
}

// 🚀 STARTUP HANDSHAKE: Notify immediately when the agency initializes
(async () => {
    try {
        await sendTelegram("🤖 *Neural Core Initialized*\n\nAgency: EXECUTIVE-SWARM\nStatus: Online & Monitoring\n\n_Standing by for CEO instructions..._");
        console.log("Telegram startup notification sent.");
    } catch (e) {
        console.error("Failed to send startup notification:", e.message);
    }
})();

onTaskComplete(async (task) => {
  const summary = task.summary || task.description;
  const agentIcon = task.agent === 'architect' ? '🏛️' : task.agent === 'guardian' ? '🛡️' : task.agent === 'engine-core' ? '⚙️' : '🔍';
  await sendTelegram(`${agentIcon} *Agency Update: ${task.agent.toUpperCase()}*\n\n*Status:* Success\n*Task:* ${summary}\n\n_System Pulse: Operational_`);
});

onTaskFail(async (task, error) => {
  await sendTelegram(`🚨 *CRITICAL ALERT: ${task.agent.toUpperCase()}*\n\n*Failure:* ${error.message}\n*Context:* ${task.description}\n\n_Immediate Human Intervention Suggested_`);
});
