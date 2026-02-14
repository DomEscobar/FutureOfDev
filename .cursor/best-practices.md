# Cursor Mastery Guide: FutureOfDev

## 🚀 Quick Execution
1. **Plan:** Command "Analzye and create PLAN.md. Do not code."
2. **Commit:** `git commit -m "pre-agent"` before applying large diffs.
3. **Verify:** Check file timestamps and `git diff` after acceptance.

## 🧠 Context Management
- Use `@Codebase` for broad search.
- Use `@Files` for focused editing.
- Create a `TASK_SPEC.md` Notepad and reference it with `@TASK_SPEC`.
- Reset your chat every 15-20 messages to prevent "context rot."

## 🛠 Advanced Features
- **Composer (Cmd+I):** Use for multi-file refactors and agentic terminal work.
- **MCP:** Use for database queries, GitHub PRs, and browser automation.
- **PlayWhite:** Connect Playwright to MCP for self-healing tests.

## ⚖️ Model Selection
- **Gemini 3 Pro:** Best for codebase indexing and creative brainstorming.
- **Claude 3.5 Sonnet / Opus:** Best for reliability and strict engineering.
- **GPT-5.2:** Best for massive refactors and high tool-call reliability.

## 🐛 Defensiveness
- Always ask for a **Confidence Score**.
- Never allow the AI to be lazy (No placeholders/ellipses).
- Verify file content if "Plan mode" disconnects.
