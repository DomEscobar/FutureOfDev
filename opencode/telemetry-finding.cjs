const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const muteManager = require('./mute-manager');
const tg = require('./telegram');
const ledger = require('./ledger');

function sendFinding(findingId, status = 'NEW') {
    if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
    if (muteManager.isGloballyMuted()) return;

    const finding = ledger.getFinding(findingId);
    if (!finding) return;

    // Use the player finding data for the card
    const findingData = {
        id: findingId,
        title: finding.player.title,
        severity: finding.player.severity,
        page: finding.player.url,
        element: finding.player.raw.element || 'N/A',
        recommendation: finding.player.raw.recommendation || 'Fix it.',
        timestamp: finding.created
    };

    const payload = tg.renderFinding(findingData, status);
    
    // Check if we already have a message ID for this finding card
    const existingMessageId = ledger.getTelegramMessageId(findingId, 'card');

    const tgPayload = {
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: payload.text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
        reply_markup: payload.reply_markup
    };

    const payloadPath = path.join(__dirname, '.run', `tg_finding_${findingId}.json`);
    const runDir = path.dirname(payloadPath);
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
    
    fs.writeFileSync(payloadPath, JSON.stringify(tgPayload));

    try {
        let cmd = "";
        if (!existingMessageId) {
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage -H "Content-Type: application/json" -d @${payloadPath}`;
            const response = JSON.parse(execSync(cmd).toString());
            if (response.ok) {
                ledger.storeTelegramMessageId(findingId, response.result.message_id, 'card');
            }
        } else {
            tgPayload.message_id = existingMessageId;
            fs.writeFileSync(payloadPath, JSON.stringify(tgPayload));
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/editMessageText -H "Content-Type: application/json" -d @${payloadPath}`;
            execSync(cmd);
        }
    } catch (e) {
        console.error('[telemetry-finding] Telegram error:', e.message);
    }
}

module.exports = { sendFinding };
