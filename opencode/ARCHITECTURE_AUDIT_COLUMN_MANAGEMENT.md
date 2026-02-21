# Architecture Audit: Column Management UI
**Date:** 2026-02-21  
**Scope:** Add/Delete column buttons and overall column management UI  
**Project:** Kanban Dashboard (React + Zustand + Express)

---

## Executive Summary

❌ **CRITICAL FINDING:** Column management UI is **completely missing** from the frontend architecture. While the Zustand store (`boardStore.ts`) correctly implements `addColumn` and `deleteColumn` operations, these are **not exposed through any UI components**. The current architecture violates multiple ARCHITECTURE.md protocols, particularly around API integration and error handling.

---

## Architecture Compliance Issues

### 🔴 1. Violation: API Contract Missing (Rule 4.1)
**Issue:** `backend/API_CONTRACT.md` does not exist.
**Impact:** Frontend cannot implement type-safe API integration. No documented endpoints for column CRUD operations.
**Files Affected:** All data-fetching hooks (none exist for columns currently).

### 🔴 2. Violation: Mock-First Protocol (Rule 4.3.1)
**Issue:** No `src/mocks/` layer for column management operations.
**Impact:** Cannot develop frontend independently of backend; tests cannot run in isolation.
**Required:** Create mock implementations of column API calls matching backend schema.

### 🔴 3. Violation: Schema-Sync Protocol (Rule 4.3.2)
**Issue:** No TypeScript interfaces or JSDoc annotations for column API payloads.
**Impact:** Type safety compromised; potential runtime errors when wiring to backend.
**Required:** Define column API request/response types.

### 🔴 4. Violation: Error Boundaries (Rule 4.3.3)
**Issue:** No error handling in store actions for column operations.
**Impact:** Backend errors (400, 401, 500) would crash the UI without user-friendly notifications.
**Location:** `boardStore.ts:47-71` - `addColumn` and `deleteColumn` lack try-catch blocks.

---

## Missing Components Analysis

### Current State:
```
src/components/Board/
├── Board.tsx         (renders columns, no column controls)
├── Column.tsx        (displays column, no actions)
├── Card.tsx          (card component)
├── AddCardButton.tsx (✅ exists for cards)
└── EditModal.tsx     (likely for cards, not columns)
```

### Missing Components:
1. **AddColumnButton** - Similar to `AddCardButton.tsx` but board-level
2. **ColumnHeaderActions** - Delete/Edit column buttons in column header
3. **ColumnEditModal** - For editing column title (inline or modal)
4. **DeleteColumnConfirmation** - Modal/dialog for delete confirmation

---

## Recommended Implementation Plan

### Phase 1: API Contract & Mocks
```
@@@WRITE_FILE@@@
backend/API_CONTRACT.md
Content:
# Column Endpoints
- POST   /api/columns     - Create column
- PUT    /api/columns/:id - Update column
- DELETE /api/columns/:id - Delete column
- GET    /api/columns     - List columns

Request/Response schemas...
@@@END@@@
```

Create `src/mocks/columnApi.ts` with functions matching the contract.

### Phase 2: Column Management Components

**File:** `src/components/Board/AddColumnButton.tsx`
```tsx
// Pattern: Follows AddCardButton.tsx structure
// Should include form for column title input
// Position: Board-level (maybe positioned after last column)
```

**File:** `src/components/Board/ColumnHeaderActions.tsx`
```tsx
// Buttons: Edit (pencil icon), Delete (trash icon)
// Position: In Column.tsx header, next to card count
// Requires: Context menu or confirmation for delete
```

**File:** `src/components/Board/ColumnEditModal.tsx`
```tsx
// Modal with title input and Save/Cancel
// Reuse patterns from EditModal.tsx
```

### Phase 3: Integration & Error Handling

Modify `boardStore.ts`:
```ts
addColumn: async (title) => {
  try {
    // API call or mock
    // Optimistic update pattern
  } catch (error) {
    // Transform to user-friendly message
    throw new Error('Failed to create column');
  }
}
```

Add error boundary in `Board.tsx` using error state and notifications.

---

## Security Considerations

- ✅ Store does not store credentials (Rule 5.2)
- ⚠️ **TODO:** Implement input sanitization on column title (backend)
- ⚠️ **TODO:** Add validation (max length, no XSS) in frontend before API call

---

## Bundle Size Concern

**Note:** Memory of Regrets shows `@babel/parser` bundle bloat. This is **not** related to column management but should be addressed separately via:
- Tree-shaking configuration
- Dynamic imports if babel used in browser (unlikely)
- Verify it's a dev-only dependency

---

## Testing Gaps

### Existing Tests:
- ✅ `boardStore.test.ts` covers store functions
- ✅ Column component renders test exists

### Missing Tests:
- ❌ Column management UI components (AddColumnButton, ColumnHeaderActions)
- ❌ Integration: Click → store action → state update
- ❌ Error states: API failures, validation errors
- ❌ Delete confirmation flow

---

## Risk Assessment

| Issue | Severity | Likelihood | Impact |
|-------|----------|------------|---------|
| No column UI | **HIGH** | Certain | User cannot manage columns, app incomplete |
| Missing API contract | **HIGH** | Certain | Type mismatches, integration failures |
| No error handling | **MEDIUM** | High | Poor UX on failures |
| No delete confirmation | **MEDIUM** | Certain | Accidental data loss |
| No input validation | **LOW** | Medium | XSS risk (if backend fails) |

---

## Immediate Action Items

1. **Critical:** Create API_CONTRACT.md (backend)
2. **Critical:** Implement `AddColumnButton` component
3. **Critical:** Implement delete column button with confirmation
4. **High:** Add error boundaries around column operations
5. **High:** Create mock layer for isolated frontend development
6. **Medium:** Add input validation (title length, sanitization)
7. **Medium:** Write tests for new components
8. **Low:** Audit bundle for babel parser bloat (unrelated but noted)

---

## Conclusion

The column management feature has a **solid state management foundation** (Zustand store correctly structured) but is **completely disconnected from the UI layer**. The architecture follows good patterns (separation of concerns, typed interfaces) but violates its own protocols by lacking API contracts and mock layers. Implementing the missing UI components while establishing the API contract and error handling will bring the system into compliance with ARCHITECTURE.md.

**Priority:** This is a missing core feature that must be implemented for the application to be functional. Treat as P0.
