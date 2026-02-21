# Architecture Audit: End-to-End Tests for Frontend-Backend Interaction
**Date:** 2026-02-21
**Scope:** Create end-to-end tests for frontend-backend interaction
**Project:** Kanban Dashboard (React + Zustand + Express)

---

## Executive Summary

❌ **CRITICAL FINDING:** The project architecture is **not ready for E2E testing** of frontend-backend interaction. While the backend has a fully functional REST API and the frontend has a complete UI with state management, **there is no API integration between them**. The frontend uses local Zustand state exclusively, making true E2E tests impossible until integration is implemented.

Additionally:
- Missing `backend/API_CONTRACT.md` (required by ARCHITECTURE.md §4.1)
- Missing `src/mocks/` layer (violates Mock-First protocol §4.3.1)
- Backend E2E test directory exists but is completely empty
- Frontend types don't match backend model (status, priority, assignee missing)
- Playwright is configured but no tests written

---

## Architecture Compliance Issues

### 🔴 1. Violation: API Contract Missing (Rule 4.1)
**Issue:** `backend/API_CONTRACT.md` does not exist.
**Impact:** No single source of truth for API interface. Frontend cannot implement type-safe integration.
**Required:** Document all endpoints, request/response schemas, error formats.

### 🔴 2. Violation: Mock-First Protocol (Rule 4.3.1)
**Issue:** No `src/mocks/` directory or mock API layer.
**Impact:** Frontend cannot be developed or tested independently. Violates separation of concerns.
**Required:** Create mock implementations of all API calls matching the contract.

### 🔴 3. Violation: Schema-Sync Protocol (Rule 4.3.2)
**Issue:** Frontend types (`src/types/index.ts`) don't match backend Task model.
- Frontend Card: `{ id, title, description?, columnId, order }`
- Backend Task: `{ id, title, description, status, priority, assignee, order, created_at, updated_at }`
**Impact:** TypeScript cannot guarantee data integrity across API boundary.
**Required:** Align frontend types with backend schema OR create separate DTOs with proper mapping.

### 🔴 4. Violation: Error Boundaries (Rule 4.3.3)
**Issue:** Store actions in `boardStore.ts` lack error handling. All state mutations are synchronous with no try-catch or user feedback.
**Impact:** Backend errors would cause unhandled rejections; no user notifications.
**Required:** Add error handling in all API-integrated store actions.

### 🟡 5. E2E Infrastructure Incomplete
**Issue:** Playwright configured in `backend/playwright.config.js` but `backend/src/__tests__/e2e/` is empty. No test files exist.
**Impact:** No automated tests for full-stack user journeys.
**Required:** Write comprehensive E2E test suite covering all critical user flows.

---

## Gap Analysis: What's Missing

### Backend Status: ✅ Ready (API Complete)
- ✅ REST endpoints implemented (`taskController.js`)
- ✅ Sequelize model defined with validation
- ✅ Error handling present (400, 404, 500)
- ⚠️ Missing: API_CONTRACT.md documentation
- ✅ Playwright configured

### Frontend Status: ❌ Not Integration-Ready
- ✅ UI components complete (Board, Column, Card, AddCardButton, EditModal)
- ✅ State management with Zustand
- ✅ Drag-and-drop with @dnd-kit
- ❌ **No API integration layer**
- ❌ **No mock data layer**
- ❌ **Types don't match backend**
- ❌ **No error handling for API calls**
- ❌ **No data fetching on mount**

### Integration Status: ❌ Non-Existent
- ❌ Frontend never calls backend API
- ❌ No fetch/axios/http client setup
- ❌ No environment configuration (dev/prod URLs)
- ❌ No test database seeding strategy

---

## Why E2E Tests Cannot Be Written Yet

The ARCHITECTURE.md §4.3 explicitly requires:

1. **Mock-First** → Frontend must implement `src/mocks/` before real API
2. **Schema-Sync** → Types must match backend 1:1
3. **Error Boundaries** → All API calls need try-catch with UI notifications

**None of these prerequisites are met.** Writing E2E tests now would test a frontend that never talks to the backend, which defeats the purpose of "frontend-backend interaction" tests.

---

## Recommended Implementation Order

### PHASE 1: Establish Foundation (Prerequisites)
Create the required architectural artifacts before any E2E testing:

