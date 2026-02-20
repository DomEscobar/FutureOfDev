import { onTaskComplete, onTaskFail } from '@opencode/agent';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

onTaskComplete(async (task) => {
  const summary = task.summary || task.description;
  const agentIcon = task.agent === 'architect' ? '🏛️' : task.agent === 'guardian' ? '🛡️' : task.agent === 'engine-core' ? '⚙️' : '🔍';
  await sendTelegram(`${agentIcon} *Agency Update: ${task.agent.toUpperCase()}*\n\n*Status:* Success\n*Task:* ${summary}\n\n_System Pulse: Operational_`);
});

onTaskFail(async (task, error) => {
  await sendTelegram(`🚨 *CRITICAL ALERT: ${task.agent.toUpperCase()}*\n\n*Failure:* ${error.message}\n*Context:* ${task.description}\n\n_Immediate Human Intervention Suggested_`);
});
