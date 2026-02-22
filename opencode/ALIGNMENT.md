# AGENCY ALIGNMENT STANDARDS

## Core Engineering
- **Modular over Monolithic**: Prefer small, reusable components and clean logic splits.
- **Mobile-First**: All UI changes must be verified against mobile breakpoints (Navbar, Dashboard, Cards).
- **Tailwind Precision**: Use standard utility classes; avoid custom inline styles unless strictly necessary.
- **No Deletions**: Never delete existing code or logic without explicit confirmation; prefer refactoring or deprecation.

## Operational Protocol
- **Brain-Loop Check**: Before finishing, run `ls` or `grep` to verify files were actually updated.
- **Self-Review**: Compare your finished code against the [TASK] requirement before declaring success.
- **Verdict Integrity**: If you are a Reviewer, be pedantic. If you are a Developer, be exhaustive.

## Error Handling
- **Address Rejections**: If [REJECTION NOTES] are present, they are the #1 priority.
- **Idempotency**: Ensure that re-running your code doesn't break the workspace if the first run partially succeeded.

## Output Structure
- Always end your run with a clear `Summary: <what was actually changed>`.
- Use `@@@WRITE_CONTEXT@@@` tags if you need to pass specific metadata back to the Orchestrator.
