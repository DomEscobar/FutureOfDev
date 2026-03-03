import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
                console.error('MCP Error:', msg.error);
            }
        } catch (e) {}
    }
});

function call(method, params) {
    const id = ++requestId;
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolve) => pending.set(id, { resolve }));
}

(async () => {
    await call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' }
    });
    console.log('Initialized');

    // List tools
    const tools = await call('tools/list');
    console.log('Tools:', JSON.stringify(tools, null, 2).slice(0, 2000));

    // Navigate
    await call('tools/call', { name: 'browser_navigate', arguments: { url: 'http://localhost:5173' } });
    console.log('Navigated');

    // Wait
    await new Promise(r => setTimeout(r, 3000));

    // Snapshot
    const snap = await call('tools/call', { name: 'browser_snapshot', arguments: {} });
    console.log('Snapshot length:', snap?.full?.length || 0);

    // Screenshot
    await call('tools/call', { name: 'browser_take_screenshot', arguments: { filename: '/tmp/test.png' } });
    console.log('Screenshot taken');

    mcp.kill('SIGTERM');
    process.exit(0);
})().catch(e => {
    console.error(e);
    mcp.kill('SIGTERM');
    process.exit(1);
});
