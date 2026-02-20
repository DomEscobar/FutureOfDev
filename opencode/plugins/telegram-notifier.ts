import { onTaskComplete, onTaskFail } from '@opencode/agent';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.resolve(process.cwd(), 'config.json');

function getCreds() {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
            token: config.TELEGRAM_BOT_TOKEN,
            chatId: config.TELEGRAM_CHAT_ID
        };
    } catch (e) {
        return null;
    }
}

function sendTelegramSync(message: string) {
    const creds = getCreds();
    if (!creds || !creds.token || !creds.chatId) return;

    const escapedMsg = JSON.stringify(message).slice(1, -1);
    const escapedToken = JSON.stringify(creds.token).slice(1, -1);
    const escapedChatId = JSON.stringify(creds.chatId).slice(1, -1);

    const MAX_MESSAGE_LENGTH = 4096;
    const truncatedMsg = escapedMsg.length > MAX_MESSAGE_LENGTH
        ? escapedMsg.substring(0, MAX_MESSAGE_LENGTH - 50) + "... [truncated]"
        : escapedMsg;

    try {
        const cmd = `curl -s -X POST "https://api.telegram.org/bot${escapedToken}/sendMessage" -d "chat_id=${escapedChatId}&text=${truncatedMsg}&parse_mode=Markdown"`;
        execSync(cmd, { stdio: 'ignore' });
    } catch (e) {
        console.error(`[TelegramNotifier] Failed to send message: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}

onTaskComplete(async (task) => {
    const summary = task.summary || task.description;
    sendTelegramSync(`*Agency: ${task.agent.toUpperCase()}*\nStatus: Success\nTask: ${summary}`);
});

onTaskFail(async (task, error) => {
    sendTelegramSync(`*ALERT: ${task.agent.toUpperCase()}*\nFailure: ${error.message}\nContext: ${task.description}`);
});
