const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = path.join(__dirname, '.run', 'telemetry_state.json');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Mute manager integration
const muteManager = require('./mute-manager');

// NEW: beautiful modular Telegram renderer
const tg = require('./telegram');

function updateDashboard(newState) {
    let state = {
        taskId: "Unknown",
        startTime: Date.now(),
        phases: {
            architect: { status: "⏳ Queued", time: "" },
            hammer: { status: "⏳ Queued", time: "" },
            checker: { status: "⏳ Queued", time: "" },
            medic: { status: "⏳ Queued", time: "" },
            skeptic: { status: "⏳ Queued", time: "" }
        },
        latestThought: "Waking up...",
        persona: "🤖 [SYSTEM]",
        messageId: null
    };

    if (fs.existsSync(STATE_FILE)) {
        try {
            state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch(e) {}
    }

    // Merge logic
    if (newState.phases) {
        state.phases = { ...state.phases, ...newState.phases };
        delete newState.phases;
    }
    Object.assign(state, newState);

    // PERSONA-BASED DATA ISOLATION (ANTI-GHOSTING)
    if (state.persona && state.persona.includes('[PLAYER]')) {
        // Force-clean the state to ONLY include Player data
        state.phases = {
            hammer: state.phases.hammer || { status: '🕹️ Active' }
        };
        // Clean up title
        if (state.taskId && state.taskId.includes('START_PLAYER_TRIP')) {
            state.taskId = state.taskId.replace('START_PLAYER_TRIP: ', '');
        }
    } else if (state.persona && state.persona.includes('[ORCHESTRATOR]')) {
        // Ensure scientific phases exist
        if (!state.phases.architect) {
            state.phases = {
                architect: { status: "⏳ Queued" },
                hammer: { status: "⏳ Queued" },
                checker: { status: "⏳ Queued" },
                medic: { status: "⏳ Queued" },
                skeptic: { status: "⏳ Queued" }
            };
        }
    }

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    renderDashboard(state);
}

function renderDashboard(state) {
    const payload = tg.renderAgency(state);
    sendToTelegram(payload.text, state, payload.reply_markup);
}

function sendToTelegram(text, state, reply_markup = null) {
    if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
    
    // Check global mute - skip sending if muted (except for forced updates, if ever)
    if (muteManager.isGloballyMuted()) {
        return; // silently skip
    }
    
    const payload = {
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
        ...(reply_markup && { reply_markup: JSON.stringify(reply_markup) })
    };

    const payloadPath = path.join(__dirname, '.run', 'tg_payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify(payload));

    try {
        let cmd = "";
        if (!state.messageId) {
            // Send new message
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage -H "Content-Type: application/json" -d @${payloadPath}`;
            const out = execSync(cmd).toString();
            const response = JSON.parse(out);
            if (response.ok) {
                state.messageId = response.result.message_id;
                fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
                
                // STORE in ledger for finding correlation
                if (state.findingId) {
                    try {
                        const ledger = require('./ledger');
                        ledger.storeTelegramMessageId(state.findingId, state.messageId, 'dashboard');
                        
                        // Create a state snapshot for later editing
                        const findingStateDir = path.join(__dirname, '.run', 'findings_state');
                        if (!fs.existsSync(findingStateDir)) fs.mkdirSync(findingStateDir, { recursive: true });
                        fs.writeFileSync(
                            path.join(findingStateDir, `${state.findingId}.json`),
                            JSON.stringify(state, null, 2)
                        );
                    } catch(e) {}
                }
            } else {
                fs.appendFileSync(path.join(__dirname, '.run', 'telemetry_error.log'), `[DASH][NEW] ${JSON.stringify(response)}\n`);
            }
        } else {
            // Edit existing message
            payload.message_id = state.messageId;
            fs.writeFileSync(payloadPath, JSON.stringify(payload));
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/editMessageText -H "Content-Type: application/json" -d @${payloadPath}`;
            const out = execSync(cmd).toString();
            const response = JSON.parse(out);
            if (!response.ok) {
                fs.appendFileSync(path.join(__dirname, '.run', 'telemetry_error.log'), `[DASH][EDIT] ${JSON.stringify(response)}\n`);
            }
        }
    } catch (e) {
        fs.appendFileSync(path.join(__dirname, '.run', 'telemetry_error.log'), `[DASH][EXEC] ${e.message}\n`);
    }
}

module.exports = { updateDashboard };
