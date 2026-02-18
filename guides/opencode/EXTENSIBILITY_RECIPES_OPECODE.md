# OpenCode Extensibility Recipes

This guide provides concrete recipes for extending OpenCode: custom tools, MCP server integration, skill scaffolding, and loop hooks. All examples are ready to drop into a project.

---

## 1. Custom Tool Registration

### 1.1 Basic Tool
Create `plugins/my-tool.ts`:
```typescript
import { tool } from '@opencode/agent';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

tool({
  name: 'run_localtests',
  description: 'Run project tests and return summary',
  parameters: {
    type: 'object',
    properties: {
      coverage: { type: 'boolean', description: 'Collect coverage' }
    }
  }
}, async (params) => {
  const { coverage } = params;
  const cmd = coverage ? 'npm run test:coverage' : 'npm test';
  const { stdout, stderr } = await execAsync(cmd, { cwd: process.env.AGENT_WORKDIR });
  return { output: stdout, error: stderr };
});
```

Enable in `opencode.config.ts`:
```ts
plugins: ['my-tool']
```
Now `/tool run_localtests` is available.

---

## 2. MCP Server Integration

### 2.1 Connect a Filesystem MCP Server
Install an MCP filesystem server:
```bash
npm install -g @modelcontextprotocol/server-filesystem
```
Configure in `opencode.config.ts`:
```ts
mcpServers: {
  fs: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.env.AGENT_WORKDIR],
    transport: 'stdio'
  }
};
```
OpenCode will start the server and can now use its tools (e.g., `list_files`, `read_file`) transparently as part of its reasoning.

### 2.2 Connect a Web Search MCP Server
Run a web search MCP server locally (e.g., `exa-mcp-server`):
```ts
mcpServers: {
  web: {
    url: 'http://localhost:3001/sse',
    transport: 'sse'
  }
};
```
Now OpenCode can call `web_search` as a tool if the server exposes it.

---

## 3. Skill Scaffolding

OpenCode skills are isolated modules with a `skill.yaml` manifest. Use the CLI to generate:

```bash
opencode skills create security-audit
```

This creates:
```
skills/security-audit/
├── skill.yaml
├── README.md
└── src/
    └── index.ts
```

`skill.yaml` example:
```yaml
name: security-audit
description: Run static security analysis (Snyk, OWASP) and report findings
version: 0.1.0
tools:
  - security_audit
  - dependency_check
```

`src/index.ts`:
```ts
import { tool } from '@opencode/agent';

tool({
  name: 'security_audit',
  description: 'Run security scanners and summarize findings'
}, async () => {
  const { stdout } = await exec('snyk test --json');
  const findings = JSON.parse(stdout);
  return { findings };
});

tool({
  name: 'dependency_check',
  description: 'Check for vulnerable dependencies (npm audit)'
}, async () => {
  const { stdout } = await exec('npm audit --json');
  const audit = JSON.parse(stdout);
  return { audit };
});
```

Install the skill:
```bash
opencode skills install ./skills/security-audit
```
It becomes available as `/tool security_audit` and `/tool dependency_check`.

---

## 4. Loop Extension Points

OpenCode’s main loop can be extended via hooks.

### 4.1 Pre‑Prompt Hook
Runs before every user message is sent to the LLM. Useful for injecting dynamic context.

`plugins/pre-prompt.ts`:
```ts
import { onBeforePrompt } from '@opencode/agent';

onBeforePrompt(async (context) => {
  // Append latest git status
  const { stdout } = await exec('git status --porcelain');
  context.system += `\nGit status:\n${stdout}`;
});
```

### 4.2 Post‑Response Hook
Runs after the LLM response but before execution.

```ts
import { onAfterResponse } from '@opencode/agent';

onAfterAfterResponse(async (response) => {
  // Log token usage to external metrics
  const usage = response.usage;
  await fetch('https://metrics.example.com/opencode', {
    method: 'POST',
    body: JSON.stringify(usage)
  });
});
```

### 4.3 Tool Invocation Hook
Intercept tool calls to add logging or approval.

```ts
import { onToolCall } from '@opencode/agent';

onToolCall(async (toolName, params) => {
  console.log(`Tool called: ${toolName}`, params);
  // Optionally require approval for destructive tools
  if (toolName === 'delete_file') {
    throw new Error('File deletion blocked by policy');
  }
});
```

---

## 5. Capability Extensions

Add new capabilities (custom agents) that run alongside the main agent.

