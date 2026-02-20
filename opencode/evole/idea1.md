# Agency Evolution - Idea 1: Graph-Based Orchestration

## Problem Statement

The current orchestrator is a flat sequential pipeline that ignores the agent
definitions, skills, and MCPs already installed on this system. Every task walks
the same `pending -> in_progress -> ready_for_test -> completed` line regardless
of complexity. Two agents (`visual-analyst`, `shadow-tester`) are defined but
never dispatched. CellCog, research-cog, Exa search, and Playwright MCP sit
unused. Each agent gets a throwaway text prompt with zero context from prior
stages.

```
Current flow (flat, single-threaded):

SUGGESTIONS.md -> CEO -> PM -> Dev -> Gatekeeper -> QA -> done
                                                     |
                                                     +-> retry (same Dev, appended error)
```

---

## Ecosystem Audit: What Exists vs What's Used

### Already Installed -- NOT Used

| Asset | Type | What it does | Currently |
|-------|------|-------------|-----------|
| Playwright MCP | MCP (mcporter) | Full browser automation, snapshots, JS execution | Configured but no agent references it |
| CellCog skill | Skill | Any-to-any AI: research, docs, dashboards, images, videos | Installed, never invoked |
| research-cog skill | Skill | #1 DeepResearch Bench -- deep multi-source research | Installed, never invoked |
| exa-web-search-free skill | Skill | Free AI search: web, code, company research (no API key) | Installed, never invoked |
| playwright-research skill | Skill | Browser-based deep research via Playwright MCP | Installed, never invoked |
| find-skills skill | Skill | Discover and install new skills dynamically | Installed, never invoked |
| visual-analyst agent | Agent def | UX/browser-based audit | Defined in opencode.json, never dispatched |
| shadow-tester agent | Agent def | Adversarial red-teaming | Defined in opencode.json, never dispatched |
| `--agent` flag | CLI feature | Routes to agent definitions with their tools/prompts | Never passed by orchestrator |
| 25+ marketing/CRO skills | Skills | SEO, copywriting, pricing, signup CRO, etc. | Installed, never invoked |

### Available to Install -- High Value

#### MCP Servers (Official Reference Implementations)

| MCP Server | Install | Why it matters |
|-----------|---------|---------------|
| **Memory** | `npx -y @modelcontextprotocol/server-memory` | Knowledge-graph persistent memory. Agents share context via entities/relations instead of passing JSON files. Solves the "agents have no shared memory" problem directly. |
| **Sequential Thinking** | `npx -y @modelcontextprotocol/server-sequential-thinking` | Dynamic, reflective problem-solving with thought chains. Architect agent uses this for complex design decisions instead of one-shot prompting. |
| **Git** | `npx -y @modelcontextprotocol/server-git` | Read, search, diff git repos as native tools. Code reviewer can inspect actual diffs without bash workarounds. |
| **Fetch** | `npx -y @modelcontextprotocol/server-fetch` | Web content fetching optimized for LLMs. Dev agent can pull API docs, README files, package docs. |
| **Filesystem** | `npx -y @modelcontextprotocol/server-filesystem` | Secure file operations with access controls. Sandboxes agent file access to the workspace. |
| **Exa** | URL: `https://mcp.exa.ai/mcp` | Free neural search (web, code, company). Already have the skill, but registering as MCP gives native tool access to all agents. |

#### Skills (Top Picks by Relevance)

| Skill | Installs | Why it matters |
|-------|----------|---------------|
| **anthropics/skills@webapp-testing** | 12.2K | Playwright-based web app testing with server lifecycle management. QA agent uses this for actual functional testing instead of just reading files. |
| **obra/superpowers@requesting-code-review** | 9.7K | Structured code review dispatch with git SHA ranges. Gives the code-reviewer agent a proven protocol for reviewing diffs. |
| **obra/superpowers@receiving-code-review** | 8.1K | How to act on review feedback (fix Critical immediately, note Minor for later). Gives the dev agent a protocol for handling review results. |
| **vercel-labs/agent-skills@web-design-guidelines** | 114K | Web design best practices from Vercel Engineering. Visual analyst and dev agent produce better UI. |
| **anthropics/skills@frontend-design** | 84K | Frontend design patterns. Dev agent builds better components. |
| **squirrelscan/skills@audit-website** | 22.8K | 230+ rule website audit (SEO, security, performance, accessibility). Visual analyst runs `squirrel audit` instead of eyeballing. |
| **addyosmani/web-quality-skills@performance** | 1.5K | Lighthouse-grade perf optimization from Addy Osmani. Dev agent writes performant code from the start. |
| **sickn33/antigravity-awesome-skills@security-review** | 1.8K | Security review patterns. Shadow tester follows structured methodology instead of ad-hoc injection attempts. |
| **wshobson/agents@api-design-principles** | 5.8K | API design patterns. Architect agent designs clean APIs. |

