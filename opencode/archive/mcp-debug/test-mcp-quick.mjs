import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function log(...args) { console.log('[TEST]', ...args); }

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
        setTimeout(() => reject(new Error('timeout')), 15000);
    });
}

(async () => {
    try {
        log('Initialize...');
        await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test' } });
        log('Initialized');

        log('Navigate...');
        await call('tools/call', { name: 'browser_navigate', arguments: { url: 'http://localhost:5173' } });
        log('Navigated');

        log('Wait 3s...');
        await new Promise(r => setTimeout(r, 3000));

        log('Screenshot (no file)...');
        const shotResp = await call('tools/call', { name: 'browser_take_screenshot', arguments: {} });
        log('Screenshot response:', JSON.stringify(shotResp).substring(0, 300));

        log('Close...');
        await call('tools/call', { name: 'browser_close', arguments: {} });
        log('Closed');
    } catch (e) {
        log('Error:', e.message);
    } finally {
        mcp.kill('SIGTERM');
    }
})();
