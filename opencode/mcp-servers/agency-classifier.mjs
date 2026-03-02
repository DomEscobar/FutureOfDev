#!/usr/bin/env node
/**
 * Agency Classifier MCP server (stdio).
 * Tool: classify_task(task) -> { taskType, scope }
 * Used by orchestrator when AGENCY_CLASSIFIER_MCP=1.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

let apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey && fs.existsSync(CONFIG_PATH)) {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        apiKey = config.OPENROUTER_API_KEY;
    } catch (_) {}
}

const TASK_TYPES = ['FEATURE', 'FIX', 'DOC', 'VERIFY', 'EXPLORE', 'UNKNOWN'];
const SCOPES = ['full', 'frontend_only', 'backend_only', 'doc_only', 'unknown'];

async function callLLM(messages) {
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: process.env.AGENCY_CLASSIFIER_MODEL || 'openrouter/stepfun/step-3.5-flash',
            messages,
            max_tokens: 150,
            response_format: { type: 'json_object' }
        })
    });
    if (!resp.ok) throw new Error(`LLM ${resp.status}`);
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '{}';
    return text;
}

function parseResult(text) {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const out = JSON.parse(cleaned);
    const taskType = TASK_TYPES.includes(out.taskType) ? out.taskType : 'UNKNOWN';
    const scope = SCOPES.includes(out.scope) ? out.scope : 'full';
    return { taskType, scope };
}

async function classifyTask(task) {
    const description = task.description || '';
    const name = task.name || '';
    const requirements = task.requirements ? JSON.stringify(task.requirements) : 'none';
    const expectedBehavior = task.expected_behavior || '';

    const prompt = `Classify this development task. Return ONLY a JSON object with two keys: "taskType" and "scope".

taskType must be one of: ${TASK_TYPES.join(', ')}
- FEATURE: new capability or feature
- FIX: bug fix or defect
- DOC: documentation only
- VERIFY: verify something without code change
- EXPLORE: exploration or informational
- UNKNOWN: unclear

scope must be one of: ${SCOPES.join(', ')}

Task description: ${description}
${name ? `Task name: ${name}` : ''}
${requirements !== 'none' ? `Requirements: ${requirements}` : ''}
${expectedBehavior ? `Expected behavior: ${expectedBehavior}` : ''}

Return JSON: {"taskType":"...","scope":"..."}`;

    const text = await callLLM([
        { role: 'user', content: prompt }
    ]);
    return parseResult(text);
}

function send(id, result, error = null) {
    const msg = error
        ? { jsonrpc: '2.0', id, error: { code: -32603, message: error.message || 'Internal error' } }
        : { jsonrpc: '2.0', id, result };
    process.stdout.write(JSON.stringify(msg) + '\n');
}

const tools = [
    {
        name: 'classify_task',
        description: 'Classify a development task into taskType and scope for agency routing.',
        inputSchema: {
            type: 'object',
            properties: {
                description: { type: 'string', description: 'Task description' },
                name: { type: 'string', description: 'Optional task name' },
                requirements: { type: 'object', description: 'Optional requirements e.g. { backend: true }' },
                expected_behavior: { type: 'string', description: 'Optional expected behavior' }
            },
            required: ['description']
        }
    }
];

async function handleToolsCall(args) {
    const name = args?.name;
    const toolArgs = args?.arguments || {};
    if (name !== 'classify_task') {
        throw new Error(`Unknown tool: ${name}`);
    }
    try {
        const out = await classifyTask(toolArgs);
        return {
            content: [{ type: 'text', text: JSON.stringify(out) }]
        };
    } catch (e) {
        return {
            content: [{ type: 'text', text: JSON.stringify({ taskType: 'UNKNOWN', scope: 'full' }) }],
            isError: true
        };
    }
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
                serverInfo: { name: 'agency-classifier', version: '1.0' }
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
