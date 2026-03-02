const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = path.join(__dirname, '.run', 'player_telemetry_state.json');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Mute manager
const muteManager = require('./mute-manager');

// Beautiful modular renderer (shared)
const tg = require('./telegram');

function updatePlayerDashboard(newState) {
    // Fresh state template for Player Sessions ONLY
    let state = {
        taskId: "Unknown Session",
        startTime: Date.now(),
        taskType: 'PLAYER_SESSION',
        persona: '🕹️ [PLAYER]',
        messageId: null,
        phases: { 
            hammer: { status: '🕹️ Booting Virtual Machine...' } 
        },
        metrics: { 
            cost: "0.00", 
            loops: 0, 
            quality: "Analyzing UI..." 
        },
        latestThought: "Initiating neural link to game engine...",
        ...newState
    };

    // Load previous state if exists (for updates)
    if (fs.existsSync(STATE_FILE)) {
        try {
            state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch(e) {}
    }

    // Merge
    Object.assign(state, newState);

    // Save state
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    renderPlayerDashboard(state);
}

function renderPlayerDashboard(state) {
    const payload = tg.renderPlayer(state);
    sendToTelegram(payload.text, state, payload.reply_markup);
}

function sendToTelegram(text, state, reply_markup = null) {
    if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
    
    // Respect global mute
    if (muteManager.isGloballyMuted()) {
        return;
    }
    
    const payload = {
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
        ...(reply_markup && { reply_markup: JSON.stringify(reply_markup) })
    };

    const payloadPath = path.join(__dirname, '.run', 'tg_player_payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify(payload));

    try {
        let cmd = "";
        if (!state.messageId) {
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage -H "Content-Type: application/json" -d @${payloadPath}`;
            const out = execSync(cmd).toString();
            const response = JSON.parse(out);
            if (response.ok) {
                state.messageId = response.result.message_id;
                fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
            } else {
                fs.appendFileSync(path.join(__dirname, '.run', 'telemetry_error.log'), `[PLAYER][NEW] ${JSON.stringify(response)}\n`);
            }
        } else {
            payload.message_id = state.messageId;
            fs.writeFileSync(payloadPath, JSON.stringify(payload));
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/editMessageText -H "Content-Type: application/json" -d @${payloadPath}`;
            const out = execSync(cmd).toString();
            const response = JSON.parse(out);
            if (!response.ok) {
                fs.appendFileSync(path.join(__dirname, '.run', 'telemetry_error.log'), `[PLAYER][EDIT] ${JSON.stringify(response)}\n`);
            }
        }
    } catch (e) {
        fs.appendFileSync(path.join(__dirname, '.run', 'telemetry_error.log'), `[PLAYER][EXEC] ${e.message}\n`);
    }
}

module.exports = { updatePlayerDashboard };
