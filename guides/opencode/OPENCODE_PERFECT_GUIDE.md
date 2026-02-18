# OpenCode: Perfect Usage Guide

## Overview
OpenCode is a terminal-based AI coding agent that works across any LLM provider. This guide compiles expert patterns for production use: prompt engineering, loop tuning, memory orchestration, multi-file coordination, error recovery, test generation, and large-scale refactoring.

---

## 1. Prompt Patterns & System Instruction Crafting

OpenCode’s TUI supports system prompts via `/system` command or `AGENTS.md` in the project root. The most effective prompts are:

### 1.1 Role + Constraints
```
You are a senior software engineer specializing in TypeScript and Go.
You follow the project’s existing patterns strictly.
You never modify tests without running them first.
You always add types and avoid `any`.
You update documentation when you change public APIs.
```
*Why it works*: Clear role + hard constraints reduce hallucination and enforce consistency.

### 1.2 Chain-of-Thought for Complex Features
When requesting multi-step features, ask OpenCode to output a plan first:
```
/plan
Implement a background job queue with Redis:
1. Define Job interface with payload, status, timestamps
2. Create Redis client wrapper with connection pooling
3. Implement enqueue/dequeue/ack methods
4. Add worker process with exponential backoff
5. Write integration tests using testcontainers
Show me the plan before building.
```
Switch to Build mode only after approving the plan. This prevents rework.

### 1.3 File Scoping with `@` Mentions
Reference files explicitly to avoid ambiguous edits:
```
Refactor @src/auth/middleware.ts to use the new RBAC policy engine.
Make sure @src/auth/policy evaluator.ts exports the Policy type.
Update @tests/auth/middleware.test.ts accordingly.
```
OpenCode resolves `@filename` links from the project index created by `/init`.

### 1.4 Memory Augmentation via “Recall” Blocks
Embed known facts to avoid LLM forgetting:
```
Recall: Our error handling uses our custom AppError class from @src/errors/AppError.ts.
All API handlers must wrap try/catch and call next(new AppError(...)).
Database errors are logged with context in @src/lib/logger.ts.
```
This pattern is faster than asking OpenCode to search the codebase each turn.

---

## 2. Loop Tuning & Continuous Execution

OpenCode runs in an interactive loop, but you can automate long-running tasks with careful prompting.

### 2.1 Iterative Refactoring Loop
For large refactors, break into atomic steps and use `/undo` if a step fails:
```
Step 1: Extract interface IUser from @src/models/User.ts
Step 2: Update all imports to use IUser instead of concrete type
Step 3: Move validation logic to @src/validators/user.ts
After each step, run: npm test -- --testPathPattern=user
If tests fail, run /undo and retry with adjusted prompt.
```
Run this whole sequence by sending one message; OpenCode will execute stepwise, stopping on failures.

### 2.2 Retry & Backoff Patterns
If OpenCode hits API rate limits or network errors, it automatically retries. You can improve success by:
- Setting `OPENCODE_MAX_RETRIES=3` in env (default is 2)
- Adding `Retry-After` respect via `--retry-backoff=2000` flag if available in your build
- Using `/retry` command to re-run the last task with a fresh context

### 2.3 Long-Running Task Management
For tasks that exceed 10 minutes (e.g., “write tests for all packages”), split manually:
```
First, generate test skeletons for all packages. Stop after that.
Then, fill in mocks for external dependencies.
Finally, run the full test suite and fix failures.
```
OpenCode’s context window is limited; splitting avoids truncation and keeps output manageable.

---

## 3. Memory Strategies

OpenCode stores conversation history and project index in memory (RAM) by default. For large repos, you must control memory growth.

### 3.1 Project Indexing (`/init`)
Always run `/init` once per project. It scans the repo and creates `AGENTS.md` with a structured index. Keep this file updated manually if you add new top-level directories.

### 3.2 Summarization on Demand
When the conversation gets long, use `/summary` to get a condensed recap. OpenCode will compress earlier turns into key decisions and open items. Then continue; the summary becomes the new base context.

### 3.3 Forget Unneeded Files
If you’ve referenced many files but only need a subset, use `/forget @file.ts` to drop them from context. This frees tokens for new work.

### 3.4 Persistent Memory Across Sessions
OpenCode does not persist memory between invocations by default. For continuity:
- Save important decisions to `docs/DECISIONS.md` and reference them in new sessions.
- Use the `--workspace` flag to load a saved conversation state: `opencode --workspace=my-session.json`.

---

## 4. Multi-File Orchestration

OpenCode can edit multiple files in one turn if you list them clearly.

