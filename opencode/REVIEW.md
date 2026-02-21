Review: Create end-to-end tests for frontend-backend interaction

## Summary

**Status: REJECTED - Architecture Change Required**

### Critical Finding

**There is NO actual frontend-backend interaction to test.** The current codebase has a fundamental architectural disconnect:

1. **Frontend uses local-only state**: The `boardStore.ts` uses Zustand with `persist` middleware (localStorage), making ZERO API calls to the backend
2. **No integration layer exists**: There's no API client, service layer, or fetch calls connecting the frontend to `http://localhost:3001/api/tasks`
3. **Data models are incompatible**: 
   - Backend: `id` (INTEGER), `status` (todo/inprogress/done), `priority`, `assignee`
   - Frontend: `id` (string), `columnId` (col-1/col-2/col-3), no priority/assignee

### What Exists

- ✅ Backend API at `backend/src/server.js` with REST endpoints
- ✅ Backend integration tests (`taskApi.integration.test.js`) - but have mocking issues
- ✅ Backend Playwright config (`backend/playwright.config.js`) - but NO test files
- ✅ Frontend component tests (Column, Card, AddCardButton)
- ✅ Frontend store tests (boardStore.test.ts)

### What's Missing

1. **Frontend API client** - Need to create functions that call backend endpoints
2. **Data model mapping** - Convert between frontend (columnId) and backend (status)
3. **Store integration** - Replace local Zustand persist with API calls
4. **Playwright E2E tests** - Create actual test files in `backend/src/__tests__/e2e/`
5. **Mock fixes** - Fix the sequelize.define mocking issue in integration tests

### What Would Be Needed for True E2E Tests

1. Add API integration to frontend (e.g., `src/api/tasks.ts`):
```typescript
// Example API client needed
export const taskApi = {
  getAll: () => fetch('/api/tasks').then(res => res.json()),
  create: (task) => fetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) }),
  update: (id, data) => fetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // ...
}
```

2. Update boardStore to use API instead of local state

3. Create Playwright E2E tests that:
   - Start both frontend and backend servers
   - Test creating a task in UI → appears in backend
   - Test updating status in UI → API called correctly
   - Test drag-and-drop → API order updated

### Verdict

**REJECTED** - Cannot create E2E tests for frontend-backend interaction because:
- The frontend doesn't interact with the backend at all
- Would be testing a non-existent integration
- Would provide false confidence

**Next Steps Required:**
1. Create frontend API client layer
2. Integrate frontend store with backend API
3. Fix backend integration test mocking issues
4. Then create E2E Playwright tests