---

## What Changes

### 1. Use `--agent` flag -- connect orchestrator to opencode.json

The biggest fix. Right now `orchestrator.js` spawns:

```js
spawn('opencode', ['run', prompt, '--format', 'json'])
```

It should spawn:

```js
spawn('opencode', ['run', prompt, '--agent', agentName, '--format', 'json', '--dir', workdir])
```

This makes the agent definitions in `opencode.json` actually take effect --
their system prompts, tool restrictions, step limits, and model all apply.

### 2. Register MCP servers

Add these to the opencode MCP config so all agents get native tool access:

```bash
opencode mcp add memory --command "npx -y @modelcontextprotocol/server-memory"
opencode mcp add sequential-thinking --command "npx -y @modelcontextprotocol/server-sequential-thinking"
opencode mcp add git --command "npx -y @modelcontextprotocol/server-git --repository /root/Playground_AI_Dev"
opencode mcp add fetch --command "npx -y @modelcontextprotocol/server-fetch"
opencode mcp add exa --url "https://mcp.exa.ai/mcp"
```

Playwright is already in mcporter. We bridge it to opencode via mcporter calls
in agent prompts (already works).

### 3. Install high-value skills

```bash
npx skills add anthropics/skills@webapp-testing -g -y
npx skills add obra/superpowers@requesting-code-review -g -y
npx skills add obra/superpowers@receiving-code-review -g -y
npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y
npx skills add anthropics/skills@frontend-design -g -y
npx skills add squirrelscan/skills@audit-website -g -y
npx skills add addyosmani/web-quality-skills@performance -g -y
npx skills add sickn33/antigravity-awesome-skills@security-review -g -y
npx skills add wshobson/agents@api-design-principles -g -y
```

### 4. Richer task lifecycle with conditional stages

Replace the 4-status flat pipeline with a graph that has branching:

```
pending
  |
  v
planning          (PM: break down, estimate complexity, tag task type)
  |
  v
architecture      (Architect: only for complex tasks -- uses Sequential
  |                Thinking MCP for design decisions, writes to Memory MCP)
  v
implementation    (Dev: write code, uses Exa for code examples,
  |                reads architecture from Memory MCP)
  v
code_review       (Reviewer: uses requesting-code-review skill protocol,
  |                inspects diffs via Git MCP, can reject back to impl)
  v
testing           (Gatekeeper script + QA with webapp-testing skill +
  |                Playwright for browser checks)
  |
  +--> security_audit  (Shadow Tester: uses security-review skill,
  |                     only for tasks tagged security-sensitive)
  |
  +--> visual_check    (Visual Analyst: uses audit-website skill +
  |                     Playwright MCP, only for frontend tasks)
  v
completed
```

The PM tags each task during `planning` with metadata:

```json
{
  "type": "frontend|backend|fullstack|docs|config",
  "complexity": "simple|moderate|complex",
  "needs_security_audit": true/false,
  "needs_visual_check": true/false,
  "subtasks": []
}
```

The orchestrator uses these tags to decide which stages to run. A simple
docs task skips architecture, security, and visual. A complex frontend
feature runs the full graph.

### 5. Parallel execution for independent tasks

Remove the single `agentRunning` boolean. Replace with a concurrency pool:

```js
const MAX_CONCURRENT = 3;
let running = 0;
```

Independent tasks (different task IDs, no dependency) run in parallel.
Stages within a single task still run sequentially.

### 6. Sub-task decomposition

The PM can break a complex task into sub-tasks during the `planning` phase.
Sub-tasks are added to `tasks.json` with a `parent_id` field. The parent
task only advances to `completed` when all sub-tasks are `completed`.

```json
{
  "id": "auth-system",
  "title": "Build authentication",
  "status": "planning",
  "subtasks": ["auth-backend", "auth-frontend", "auth-tests"]
}
```

Sub-tasks can run in parallel (backend and frontend at the same time).

### 7. Context sharing via Memory MCP

Instead of passing flat text prompts, agents read/write to the Memory MCP
knowledge graph. The orchestrator seeds each agent with a Memory MCP entity
reference for the current task:

- PM creates: `Task:auth-system` entity with relations to requirements
- Architect adds: `Design:auth-system` with file map, API contracts
- Dev reads architecture, writes: `Implementation:auth-system` with files changed
- Reviewer reads all of the above

This means every agent has full context of what happened before it,
without stuffing everything into the prompt.

### 8. Wire up skills in agent prompts

Update `opencode.json` agent prompts to reference installed skills:

