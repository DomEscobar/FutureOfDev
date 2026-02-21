# 🏦 CODE_OF_CONDUCT.md — AI Agency V4 Protocol

## 1. Zero Hallucination Policy
- If a dependency is missing, do not invent it. Write a placeholder and flag it in the Thought Process.
- Never write code for a feature that hasn't been architected in `ARCHITECTURE.md`.

## 2. Artifact Integrity
- Every implementation must include:
  - The logic file (e.g., `.js`, `.tsx`).
  - An accompanying test file (e.g., `.test.js`).
  - Descriptive JSDoc headers for all exported functions.

## 3. Communication Protocol
- Use `@@@WRITE_FILE:path@@@` for all disk operations.
- Always provide a `summary` of changes in a `@@@WRITE_CONTEXT:implementation@@@` block.

## 4. Responsibility Boundaries
- **Backend Engineer**: Focus on data safety, schema normalization, and API status codes.
- **Frontend Engineer**: Focus on UI state management, component isolation, and accessibility.

## 5. Failure Protocol
- If a task fails verification twice, stop implementation and update the task description with the EXACT error log.
