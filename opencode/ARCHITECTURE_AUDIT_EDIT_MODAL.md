# Architecture Audit: Card/Column Edit Modal with Inline Editing
**Date:** 2026-02-21
**Scope:** Edit modal functionality and inline editing for cards and columns
**Project:** Kanban Dashboard (React + Zustand + Express)

---

## Executive Summary

⚠️ **CRITICAL FINDING:** The `EditModal.tsx` component **already exists** and supports editing both cards and columns, but **column editing is not accessible** from the UI. Additionally, the modal contains a **critical bug** (`handleBackdropClick` undefined), and store actions lack error handling. The architecture partially complies with ARCHITECTURE.md but violates API integration protocols.

---

## Component Analysis

### Current State:

```
src/components/Board/
├── Board.tsx         ✅ Main board with drag-and-drop
├── Column.tsx        ❌ No edit/delete buttons in header
├── Card.tsx          ❌ No inline edit capability (only modal)
├── AddCardButton.tsx ✅ Inline card creation
└── EditModal.tsx     ✅ Modal exists but has bugs, column editing not wired
```

### EditModal.tsx Assessment:

**Strengths:**
- Handles both card and column editing (lines 6-11, 54-59)
- Double-click inline editing for title (lines 62-84)
- Supports description editing for cards (lines 66-90)
- Proper modal lifecycle with close animation (lines 92-98)

**Critical Bug:**
- Line 101 references `handleBackdropClick` but the function is **NOT DEFINED**
- This will cause a runtime error when clicking the backdrop
- Must be implemented or the onClick removed

**Missing Features:**
- No delete button for cards or columns
- Inline editing only works on double-click; no inline-edit button triggers
- Column edit mode doesn't show in UI because Column.tsx has no trigger

---

## Architecture Compliance Issues

### 🔴 1. CRITICAL BUG: Undefined Function (Runtime Error)
**Issue:** `EditModal.tsx:101` calls `handleBackdropClick` which is never defined
**Impact:** Clicking modal backdrop crashes the application
**Fix Required:** Add the missing function or remove the handler
```typescript
const handleBackdropClick = (e: React.MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose();
  }
};
```

### 🔴 2. Violation: API Contract Missing (Rule 4.1)
**Issue:** `backend/API_CONTRACT.md` does not exist
**Impact:** No documented endpoints for column/card CRUD operations
**Files Affected:** All data-fetching hooks (none currently exist)

### 🔴 3. Violation: Mock-First Protocol (Rule 4.3.1)
**Issue:** No `src/mocks/` layer for board operations
**Impact:** Cannot develop frontend independently; tests rely on mocked store
**Required:** Create mock API functions for cards and columns

### 🔴 4. Violation: Error Boundaries (Rule 4.3.3)
**Issue:** Store actions (`addColumn`, `updateColumn`, `deleteColumn`) lack try-catch
**Location:** `boardStore.ts:47-71`
**Impact:** Backend API errors (when implemented) will crash UI without notifications

### 🔴 5. Missing UI for Column Management
**Issue:** `Column.tsx` header has no edit/delete buttons
**Impact:** Users cannot edit or delete columns despite store functions existing
**Required:** Add action buttons to column header

---

## Recommended Implementation Plan

### Phase 1: Fix Critical Bugs

**File:** `src/components/Board/EditModal.tsx`
```tsx
// Add this function before return statement:
const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
  if (e.target === e.currentTarget) {
    handleClose();
  }
};
```

### Phase 2: Create API Contract & Mocks

**File:** `backend/API_CONTRACT.md`
```
# Card & Column Endpoints

## Columns
- POST   /api/columns     - Create column (title, order?)
- PUT    /api/columns/:id - Update column (title, order?)
- DELETE /api/columns/:id - Delete column

## Tasks (existing)
- GET    /api/tasks       - List all tasks
- POST   /api/tasks       - Create task
- PUT    /api/tasks/:id   - Update task
- DELETE /api/tasks/:id   - Delete task
```

**File:** `src/mocks/api.ts`
```ts
export const columnApi = {
  create: async (title: string) => ({ id: '_...', title, order: Date.now() }),
  update: async (id: string, title: string) => ({ id, title }),
  delete: async (id: string) => ({ success: true }),
};
```

### Phase 3: Expose Column Actions in UI

**Update:** `src/components/Board/Column.tsx`
Add to column-header:
```tsx
<div className="column-header-actions">
  <button 
    className="edit-column-btn"
    onClick={() => onEditColumn?.(column)}
    title="Edit column"
  >
    <svg>...</svg> {/* Edit icon */}
  </button>
  <button 
    className="delete-column-btn"
    onClick={() => onDeleteColumn?.(column.id)}
    title="Delete column"
  >
    <svg>...</svg> {/* Delete icon */}
  </button>
</div>
```

**Required:** Add `onEditColumn` and `onDeleteColumn` props to Column component

**File:** `src/components/Board/AddColumnButton.tsx` (new)
- Similar pattern to `AddCardButton.tsx`
- Position: After last column in Board.tsx
- Simple form with title input and submit/cancel buttons

### Phase 4: Error Handling Integration

**Update:** `src/stores/boardStore.ts`
Wrap store actions in try-catch with user-friendly errors:
```ts
addColumn: async (title) => {
  try {
    // API call or immediate state update
    set((state) => ({ columns: [...state.columns, newColumn] }));
  } catch (error) {
    console.error('Failed to add column:', error);
    throw new Error('Unable to add column. Please try again.');
  }
},
```

