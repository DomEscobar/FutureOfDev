# 🏗️ ARCHITECTURE.md — Kanban Dashboard Project

## 1. System Overview
A fullstack Kanban application using React (Frontend) and Express/Sequelize (Backend).

## 2. Technical Stack
- **Frontend**: Vite + React + Zustand (State) + Tailwind CSS.
- **Backend**: Node.js + Express + Sequelize (SQLite/Postgres).
- **Communication**: REST API (JSON).

## 3. Data Flow
- `frontend/src/store/boardStore.ts` is the single source of truth for the UI.
- Backend API endpoints must strictly validate JSON payloads against the Sequelize models.

## 4. Communication & Integration Protocol

### 🔗 API Wiring (The Sync Point)
- **Frontend** and **Backend** stay in sync via `backend/API_CONTRACT.md`.
- **Backend Engineer**: Must update `API_CONTRACT.md` before changing any controller logic.
- **Frontend Engineer**: Must read `API_CONTRACT.md` before writing data-fetching hooks.

### 📜 Integration Rules
1. **Mock-First**: Frontend must implement a `src/mocks/` layer using the Contract's data structure before wiring to the real API.
2. **Schema-Sync**: Axios/Fetch calls in the Frontend must use TypeScript interfaces (or JSDoc objects) that match the Backend Sequelize models 1:1.
3. **Error Boundaries**: All API wiring must include a `catch` block that transforms Backend status codes (400, 401, 500) into user-friendly UI notifications.

## 5. Security
- Input sanitization on all backend routes.
- Frontend state must not store sensitive DB credentials.