`plugins/custom-agent.ts`:
```ts
import { registerAgent } from '@opencode/agent';

registerAgent({
  name: 'tester',
  description: 'Runs tests and reports results',
  capabilities: ['test-generation', 'qa'],
  async execute(task) {
    // Use OpenCode’s LLM internally or call out to a separate model
    const result = await runLLM(`Write tests for: ${task.description}`);
    return { success: true, output: result };
  }
});
```
Now you can assign tasks to this agent via the director (if using multi-agent mode).

---

## 6. Example: Benchmark Skill with MCP

Combine MCP and a custom tool to run benchmarks and store results in a vector store.

`plugins/benchmark-mcp.ts`:
```ts
import { tool } from '@opencode/agent';
import { createClient } from '@pinecone-database/pinecone';

tool({
  name: 'benchmark_and_store',
  description: 'Run a performance benchmark and store results in Pinecone'
}, async (params) => {
  const { target } = params;
  // 1. Use MCP filesystem to read source files of target
  const fs = mcp.getServer('fs'); // assumes fs MCP connected
  const files = await fs.list_files({ path: `src/${target}` });

  // 2. Run benchmark script
  const { stdout } = await exec(`npm run bench:${target}`);
  const score = parseBenchmark(stdout);

  // 3. Store in Pinecone for later retrieval
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pc.index('benchmarks');
  await index.upsert([{
    id: `${target}-${Date.now()}`,
    values: vectorize(score, files),
    metadata: { target, score, files: files.map(f => f.path) }
  }]);

  return { stored: true, id: target };
});
```
This recipe demonstrates MCP usage, external API integration, and vector storage.

---

## 7. Loop Extension: Auto‑Retry with Backoff

Create a wrapper that automatically retries failing tasks with exponential backoff.

`plugins/auto-retry.ts`:
```ts
import { onTaskFail } from '@opencode/agent';

onTaskFail(async (task, error) => {
  if (task.retryCount < 3 && isTransient(error)) {
    const delay = 2000 * Math.pow(2, task.retryCount);
    await new Promise(r => setTimeout(r, delay));
    throw new Error('RETRY'); // Signal OpenCode to re-queue
  }
});
```
This pattern makes OpenCode resilient to transient network glitches.

---

## 8. Loop Extension: Daily Digest

Generate a daily summary of completed tasks.

`plugins/daily-digest.ts`:
```ts
import { onTaskComplete } from '@opencode/agent';
import { sendEmail } from './email-utils';

onTaskComplete(async (task) => {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `digest:${today}`;
  const digest = await getCache(cacheKey) || { tasks: [] };
  digest.tasks.push({ id: task.id, description: task.description, duration: task.duration });
  await setCache(cacheKey, digest, { ttl: 86400 });
  // At end of day (cron), send email
});
```
Combine with a cron plugin to send the digest at 18:00.

---

## 9. Capability Extension: External Agent Bridge

Bridge to an external agent system (e.g., CrewAI, AutoGen).

`plugins/crew-bridge.ts`:
```ts
import { registerAgent } from '@opencode/agent';
import { Crew } from '@your-org/crewai-client';

registerAgent({
  name: 'crew_manager',
  description: 'Delegates tasks to a CrewAI crew',
  async execute(task) {
    const crew = new Crew({ role: 'researcher' });
    const result = await crew.run(task.description);
    return { success: true, output: result };
  }
});
```
Now OpenCode can offload specialized work to another agent framework.

---

## 10. Testing Extensions

Always test your plugins:

`plugins/__tests__/my-tool.test.ts`:
```ts
import { simulateTool } from '@opencode/agent/testing';

test('run_localtests returns stdout', async () => {
  const result = await simulateTool('run_localtests', { coverage: false });
  expect(result.output).toContain('PASS');
});
```
Run tests with `opencode plugins test`.

---

## 11. Distribution

Package your skill as an npm module:

```bash
npm init -y
npm install @opencode/agent
# add files under src/
npm publish
```

Users install with:
```bash
opencode skills install @your-org/security-audit
```
The skill is fetched from npm and auto‑registered.

---

## 12. Security Considerations

- Plugins run with the same privileges as OpenCode. Sandbox with `--sandbox` flag if using Docker-based isolation (experimental).
- Never hardcode secrets; use `process.env.SECRET_NAME`.
- Review MCP server permissions; only expose necessary tools.
- Sign your plugins with Sigstore to prevent tampering.

---

## Conclusion

OpenCode’s extensibility model is deliberately simple: tools, hooks, agents, MCP. With these recipes you can tailor the agent to any workflow—security auditing, performance benchmarking, multi-agent coordination, or custom enterprise integrations. Build your own skills, share them with the team, and keep the core agent lean while expanding capabilities through composition.
