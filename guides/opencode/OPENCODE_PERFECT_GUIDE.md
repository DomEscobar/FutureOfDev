# OpenCode: Perfect Usage Guide (Advanced Edition)

## Introduction
This guide covers expert‑level usage of OpenCode for production teams. It focuses on **agent orchestration**, **loop control**, **memory optimization**, **extensibility**, and **deployment architectures**. All patterns are based on official documentation and proven community setups.

---

## 1. Multi‑Agent Orchestration & Swarms

OpenCode supports multiple agents (primary and subagents) that can collaborate. This enables swarm‑like parallel work.

### 1.1 Built‑in Agents
From the [agents documentation](https://opencode.ai/docs/de/agents/):

| Agent | Mode | Purpose |
|-------|------|---------|
| `build` | primary | Full tool access (read/write/bash). Default for development. |
| `plan` | primary | Read‑only; used for planning without making changes. |
| `general` | subagent | Research, multi‑step tasks; full tool access except Todo. |
| `explore` | subagent | Read‑only exploration of the codebase (fast). |
| `compaction` | primary (hidden) | Automatically compresses long context. |
| `summary` | primary (hidden) | Generates session summaries. |

You can switch primary agents with `Tab` or `switch_agent` keybind. Subagents are invoked via `@mention` (e.g., `@general help me search…`).

### 1.2 Custom Agents
Define custom agents in `opencode.json` or in `.opencode/agents/*.md` (see [Agent Config](https://opencode.ai/docs/de/agents/)).

Example: a `code-reviewer` subagent that only reads code:

```json
{
  "agent": {
    "code-reviewer": {
      "description": "Reviews code for best practices and potential issues",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "prompt": "You are a code reviewer. Focus on security, performance, maintainability.",
      "tools": {
        "write": false,
        "edit": false,
        "bash": false
      }
    }
  }
}
```

Or as Markdown (`.opencode/agents/reviewer.md`):

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---
You are in code review mode. Focus on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance implications
- Security considerations
Provide constructive feedback without making direct changes.
```

After creating the agent, mention it in chat: `@reviewer Please review @src/auth/middleware.ts`.

### 1.3 Task Delegation & Swarm Patterns
Use the `task` tool to delegate work to subagents. Primary agent can spawn multiple subagent tasks and collect results — a simple swarm.

Pattern:

```
@general, investigate the performance of @src/lib/cache/redis.ts and produce a report.
@explore, list all files that import @src/lib/cache/redis.ts.
Wait for both to finish, then synthesize the findings.
```

OpenCode automatically manages sub‑agent sessions; you can cycle through them with `→` and `←` keys (or configured shortcuts).

For true parallel execution, ensure your `max_concurrent` settings allow multiple sub‑agent tasks. You can control this via:

```json
{
  "agent": {
    "general": {
      "max_concurrent": 3
    }
  }
}
```

(Check current OpenCode docs for exact support; some versions use `steps` to limit iterations.)

---

## 2. Loop Control & Efficiency

### 2.1 Step Limits
Prevent runaway loops by capping iterations per agent:

```json
{
  "agent": {
    "quick-thinker": {
      "steps": 5,
      "description": "Fast reasoning with limited iterations"
    }
  }
}
```

When the limit is hit, the agent is forced to produce a summary and stop.

### 2.2 Dynamic Context Pruning
Long sessions accumulate tool outputs. Install the community plugin `opencode-dynamic-context-pruning` to automatically remove stale outputs and keep token usage under control.

Installation:
```bash
opencode plugins install opencode-dynamic-context-pruning
```

Configuration (optional):
```json
{
  "plugins": {
    "opencode-dynamic-context-pruning": {
      "maxToolOutputs": 10,
      "pruneStrategy": "fifo"
    }
  }
}
```

This plugin is essential for long‑running tasks or when using small context windows.

### 2.3 Auto‑Compaction
Built‑in `compaction` agent runs automatically when context grows too large. You can influence its behavior by adjusting `compaction` agent settings (if exposed in config). Alternatively, manually trigger summarization with `/summary`.

---

## 3. Permissions & Security

### 3.1 Tool Permissions
Control which tools an agent can use and under what conditions:

Global defaults:
```json
{
  "permission": {
    "edit": "deny",
    "bash": "ask",
    "webfetch": "allow"
  }
}
```

Per‑agent override:
```json
{
  "agent": {
    "build": {
      "permission": {
        "edit": "allow",
        "bash": {
          "*": "ask",
          "git status": "allow"
        }
      }
    },
    "plan": {
      "permission": {
        "edit": "deny",
        "bash": "deny"
      }
    }
  }
}
```

Bash command patterns support globbing:
```json
{
  "bash": {
    "*": "ask",
    "git *": "allow",
    "npm test": "allow"
  }
}
```

### 3.2 Enterprise Concerns
For air‑gapped or sovereign deployments:
- Use `opencode-openai-codex-auth` or `opencode-gemini-auth` to avoid billing through OpenCode (use your own provider accounts).
- Disable telemetry: set `telemetry: false` in config (if available) or block outbound calls via firewall.
- Run local models via LM Studio/Ollama; configure model endpoints in `providers`.
- Enable `opencode-notifier` for desktop alerts to reduce context‑switching.
- Use `opencode-worktree` to give each task its own Git worktree, isolating changes.

---

## 4. Extensibility & MCP

### 4.1 MCP Servers
OpenCode can connect to external MCP servers to gain new tools. Configure in `opencode.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
      "transport": "stdio"
    },
    "websearch": {
      "url": "http://localhost:3001/sse",
      "transport": "sse"
    }
  }
}
```

Once connected, tools from these servers become available to agents (respecting permissions). Example: `filesystem.list_files`, `websearch.search`.

### 4.2 Custom Tools via Plugins
Write a plugin to add custom tools:

`plugins/my-tool.ts`:
```ts
import { tool } from '@opencode/agent';

