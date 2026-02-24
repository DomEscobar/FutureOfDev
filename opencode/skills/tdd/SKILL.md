---
name: Test-Driven Development
trigger:
  intent: [create, fix]
  tags: [feature, api, component, endpoint, store, handler]
inject: [planning, execution]
---

# Test-Driven Development

## When to Apply
Use TDD when creating new features, API endpoints, components, or stores. Skip for pure deletion tasks or cosmetic UI changes.

## RED-GREEN-REFACTOR Cycle

### 1. RED: Write a Failing Test First
Before writing any implementation code:
- Create a test file that imports the module you're about to build
- Write test cases for the expected behavior
- The test MUST fail (or not compile) at this point -- that's correct

### 2. GREEN: Write Minimal Code to Pass
- Implement only enough code to make the failing test pass
- Do not add features beyond what the test requires
- Run the test to confirm it passes

### 3. REFACTOR: Clean Up
- Remove duplication
- Improve naming
- Extract helpers if needed
- Run tests again to confirm nothing broke

## Practical Rules for This Agency

- For Go backends: write `_test.go` files using `testing` package or testify
- For Vue frontends: write `.spec.ts` or `.test.ts` files using vitest
- If the task has no test infrastructure set up, create the test file but note it in your summary
- If a test framework is missing, do NOT install it -- just write the implementation and note the gap
- One test file per feature unit (handler, store, component)

## Anti-Patterns to Avoid
- Writing all code first and tests after (that's "test-after", not TDD)
- Writing tests that test implementation details instead of behavior
- Skipping the RED step (you must see the failure first)