1. `@@@WRITE_FILE@@@ backend/API_CONTRACT.md` - Document the complete API
2. `@@@WRITE_FILE@@@ src/mocks/api.ts` - Mock API layer with fake data
3. `@@@WRITE_FILE@@@ src/services/api.ts` - Real API client (fetch wrapper)
4. `@@@WRITE_FILE@@@ .env.example` - Add `VITE_API_URL=http://localhost:3001/api`
5. Update `src/types/index.ts` to include status, priority, assignee, or create mapping logic

### PHASE 2: Integrate Frontend-Backend
Wire the frontend to use the real API:

6. Modify `src/stores/boardStore.ts` to:
   - Fetch tasks on mount from `/api/tasks`
   - Map backend Task → frontend Card/Column structure
   - Use API calls in `addCard`, `updateCard`, `deleteCard` (and column equivalents if they exist)
   - Add error handling with user feedback
7. Create `src/__tests__/integration/` for unit tests of API layer

### PHASE 3: Write E2E Tests (Finally)
Now that integration exists, write true end-to-end tests:

8. `@@@WRITE_FILE@@@ backend/src/__tests__/e2e/kanban-board.spec.ts`
   - Test: Page loads, tasks fetched from real backend, displayed in UI
   - Test: Add new task → POST to API → appears in correct column
   - Test: Edit task → PUT to API → UI updates
   - Test: Delete task → DELETE to API → removed from UI
   - Test: Drag card to new column → status changes → PATCH to API → persists
   - Test: Backend validation errors (missing title) → user sees error message
   - Test: Backend 500 error → user sees friendly error

9. `@@@WRITE_FILE@@@ backend/src/__tests__/e2e/fixtures.ts`
   - Database seeding helper
   - Test data factories
   - Cleanup/teardown

10. Update `backend/playwright.config.js` to:
    - Ensure webServer starts BOTH backend AND frontend (currently only backend)
    - Set proper waitForNavigation conditions

### PHASE 4: CI/CD & Quality Gates

11. Add root package.json scripts:
    - `test:e2e:ci`: Run Playwright in CI mode with proper flags
    - `test:integration`: Combined unit + e2e

12. Consider:
    - E2E test coverage reporting
    - Visual regression testing (Percy/Chromatic)
    - Accessibility testing with Playwright

---

## Specific E2E Test Scenarios to Implement

Once Phase 1-2 are complete, these tests should cover all critical paths:

| User Journey | API Calls | UI Verification | Edge Cases |
|--------------|-----------|----------------|------------|
| **Load Board** | GET /api/tasks | 3 columns with tasks | Empty state, loading spinner |
| **Create Task** | POST /api/tasks | New card appears in column | Validation error, duplicate title |
| **Edit Task** | PUT /api/tasks/:id | Card updates inline | 404 if deleted mid-edit |
| **Delete Task** | DELETE /api/tasks/:id | Card removed from UI | Undo? (optional) |
| **Move Task** | PATCH /api/tasks/:id/status | Card moves to new column | Invalid status, locked column |
| **Filter Tasks** | GET /api/tasks?status=todo | Only matching tasks visible | No matching tasks |
| **Persist Data** | (implicit) | Refresh page, data persists | Offline → online sync |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| E2E tests are flaky due to async timing | High | Medium | Use Playwright's auto-wait, explicit asserts |
| Tests interfere with each other (shared DB) | High | High | Isolate test data with fixtures + cleanup |
| Backend API changes break tests | Medium | High | Keep API_CONTRACT.md updated, version tests |
| Frontend UI changes break selectors | High | Medium | Use test IDs (`data-testid`) not CSS selectors |
| CI/CD timeout due to slow E2E suite | Medium | Medium | Parallelize tests, optimize fixtures |

---

## Metrics for Success

After implementation, verify:

- ✅ All E2E tests pass locally and in CI
- ✅ Frontend and backend share same data source (no local storage divergence)
- ✅ Test coverage of critical user paths ≥ 90%
- ✅ E2E suite runs in < 5 minutes
- ✅ Flake rate < 1% (retries only on genuine failures)

---

**Next Step:** Implement the `@@@WRITE_FILE@@@` blocks above in order (Phase 1-3).