### 4.1 Atomic Multi-File Changes
```
In @src/auth/middleware.ts, import Policy from @src/auth/policy.
In @src/auth/policy.ts, export the Policy type.
Update @src/auth/README.md to document the new flow.
```
OpenCode will apply all changes in a single commit (if using git integration).

### 4.2 Dependency Ordering
When creating new modules, state the dependency order explicitly:
```
Create files in this order:
1. @src/lib/queue/Job.ts (interface)
2. @src/lib/queue/RedisQueue.ts (implementation)
3. @src/workers/processor.ts (consumer)
4. @src/api/jobs.ts (HTTP endpoints)
```
OpenCode respects order and will not reference later files before they exist.

### 4.3 Cross-File Refactoring
For renames or moves, do it in two steps to avoid broken imports:
```
Step A: Add new file @src/auth/rbac.ts with the Policy class.
Step B: Update @src/auth/middleware.ts to import from rbac.
Step C: Delete old @src/auth/legacy-policy.ts.
```
Run each step separately and verify `git status` or `npm run build` between steps.

---

## 5. Error Recovery & Safety Nets

### 5.1 The `/undo` and `/redo` Commands
After every change, OpenCode records a patch. `/undo` reverts the last patch; `/redo` reapplies it. Use these liberally when results differ from intent.

### 5.2 Dry-Run Mode
Add `--dry-run` to any command to see proposed changes without writing files:
```
opencode --dry-run "Add error handling to @src/api/users.ts"
```
Review the diff, then run again without `--dry-run`.

### 5.3 Model Fallback
If the primary model fails (timeouts, errors), switch models mid‑session:
```
/model openrouter/anthropic/claude-3.5-sonnet
```
OpenCode will resume with the new model. Keep a list of备用 providers in `OPENCODE_FALLBACK_MODELS` env var (comma-separated). On failure, it cycles automatically.

### 5.4 Exit Codes & CI Integration
OpenCode exits with:
- `0` on success (all changes applied)
- `1` on user abort (e.g., plan rejected)
- `2` on execution error (syntax errors, test failures)
Capture this in CI scripts to gate merges.

---

## 6. Test Generation Strategies

### 6.1 Unit Tests with Mocks
Prompt:
```
Write unit tests for @src/lib/cache/RedisCache.ts using Jest.
Mock the Redis client with ioredis-mock.
Cover: set, get, del, TTL expiry, and connection error handling.
Place tests in @tests/lib/cache/RedisCache.test.ts.
```
OpenCode will generate comprehensive tests, including edge cases.

### 6.2 Integration Tests with Testcontainers
For DB or external service tests:
```
Create integration test for @src/repositories/UserRepository.ts using testcontainers.
Spin up a Postgres container, run migrations, then test CRUD.
Use environment variables for DB config.
```
OpenCode knows the testcontainers pattern if it’s in your `AGENTS.md`.

### 6.3 Regression Tests for Bugs
When fixing a bug, always ask:
```
Add a regression test that reproduces the bug in @tests/registers/bug-1234.test.ts.
Ensure the test fails before the fix and passes after.
```
This builds a safety net.

---

## 7. Refactoring at Scale

### 7.1 TypeScript Upgrade Path
When moving from JS to TS or upgrading TS versions:
```
Step 1: Add // @ts-check to all .js files to surface errors.
Step 2: Rename .js to .ts file-by-file, fixing errors as we go.
Step 3: Enable "strict": true in tsconfig.json and resolve remaining issues.
```
Process one directory at a time to keep build green.

### 7.2 Dead Code Elimination
```
Scan the repo for unused exports and imports.
Use `ts-unused-exports` or `import-guard` to detect.
Remove dead code and update tests accordingly.
```
OpenCode can run static analysis tools if they’re in `package.json`.

### 7.3 Performance Hotspots
```
Profile the app with 0x or cloc to find large files.
Refactor @src/heavy/module.ts by splitting into smaller functions and adding memoization.
Add benchmarks to @tests/perf/module.perf.test.ts.
```
OpenCode can interpret profiling output if you paste it.

---

## 8. Full-Stack Scenario: Next.js + Go API

A complete example: build a Next.js frontend with a Go backend, using OpenCode to scaffold, test, and deploy.

### 8.1 Initialization
```bash
cd ~/projects/myapp
opencode
/init
```
OpenCode indexes both `frontend/` (Next.js) and `backend/` (Go) directories.

### 8.2 Plan Phase
```
/plan
We are building a task management app:
- Next.js 14 app router, TypeScript, Tailwind
- Go backend with Gin, PostgreSQL, JWT auth
- API routes: GET /api/tasks, POST /api/tasks, DELETE /api/tasks/:id
- Frontend: task list, create form, delete button with optimistic UI
- Use environment variables for DB connection and JWT secret
- Include Dockerfile and docker-compose.yml for both services
- Add GitHub Actions CI that runs tests and builds images
Show the full architecture before coding.
```
Review the plan; adjust as needed.