**Update:** `src/components/Board/Board.tsx` or App.tsx
Add error boundary or notification system to catch and display errors

### Phase 5: Delete Confirmation

**File:** `src/components/Board/DeleteConfirmationModal.tsx` (reusable)
- Show when delete button clicked
- Confirm/cancel buttons
- Warn about cascading card deletion

---

## Inline Editing Considerations

### Current State:
- `EditModal` provides modal-based editing (works for cards, not accessible for columns)
- `AddCardButton` shows inline form for card creation (good pattern)
- No inline editing on cards themselves (only via modal)

### Options for Inline Editing:

**Option A: Double-click to edit (Current Modal Pattern)**
- Keep modal but trigger from column header double-click
- Pro: Consistent with EditModal design
- Con: Modal may feel heavy for simple title changes

**Option B: Inline form in column header**
- Replace title with input when edit button clicked
- Pro: Fast, feels native to column
- Con: More complex state management

**Option C: Hybrid approach**
- Title always editable (like Google Keep)
- Click to focus, blur to save
- Pro: Most intuitive
- Con: Risk of accidental edits

**Recommendation:** Option A for now (use existing modal), but wire it to column header edit button.

---

## Testing Gaps

### Existing Tests:
- ✅ `boardStore.test.ts` covers store functions (but not async error cases)
- ✅ Column component rendering tests
- ✅ Board integration tests (drag-drop, sorting)
- ✅ Card component tests
- ✅ AddCardButton tests
- ❌ `EditModal` tests **DO NOT EXIST** (file not found)

### Missing Tests:
- ❌ EditModal component tests (CRITICAL - currently no tests!)
- ❌ Column header action buttons (edit/delete)
- ❌ AddColumnButton component
- ❌ Error handling: API failures, validation errors
- ❌ Delete confirmation modal flow
- ❌ Inline editing interactions
- ❌ EditModal backdrop click behavior (bug fix verification)

---

## Security Considerations

- ✅ Store does not store credentials (Rule 5.2)
- ⚠️ **TODO:** Input sanitization on title fields (backend)
- ⚠️ **TODO:** XSS prevention in frontend (escape HTML in titles)
- ⚠️ **TODO:** Validate max length (e.g., column title ≤ 255 chars)

---

## Bundle Size Concern

**Note:** Memory of Regrets shows `@babel/parser` bundle bloat. This is unrelated to edit modal but should be addressed:
- Verify `@babel/parser` is a dev-only dependency
- Check for unnecessary imports in production bundle
- Consider tree-shaking configuration in Vite

---

## Risk Assessment

| Issue | Severity | Likelihood | Impact |
|-------|----------|------------|--------|
| Undefined `handleBackdropClick` | **CRITICAL** | Certain | App crash on backdrop click |
| No column edit UI | **HIGH** | Certain | Users cannot edit columns |
| No column delete UI | **HIGH** | Certain | Users cannot delete columns |
| Missing API contract | **HIGH** | Certain | Integration failures with backend |
| No error handling | **HIGH** | High | Poor UX, silent failures |
| No EditModal tests | **MEDIUM** | Certain | Regression risk |
| No delete confirmation | **MEDIUM** | Certain | Accidental data loss |
| No input validation | **LOW** | Medium | Potential XSS if backend fails |

---

## Immediate Action Items

### Critical (P0 - Fix Today)
1. **Fix `handleBackdropClick` bug** in EditModal.tsx (prevents crash)
2. **Create API_CONTRACT.md** documenting column/task endpoints
3. **Add edit button to Column header** to open EditModal for columns
4. **Add delete button to Column header** with confirmation modal
5. **Implement AddColumnButton** component

### High (P1 - This Sprint)
6. Add error handling to store actions (try-catch, user-friendly messages)
7. Create mock API layer (`src/mocks/api.ts`) following contract
8. Write tests for EditModal component (currently ZERO coverage)
9. Add error boundary/notification system in App.tsx
10. Implement delete confirmation modal

### Medium (P2 - Next Sprint)
11. Add input validation (max length, sanitization) in frontend
12. Write tests for new column management components
13. Audit bundle size for `@babel/parser` bloat
14. Consider inline editing enhancement (Option B or C)

---

## Detailed Review: EditModal.tsx Line-by-Line Issues

| Line | Issue | Severity |
|------|-------|----------|
| 101   | `handleBackdropClick` undefined → runtime error | CRITICAL |
| 115-132 | Title editing only triggers on double-click; no button alternative | LOW |
| 135-157 | Description editing only for cards (correct) | N/A |
| 160-167 | Save/Cancel buttons adequate | OK |
| 92-98 | `handleClose` uses timeout but no cleanup; potential memory leak if component unmounts | LOW |

**Suggested fix for handleBackdropClick:**
```tsx
const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
  if (e.target === e.currentTarget) {
    handleClose();
  }
};
```

---

## Conclusion

The architecture has a **solid foundation** with:
- ✅ Zustand state management correctly implemented
- ✅ TypeScript interfaces properly defined
- ✅ Drag-and-drop working smoothly
- ✅ EditModal component mostly complete

But it has **critical gaps**:
- ❌ Column editing UI completely missing (modal exists but inaccessible)
- ❌ Critical runtime bug in EditModal
- ❌ No API contract preventing backend integration
- ❌ Zero test coverage for EditModal
- ❌ No error handling in store

**Priority:** Fix the `handleBackdropClick` crash immediately, then enable column editing via UI. The modal infrastructure is 80% complete; wiring it to the column header and fixing the bug will complete the feature.

**Overall Grade:** C+ (Good structure, poor execution on critical paths)

---