tool({
  name: 'run_benchmarks',
  description: 'Run performance benchmarks and report results',
  parameters: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Benchmark target (e.g., "parser")' }
    },
    required: ['target']
  }
}, async (params) => {
  const { target } = params;
  const result = await exec(`npm run bench:${target}`);
  return { output: result };
});
```

Enable in config:
```json
{
  "plugins": ["my-tool"]
}
```

Now any agent can call `/tool run_benchmarks`.

### 4.3 Useful Ecosystem Plugins
- `opencode-pty` – essential for interactive commands.
- `opencode-shell-strategy` – prevents TTY‑related crashes.
- `opencode-supermemory` – persistent memory across sessions.
- `opencode-background-agents` – async delegation (swarm pattern).
- `opencode-websearch-cited` – native web search with citations.
- `opencode-scheduler` – cron‑like recurring jobs.
- `oh-my-opencode` – bundle of background agents, LSP/AST/MCP tools.

---

## 5. Deployment Archetypes

### 5.1 Sovereign Enterprise (Air‑Gapped)
Goal: on‑prem, no external API calls, full audit.

Components:
- Local LLM provider (Ollama, LM Studio, or vLLM).
- OpenCode configured with `baseURL` pointing to local provider.
- `opencode-openai-codex-auth` not needed; use local models.
- `opencode-supermemory` with local vector store (e.g., LanceDB) for persistence.
- Disable all cloud plugins; enable only local MCP servers.
- Use systemd service to run OpenCode as a daemon for scheduled tasks.

Example `opencode.json`:
```json
{
  "provider": "openai",
  "baseURL": "http://localhost:11434/v1",
  "apiKey": "sk-local",
  "mcpServers": {
    "local-fs": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/projects"],
      "transport": "stdio"
    }
  },
  "plugins": [
    "opencode-supermemory",
    "opencode-pty",
    "opencode-shell-strategy"
  ],
  "telemetry": false
}
```

### 5.2 High‑Throughput Swarm
Goal: parallelize many tasks across multiple agents.

Components:
- Primary `orchestrator` agent (custom) that delegates to subagents.
- Subagents: `coder`, `tester`, `reviewer`, `security` — each with tailored tools.
- `opencode-background-agents` for async spawning.
- `opencode-scheduler` to enqueue periodic jobs.
- `opencode-dynamic-context-pruning` to manage token usage.
- Optional event bus: use `webhook` plugin or custom MCP server to coordinate.

Configuration sketch:
```json
{
  "agent": {
    "orchestrator": {
      "mode": "primary",
      "permission": {
        "task": {
          "*": "deny",
          "coder": "allow",
          "tester": "allow",
          "reviewer": "ask"
        }
      }
    },
    "coder": {
      "mode": "subagent",
      "tools": { "write": true, "edit": true, "bash": true }
    },
    "tester": {
      "mode": "subagent",
      "tools": { "bash": true }
    },
    "reviewer": {
      "mode": "subagent",
      "tools": { "edit": false, "bash": false }
    }
  },
  "plugins": ["opencode-background-agents", "opencode-dynamic-context-pruning"]
}
```

Usage:
```
@orchestrator, implement feature X and have @tester write unit tests, then @reviewer check for security issues.
```

### 5.3 Developer Experience First (IDE‑Centric)
Goal: maximal productivity with minimal ops overhead.

Components:
- Use OpenCode in VS Code via `opencode.nvim` or `OpenChamber` extension.
- `opencode-websearch-cited` for quick research.
- `opencode-notifier` for desktop alerts.
- `opencode-morph-fast-apply` for speed.
- `opencode-wakatime` to track usage.
- Cloud LLM provider (OpenRouter, Anthropic) with high rate limits.
- Auto‑start with `opencode-scheduler` if needed.

Config:
```json
{
  "plugins": [
    "opencode-websearch-cited",
    "opencode-notifier",
    "opencode-morph-fast-apply",
    "opencode-wakatime"
  ],
  "agent": {
    "build": {
      "model": "anthropic/claude-sonnet-4-20250514"
    }
  }
}
```

---

## 6. Full‑Stack Development Patterns

### 6.1 Backend (Go/TypeScript)
- Use `@` mentions to target specific files.
- Ask for plan first, then build.
- Request tests with coverage: `Write unit tests for @internal/repository/user.go with 90% coverage using testcontainers`.
- Include health checks and structured logging in initial scaffolding.
- Use `opencode-pty` when building requires interactive tools (e.g., `go mod tidy` may prompt).

### 6.2 Frontend (React/Next.js)
- Use `@` to reference components and pages.
- Request Tailwind classes and responsive design.
- Ask for Playwright tests: `Create e2e test for login flow using @playwright/test`.
- Leverage `webfetch` to pull design references from URLs.

### 6.3 DevOps Integration
- Generate Dockerfile and docker‑compose.yml.
- Add GitHub Actions CI (`.github/workflows/ci.yml`).
- Use `opencode-scheduler` to run periodic security scans.
- Store secrets in environment variables; never hard‑code.

---

## 7. Monitoring & Observability

- Enable JSON logging: `LOG_FORMAT=json`.
- Use `opencode-wakatime` or custom plugin to emit metrics.
- Track task durations and success rates via built‑in metrics (if available).
- Set up alerts on repeated failures (e.g., Slack webhook via custom tool).

---

## 8. Citations & Further Reading

- OpenCode Agents: https://opencode.ai/docs/de/agents/
- OpenCode Ecosystem: https://opencode.ai/docs/de/ecosystem/
- Model Context Protocol: https://github.com/modelcontextprotocol/specification
- Community plugins: https://github.com/awesome-opencode/awesome-opencode
- oh‑my‑opencode: https://github.com/code-yeongyu/oh-my-opencode
- background‑agents: https://github.com/kdcokenny/opencode-background-agents
- dynamic‑context‑pruning: https://github.com/Tarquinen/opencode-dynamic-context-pruning
- supermemory: https://github.com/supermemoryai/opencode-supermemory

---

This guide will be kept up‑to‑date as OpenCode evolves. Next: Fullstack Scenario incorporating these advanced patterns.