### 8.3 Build Phase (Switch to Build mode)
```
Build exactly as planned. Start with backend models and handlers, then frontend pages. Ensure API contracts match.
```
OpenCode will create files, run `go test` and `npm test` (if configured), and fix any failures.

### 8.4 PR Creation
```
Create a GitHub PR with these changes.
Title: "feat: initial task management app"
Body: includes summary of components and how to run locally.
Add labels: "feat", "ci-full"
```
OpenCode uses the GitHub plugin (if configured) to open the PR.

### 8.5 Review Loop
```
Review the PR for code quality, test coverage, and security (no hardcoded secrets).
Request changes if needed.
```
OpenCode will apply reviewer comments and push amendments.

### 8.6 Deployment Manifests
```
Generate:
- backend/deployments/kubernetes/deployment.yaml + service.yaml + ingress.yaml
- frontend/Dockerfile and k8s config
- docker-compose.yml for local dev
Include health checks, resource limits, and configMaps for env vars.
```
These are added to the PR.

### 8.7 Merge & Deploy
After approval, OpenCode can:
```
Merge the PR with squash commit.
Trigger the CI/CD pipeline to deploy to staging.
Post the deployment status back to the PR.
```
(Requires GitHub Actions with `workflow_run` hook.)

---

## 9. Extensibility: Custom Tools & MCP

OpenCode supports custom tools via plugin architecture. This section shows how to extend it.

### 9.1 Custom Tool Registration
Create `plugins/benchmark.ts`:
```typescript
import { tool } from '@opencode/agent';

tool({
  name: 'run_benchmarks',
  description: 'Run performance benchmarks and report results',
  parameters: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Benchmark target (e.g., "parser", "serializer")' }
    },
    required: ['target']
  }
}, async (params) => {
  const { target } = params;
  const result = await exec(`npm run benchmark:${target}`);
  return { output: result };
});
```
Then enable in `opencode.config.ts`:
```ts
plugins: ['benchmark']
```
Restart OpenCode; `/tool run_benchmarks` will now be available.

### 9.2 MCP Server Integration
OpenCode can consume MCP (Model Context Protocol) servers for extra context (e.g., filesystem, web search).

Configure in `opencode.config.ts`:
```ts
mcpServers: {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/project'],
    transport: 'stdio'
  },
  websearch: {
    url: 'http://localhost:3001/sse', // SSE endpoint
    transport: 'sse'
  }
};
```
Once connected, OpenCode can use tools exposed by these MCP servers as if they were native.

### 9.3 Example: Security Audit Skill
Create `plugins/security-audit.ts`:
```typescript
import { tool } from '@opencode/agent';

tool({
  name: 'security_audit',
  description: 'Run static security analysis (Snyk, inspect)'
}, async () => {
  const snyk = await exec('snyk test --json');
  const audit = await exec('npm audit --json');
  return { snyk: JSON.parse(snyk), audit: JSON.parse(audit) };
});
```
Now `/tool security_audit` produces a structured report you can act on.

---

## 10. Advanced Use Cases

### 10.1 Batch Processing Multiple Issues
```
For each issue in https://github.com/owner/repo/issues?q=is%3Aopen+label%3Abug:
- Create a branch fix/issue-<number>
- Apply the fix
- Run tests
- Create a PR linked to the issue
```
OpenCode can iterate if you paste the issue list; use `/plan` first to outline steps.

### 10.2 Knowledge Transfer Sessions
```
Explain how @src/lib/payment/checkout.ts works, then create a tutorial document in docs/payment-system.md with diagrams (Mermaid) and examples.
```
Great for onboarding new engineers.

### 10.3 Dependency upgrades with pinning
```
Upgrade @types/node from 20 to 22.
Also update tsconfig "target" to ES2022.
Run the full test suite; fix any breaking changes.
Record changes in CHANGELOG.md.
```
OpenCode handles semantic version bumps and compatibility adjustments.

---

## 11. Metrics & Observability

OpenCode emits structured logs (JSON) when `LOG_FORMAT=json`. Ship these to Datadog or Splunk to track:
- Task success/failure rate
- Average time per task
- Model latency and token usage
- Retry frequency

Set up alerts on failure rate > 5% or latency > 30s.

---

## Conclusion

Mastering OpenCode is about clear communication, atomic tasks, and leveraging its undo/redo + plan modes. Treat it as an extremely fast junior engineer who needs precise instructions but never sleeps. With the patterns above, you can run multi-person dev teams with OpenCode handling entire feature cycles.
