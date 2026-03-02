import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { updatePlayerDashboard } = require('./telemetry-player.cjs');

const CONFIG = JSON.parse(require('fs').readFileSync('/root/FutureOfDev/opencode/config.json', 'utf8'));
const OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

async function callLLM(messages) {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'openrouter/stepfun/step-3.5-flash',
            messages,
            max_tokens: 100
        })
    });
    if (!resp.ok) throw new Error(`LLM ${resp.status}`);
    const data = await resp.json();
    return data.choices[0].message.content;
}

async function main() {
    console.log('[TEST] Spawning MCP...');
    const mcp = spawn('node', [
        '/root/FutureOfDev/opencode/node_modules/@playwright/mcp/cli.js',
        '--browser=chromium',
        '--headless'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let requestId = 0;
    const pending = new Map();
    mcp.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const msg = JSON.parse(line);
                if (msg.id && pending.has(msg.id)) {
                    const { resolve } = pending.get(msg.id);
                    resolve(msg.result);
                    pending.delete(msg.id);
                } else if (msg.error) {
                    console.error('[MCP-ERR]', msg.error);
                }
            } catch (e) {}
        }
    });

    function call(method, params) {
        const id = ++requestId;
        mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        return new Promise((resolve) => pending.set(id, { resolve }));
    }

    console.log('[TEST] Initialize...');
    await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test' } });
    console.log('[TEST] Initialized');

    console.log('[TEST] Navigate...');
    await call('tools/call', { name: 'browser_navigate', arguments: { url: 'http://localhost:5173' } });
    console.log('[TEST] Navigated');

    console.log('[TEST] Wait 5s...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('[TEST] Snapshot...');
    const snap = await call('tools/call', { name: 'browser_snapshot', arguments: {} });
    console.log('[TEST] Snapshot got, length:', snap?.full?.length || 0);

    console.log('[TEST] Screenshot...');
    await call('tools/call', { name: 'browser_take_screenshot', arguments: { filename: '/tmp/test-step1.png' } });
    console.log('[TEST] Screenshot saved');

    console.log('[TEST] LLM analyze...');
    const llmText = await callLLM([
        { role: 'system', content: 'You are a UX auditor. Return JSON with one issue if you see any, empty array otherwise. Format: {"issues":[]}' },
        { role: 'user', content: `Page: http://localhost:5173\n\n${snap.full?.substring(0, 2000) || 'no snapshot'}` }
    ]);
    console.log('[TEST] LLM response:', llmText.substring(0, 200));

    mcp.kill('SIGTERM');
    console.log('[TEST] Done');
}

main().catch(e => {
    console.error('[FATAL]', e);
    process.exit(1);
});
