/**
 * Agency task classifier — LLM-only, no regex.
 * Returns { taskType, scope } for routing.
 */

const fs = require('fs');
const path = require('path');

const TASK_TYPES = ['FEATURE', 'FIX', 'DOC', 'VERIFY', 'EXPLORE', 'UNKNOWN'];
const SCOPES = ['full', 'frontend_only', 'backend_only', 'doc_only', 'unknown'];

function getApiKey() {
    if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            const c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return c.OPENROUTER_API_KEY || null;
        } catch (_) {}
    }
    return null;
}

async function callLLM(messages) {
    const apiKey = getApiKey();
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
    return (data.choices?.[0]?.message?.content || '{}').trim();
}

function parseResult(text) {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const out = JSON.parse(cleaned);
    const taskType = TASK_TYPES.includes(out.taskType) ? out.taskType : 'UNKNOWN';
    const scope = SCOPES.includes(out.scope) ? out.scope : 'full';
    return { taskType, scope };
}

/**
 * @param {{ description: string, name?: string, requirements?: object, expected_behavior?: string }} task
 * @returns {Promise<{ taskType: string, scope: string }>}
 */
async function classifyTask(task) {
    const description = task.description || '';
    const name = task.name || '';
    const requirements = task.requirements != null ? JSON.stringify(task.requirements) : 'none';
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

    try {
        const text = await callLLM([{ role: 'user', content: prompt }]);
        return parseResult(text);
    } catch (e) {
        return { taskType: 'UNKNOWN', scope: 'full' };
    }
}

module.exports = { classifyTask, parseResult, TASK_TYPES, SCOPES };