| Agent | Skills/MCPs it uses |
|-------|-------------------|
| **CEO** | find-skills (discover new capabilities), Memory MCP (write task entities) |
| **PM** | Sequential Thinking MCP (break down complex tasks), Memory MCP |
| **Architect** | Sequential Thinking MCP, api-design-principles skill, Memory MCP |
| **Dev** | Exa MCP (code search), Fetch MCP (API docs), frontend-design + web-design-guidelines skills, receiving-code-review skill, Memory MCP |
| **Code Reviewer** | Git MCP (inspect diffs), requesting-code-review skill, Memory MCP |
| **QA / Test Unit** | webapp-testing skill, Playwright MCP, performance skill, Memory MCP |
| **Shadow Tester** | security-review skill, Playwright MCP |
| **Visual Analyst** | audit-website skill (squirrelscan), Playwright MCP, web-design-guidelines skill |

### 9. New agents in opencode.json

Add two new agents:

**architect** (subagent)
- Role: Design file structure, API contracts, data models for complex tasks
- Tools: read, list, glob, grep, write, bash
- Skills: api-design-principles, Sequential Thinking MCP
- Triggered: Only for tasks with `complexity: "complex"`

**code-reviewer** (subagent)
- Role: Review diffs, check for bugs, adherence to spec, code quality
- Tools: read, list, glob, grep, bash
- Skills: requesting-code-review, Git MCP
- Triggered: After every implementation, before testing
- Can reject and send back to implementation (bounded to 2 retries)

### 10. Bounded retries with escalation

Current behavior: failure appends error text and retries the same agent
forever. New behavior:

```
retry_count: 0 -> retry with specific feedback
retry_count: 1 -> retry with expanded context + different approach hint
retry_count: 2 -> mark as "blocked", notify via Telegram, stop retrying
```

Each retry includes the full failure history so the agent doesn't repeat
the same mistake.

---

## Files Changed

| File | Change |
|------|--------|
| `orchestrator.js` | Full rewrite: graph-based lifecycle, parallel execution, Memory MCP integration, `--agent` flag, bounded retries, sub-task support |
| `opencode.json` | Add `architect` + `code-reviewer` agents. Update all existing agent prompts with skill/MCP references. Update tool lists. |
| `tasks.json` | Schema gains: `type`, `complexity`, `needs_security_audit`, `needs_visual_check`, `subtasks`, `parent_id`, `retry_count` |
| `control.sh` | Minor: clean up `.run/context/` on reset |
| `scripts/gatekeeper.sh` | No change |
| `config.json` | No change |

---

## New Flow Diagram

```
SUGGESTIONS.md change
        |
        v
  CEO agent (--agent ceo)
  Uses find-skills to check if new capabilities needed
  Creates task(s) in tasks.json + Memory MCP, status: "pending"
        |
        v
  PM agent (--agent project-manager)
  Uses Sequential Thinking MCP for complex breakdown
  Tags type/complexity, writes planning context to Memory MCP
  Status: "pending" -> "planning" -> next stage
        |
        +-- complex? --> Architect agent (--agent architect)
        |                Uses Sequential Thinking + api-design-principles
        |                Writes architecture to Memory MCP
        |                Status: "architecture" -> "implementation"
        |
        +-- simple? ---> skip to implementation
        |
        v
  Dev agent (--agent dev-unit)
  Reads architecture from Memory MCP
  Uses Exa MCP for code examples, Fetch for docs
  Uses frontend-design + web-design-guidelines skills
  Status: "implementation" -> "code_review"
        |
        v
  Code Reviewer (--agent code-reviewer)
  Uses Git MCP for diffs + requesting-code-review protocol
        |
        +-- rejected (max 2x) --> back to "implementation"
        |
        +-- approved --> "testing"
        |
        v
  Gatekeeper script (no LLM cost)
        |
        +-- fail --> back to "implementation" with context
        |
        v
  QA agent (--agent test-unit)
  Uses webapp-testing skill + Playwright MCP
        |
        +-- fail --> back to "implementation"
        |
        +-- pass + needs_security_audit?
        |     --> Shadow Tester (--agent shadow-tester)
        |         Uses security-review skill
        |
        +-- pass + needs_visual_check?
        |     --> Visual Analyst (--agent visual-analyst)
        |         Uses audit-website (squirrelscan) + Playwright
        |
        v
  completed (Telegram notification)
```

---

## What This Does NOT Change

- Model: stays minimax-m2.5 for all agents
- Telegram notifications: same mechanism, just more granular events
- Gatekeeper: still a bash script, still runs before QA, still free
- SUGGESTIONS.md watch: same fs.watch trigger
- control.sh interface: same start/stop/reset/status
- Plugin system: telegram-notifier.ts untouched
- Existing marketing/CRO skills: remain available, CEO can leverage them
  when tasks involve marketing-related work

---

## Execution Order

1. Install skills (9 new skills)
2. Register MCP servers (memory, sequential-thinking, git, fetch, exa)
3. Rewrite `opencode.json` with new agents + updated prompts + skill refs
4. Rewrite `orchestrator.js` with graph-based flow
5. Update `control.sh` reset to clean context dir
6. Test with a sample task end-to-end
