# Archive — Legacy and deprecated files

Files here are preserved for reference but are not part of the active pipeline.

- **legacy-explorers/** — `mcp-explorer.mjs` (replaced by `hyper-explorer/src/hyper-explorer-mcp.mjs`).
- **playwright-flows/** — Playwright-direct flows (full-flow, complete-flow, final-flow, report-to-agency, etc.) that did not use the MCP explorer. Canonical exploration is via `hyper-explorer-mcp.mjs` and `run-explore-and-watch.cjs`.
- **mcp-debug/** — Ad-hoc MCP test/debug scripts (test-mcp-*.mjs, test_console_capture.mjs).
- **analyze-fk-bug.js**, **agency-auto-react.js**, **agency-tasks.json** — One-off and full-flow-related root scripts.
- **enhancement-agency-2.md**, **enhancement-plan-agency.md** — Design/enhancement notes (moved from root).

Active explorer flow: Explorer (`hyper-explorer-mcp.mjs`) → `findings.md` → `player-finding-watcher.cjs` → `agency.js` → `orchestrator.cjs`.
