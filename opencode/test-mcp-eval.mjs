import { spawn } from 'child_process';

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
                pending.get(msg.id).resolve(msg.result);
                pending.delete(msg.id);
            }
        } catch (e) {}
    }
});

function call(method, params) {
    const id = ++requestId;
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        setTimeout(() => reject(new Error('timeout')), 10000);
    });
}

(async () => {
    try {
        console.log('[TEST] init');
        await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test' } });
        console.log('[TEST] initialized');

        console.log('[TEST] navigate');
        await call('tools/call', { name: 'browser_navigate', arguments: { url: 'http://localhost:5173' } });
        console.log('[TEST] navigated');

        await new Promise(r => setTimeout(r, 3000));

        console.log('[TEST] evaluate title');
        const r = await call('tools/call', { name: 'browser_evaluate', arguments: { expression: 'document.title' } });
        console.log('[TEST] eval result:', JSON.stringify(r).substring(0, 200));

        console.log('[TEST] close');
        await call('tools/call', { name: 'browser_close', arguments: {} });
        console.log('[TEST] closed');
    } catch (e) {
        console.error('[TEST] error:', e.message);
    } finally {
        mcp.kill('SIGTERM');
    }
})();
