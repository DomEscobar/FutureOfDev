import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { updatePlayerDashboard } = require('./telemetry-player.cjs');

const CONFIG = JSON.parse(require('fs').readFileSync('/root/FutureOfDev/opencode/config.json', 'utf8'));
const OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

function log(...args) { console.log('[TEST]', ...args); }

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
    log('Spawning MCP...');
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
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
        });
    }

    log('Initialize...');
    await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test' } });
    log('Initialized');

    log('Navigate...');
    await call('tools/call', { name: 'browser_navigate', arguments: { url: 'http://localhost:5173' } });
    log('Navigated');

    log('Wait 5s...');
    await new Promise(r => setTimeout(r, 5000));

    log('Snapshot...');
    const snapResp = await call('tools/call', { name: 'browser_snapshot', arguments: {} });
    log('Snapshot response:', JSON.stringify(snapResp).substring(0, 500));
    const snapFull = snapResp?.full || (snapResp?.content?.[0]?.text) || '';
    log('Snapshot length:', snapFull.length);

    log('Screenshot...');
    const shotResp = await call('tools/call', { name: 'browser_take_screenshot', arguments: { filename: '/tmp/test-step1.png' } });
    log('Screenshot response:', JSON.stringify(shotResp).substring(0, 200));

    log('Done');
    mcp.kill('SIGTERM');
}

main().catch(e => {
    console.error('[FATAL]', e);
    process.exit(1);
});
