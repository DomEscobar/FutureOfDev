const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = path.join(__dirname, '.run', 'telemetry_state.json');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

function updateDashboard(newState) {
    let state = {
        taskId: "Unknown",
        startTime: Date.now(),
        phases: {
            architect: { status: "⏳ Queued", time: "" },
            backend: { status: "⏳ Queued", time: "" },
            frontend: { status: "⏳ Queued", time: "" },
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

    // Merge new state
    if (newState.phases) {
        state.phases = { ...state.phases, ...newState.phases };
        delete newState.phases;
    }
    Object.assign(state, newState);
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    renderDashboard(state);
}

function renderDashboard(state) {
    const elapsed = Math.round((Date.now() - state.startTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    
    // Calculate progress
    const phaseKeys = Object.keys(state.phases);
    const completed = phaseKeys.filter(k => state.phases[k].status.includes('✅')).length;
    const total = phaseKeys.length;
    const pct = Math.min(100, Math.round((completed / total) * 100));
    const progressText = `[${"█".repeat(Math.floor(pct/10))}${"░".repeat(10 - Math.floor(pct/10))}] ${pct}%`;

    let text = `🏛️ *AGENCY LIVE PULSE: ${state.taskId}*
${progressText}

📐 *ARCHITECT*: ${state.phases.architect.status} ${state.phases.architect.time}
🐹 *BACKEND*:  ${state.phases.backend.status} ${state.phases.backend.time}
🖼️ *FRONTEND*: ${state.phases.frontend.status} ${state.phases.frontend.time}
🩹 *MEDIC*:     ${state.phases.medic.status} ${state.phases.medic.time}
🧐 *SKEPTIC*:   ${state.phases.skeptic.status} ${state.phases.skeptic.time}

---
💭 *LATEST THOUGHT (${state.persona}):*
_"${state.latestThought}"_`;

    // IDEA #1 & #2: Economics & KPI Stats
    if (state.metrics) {
        text += `\n\n💰 *RUN ECONOMICS*
• Tokens: \`${state.metrics.tokens || 'Calculating...'}\`
• Est. Cost: \`$${state.metrics.cost || '0.00'}\`
• Refactor Loops: \`${state.metrics.loops || 0}\`

✅ *QUALITY SCOREBOARD*
• TS/Lint: \`${state.metrics.quality || 'Pending'}\`
• Tests: \`${state.metrics.tests || 'Waiting'}\``;
    }

    text += `\n\n⏱️ *Total Runtime*: ${m}m ${s}s`;

    sendToTelegram(text, state);
}

function sendToTelegram(text, state) {
    if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
    
    const payload = {
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "Markdown",
        disable_web_page_preview: true
    };

    const payloadPath = path.join(__dirname, '.run', 'tg_payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify(payload));

    try {
        let cmd = "";
        if (!state.messageId) {
            // Send new message
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage -H "Content-Type: application/json" -d @${payloadPath}`;
            const response = JSON.parse(execSync(cmd).toString());
            if (response.ok) {
                state.messageId = response.result.message_id;
                fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
            }
        } else {
            // Edit existing message
            payload.message_id = state.messageId;
            fs.writeFileSync(payloadPath, JSON.stringify(payload));
            cmd = `curl -s -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/editMessageText -H "Content-Type: application/json" -d @${payloadPath}`;
            execSync(cmd);
        }
    } catch (e) {
        // Silently fail or log to file
    }
}

module.exports = { updateDashboard };
