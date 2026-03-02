#!/usr/bin/env node
/**
 * Agency DOD runner MCP server (stdio).
 * Tool: run_dod_checks(workspaceDir, scope?) -> { passed, results, artifactResults }
 * Used by orchestrator when AGENCY_DOD_MCP=1.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function simpleGlob(pattern, cwd) {
    const base = path.dirname(pattern);
    const name = path.basename(pattern);
    const dir = path.resolve(cwd, base);
    if (!fs.existsSync(dir)) return [];
    const re = new RegExp('^' + name.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return fs.readdirSync(dir).filter(f => re.test(f)).map(f => path.join(base, f));
}

function loadProjectDOD(workspaceDir) {
    const agencyPath = path.join(workspaceDir, 'agency.json');
    const dodPath = path.join(workspaceDir, '.agency', 'dod.json');
    let raw = null;
    if (fs.existsSync(agencyPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(agencyPath, 'utf8'));
            if (data.definitionOfDone) raw = data.definitionOfDone;
        } catch (_) {}
    }
    if (!raw && fs.existsSync(dodPath)) {
        try {
            raw = JSON.parse(fs.readFileSync(dodPath, 'utf8'));
        } catch (_) {}
    }
    if (!raw) return null;
    const artifacts = Array.isArray(raw.artifacts) ? raw.artifacts : [];
    const checks = Array.isArray(raw.checks) ? raw.checks : [];
    const gate = raw.gate || 'all';
    return { artifacts, checks, gate };
}

function filterChecksByScope(checks, scope) {
    if (!scope || scope === 'full' || scope === 'unknown') return checks;
    return checks.filter(c => {
        const cwd = (c.cwd || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        if (scope === 'frontend_only') return cwd.includes('frontend') || id.includes('frontend');
        if (scope === 'backend_only') return cwd.includes('backend') || id.includes('backend');
        if (scope === 'doc_only') return (c.scope === 'doc') || id.includes('doc');
        return true;
    });
}

function runOneCheck(check, workspaceDir) {
    return new Promise((resolve) => {
        const cwd = check.cwd ? path.join(workspaceDir, check.cwd) : workspaceDir;
        const proc = spawn(check.command, [], { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            resolve({ id: check.id, passed: code === 0, stderr: stderr.slice(0, 500) });
        });
        proc.on('error', e => {
            resolve({ id: check.id, passed: false, stderr: (e.message || '').slice(0, 500) });
        });
    });
}

function runDodChecks(workspaceDir, scope) {
    const dod = loadProjectDOD(workspaceDir);
    if (!dod) {
        return Promise.resolve({ passed: true, results: [], artifactResults: {}, message: 'No project DOD; gate skipped.' });
    }
    const checks = filterChecksByScope(dod.checks, scope);
    const resultPromises = checks.map(c => runOneCheck(c, workspaceDir));
    return Promise.all(resultPromises).then(results => {
        const artifactResults = {};
        const requiredArtifacts = (dod.artifacts || []).filter(a => !a.optional);
        const optionalArtifacts = (dod.artifacts || []).filter(a => a.optional);
        for (const a of requiredArtifacts) {
            const matches = simpleGlob(a.path, workspaceDir);
            artifactResults[a.path] = { passed: matches.length > 0 };
        }
        for (const a of optionalArtifacts) {
            artifactResults[a.path] = { passed: true, optional: true };
        }
        const allArtifactsPass = requiredArtifacts.every(ar => artifactResults[ar.path]?.passed !== false);
        const checkPassCount = results.filter(r => r.passed).length;
        let passed = false;
        if (dod.gate === 'all') {
            passed = checkPassCount === results.length && allArtifactsPass;
        } else if (dod.gate === 'any') {
            passed = checkPassCount >= 1 && allArtifactsPass;
        } else {
            passed = allArtifactsPass;
        }
        return { passed, results, artifactResults };
    });
}

function send(id, result, error = null) {
    const msg = error
        ? { jsonrpc: '2.0', id, error: { code: -32603, message: error.message || 'Internal error' } }
        : { jsonrpc: '2.0', id, result };
    process.stdout.write(JSON.stringify(msg) + '\n');
}

const tools = [
    {
        name: 'run_dod_checks',
        description: 'Run project Definition of Done checks in the given workspace. Returns pass/fail and per-check results.',
        inputSchema: {
            type: 'object',
            properties: {
                workspaceDir: { type: 'string', description: 'Absolute path to workspace root' },
                scope: { type: 'string', enum: ['full', 'frontend_only', 'backend_only', 'doc_only'], description: 'Optional scope to filter checks' }
            },
            required: ['workspaceDir']
        }
    }
];

async function handleToolsCall(args) {
    const name = args?.name;
    const toolArgs = args?.arguments || {};
    if (name !== 'run_dod_checks') {
        throw new Error(`Unknown tool: ${name}`);
    }
    const workspaceDir = path.resolve(toolArgs.workspaceDir || '');
    const scope = toolArgs.scope || 'full';
    if (!fs.existsSync(workspaceDir)) {
        return { content: [{ type: 'text', text: JSON.stringify({ passed: false, results: [], artifactResults: {}, error: 'Workspace not found' }) }], isError: true };
    }
    const out = await runDodChecks(workspaceDir, scope);
    return {
        content: [{ type: 'text', text: JSON.stringify(out) }]
    };
}

async function main() {
    const rl = await import('readline').then(m => m.createInterface({ input: process.stdin }));
    for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let req;
        try {
            req = JSON.parse(trimmed);
        } catch (_) {
            continue;
        }
        const { id, method, params } = req;
        if (method === 'initialize') {
            send(id, {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'agency-dod-runner', version: '1.0' }
            });
        } else if (method === 'tools/list') {
            send(id, { tools });
        } else if (method === 'tools/call') {
            try {
                const result = await handleToolsCall(params);
                send(id, result);
            } catch (e) {
                send(id, null, e);
            }
        } else {
            send(id, null, new Error(`Unknown method: ${method}`));
        }
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
