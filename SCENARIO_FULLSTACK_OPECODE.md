# Fullstack Scenario: Building a Next.js + Go API with OpenCode

This is a concrete, end-to-end walkthrough of using OpenCode to build, test, and deploy a production-ready fullstack application: a task management system with Next.js frontend and Go backend.

---

## Prerequisites

- OpenCode installed and configured with a capable model (Claude Sonnet or GPT-4o recommended)
- Node.js 20+, Go 1.22+, Docker, PostgreSQL (local or container)
- GitHub repository with a blank project structure:
```
myapp/
├── frontend/   # Next.js app
├── backend/    # Go module
├── docker-compose.yml
└── README.md
```

---

## Phase 1: Project Bootstrap

### Step 1.1 Initialize both projects
```bash
cd /path/to/myapp
opencode
```
In OpenCode TUI:
```
/init
```
Let OpenCode create `AGENTS.md` with a high-level index of both `frontend/` and `backend/`.

### Step 1.2 Ask for architecture plan
```
/plan
We will build a task management API with these endpoints:
- GET    /api/tasks        - list tasks (title, done, createdAt)
- POST   /api/tasks        - create task
- DELETE /api/tasks/:id    - delete task

Frontend: Next.js 14 (app router), server actions for mutations, Tailwind for styling.
Backend: Go 1.22, Gin framework, PostgreSQL with pgx, UUID primary keys.

Shared: environment variables (DATABASE_URL, JWT_SECRET). Use JWT for admin auth (simple static token for now).

Include Dockerfile for backend, Dockerfile for frontend, and docker-compose.yml to run both services plus Postgres.

Also add GitHub Actions CI: on push to main, run backend tests, frontend lint+test, build Docker images.

Show the file tree and key interfaces before coding.
```
Review the plan; ensure separation of concerns is clear. Adjust if needed.

---

## Phase 2: Backend Implementation

Switch to Build mode (Tab) and run:

```
Build the backend first. Start with:
1. backend/go.mod and go.sum (go mod init github.com/owner/myapp/backend)
2. backend/internal/database/schema.sql (create table tasks)
3. backend/internal/database/models.go (Task struct)
4. backend/internal/repository/task_repository.go (CRUD)
5. backend/internal/handlers/task_handler.go (Gin routes)
6. backend/cmd/server/main.go (server startup)
7. backend/.env.example (DATABASE_URL, PORT)
8. backend/Dockerfile (multi-stage build)
9. backend/README.md (local dev instructions)

Use pgx v5, uuid-ossp for IDs, and log with zerolog.

After each file, run `go test ./...` and fix any errors.
```
OpenCode will create the files in order. Verify compilation.

### Add Tests
After implementation:
```
Write unit tests for task_repository using pgxpool and testcontainers.
Place them in backend/internal/repository/task_repository_test.go.
Also write integration tests for the handlers using httptest.
```
OpenCode will set up testcontainers Go module and write realistic tests.

### Add Health Check
```
Add GET /healthz endpoint returning 200 with timestamp.
Add to README how to curl it.
```

---

## Phase 3: Frontend Implementation

Now build the Next.js frontend.

```
Build the frontend:
1. frontend/package.json with next, react, tailwind, lucide-react
2. frontend/next.config.js (optional)
3. frontend/tailwind.config.js
4. frontend/src/app/layout.tsx and page.tsx
5. frontend/src/components/TaskList.tsx (server component that fetches /api/tasks)
6. frontend/src/components/CreateTask.tsx (server action)
7. frontend/src/components/DeleteTaskButton.tsx (server action)
8. frontend/src/lib/api.ts (helper functions for fetch)
9. frontend/.env.local (NEXT_PUBLIC_API_URL=http://localhost:8080)
10. frontend/Dockerfile
11. frontend/README.md

Use TypeScript strict mode. Style with Tailwind; design a clean, minimal UI.
```
OpenCode will scaffold the Next.js app with App Router and server actions.

### API Integration
Instead of direct `fetch` from client components, we use server actions to avoid CORS during local dev:
```typescript
// frontend/src/actions/tasks.ts
'use server'
export async function createTask(formData: FormData) {
  'use server'
  const title = formData.get('title') as string;
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, done: false })
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}
```
Then `CreateTask` component uses this action. OpenCode sets this pattern.

---

## Phase 4: Docker & Orchestration

Create `docker-compose.yml` at repo root:
```
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: tasks
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://app:secret@postgres:5432/tasks?sslmode=disable
      PORT: 8080
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "8080:8080"
  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8080
    depends_on:
      - backend
    ports:
      - "3000:3000"
volumes:
  pgdata:
```
Ask OpenCode to add this file and ensure healthchecks are correct.

---

## Phase 5: GitHub Actions CI

```
Add .github/workflows/ci.yml:
- name: Checkout
- name: Setup Node (for frontend)
- name: Setup Go
- name: Lint backend (golangci-lint)
- name: Test backend (go test ./...)
- name: Test frontend (npm run lint, npm test)
- name: Build Docker images (docker/build-push-action)
- name: Push to GHCR on release tags
```
OpenCode will produce a robust CI yaml; review and commit.

---

## Phase 6: Pull Request Creation

Once all files exist and tests pass locally:
```
Create a GitHub PR:
- Branch: feat/task-management-app
- Title: "feat: initial task management fullstack app"
- Body: auto-generated summary from AGENTS.md
- Add reviewers: "team-frontend,team-backend"
- Add labels: "feat", "ci-full"
```
OpenCode uses the GitHub plugin to push and open PR.

---

## Phase 7: Automated Review Loop

Now simulate the review process:
```
Review the PR yourself. Find any style inconsistencies or missing tests.
Add a comment requesting: "Please add e2e tests with Playwright for the task flow."
Then ask OpenCode to address the review:
Address the review comment by adding Playwright e2e tests in frontend/e2e/tasks.spec.ts using @playwright/test.
```
OpenCode adds the tests, pushes commits, and the PR updates automatically.

---

## Phase 8: Deployment & Production Hardenings

After PR approval and merge:
```
Generate production manifests:
1. backend/deployments/kubernetes/deployment.yaml (replicas 2, resources, liveness/readiness probes)
2. backend/deployments/kubernetes/service.yaml
3. backend/deployments/kubernetes/ingress.yaml (host: api.example.com)
4. frontend/deployments/kubernetes/deployment.yaml (replicas 2, imagePullSecrets if private)
5. frontend/deployments/kubernetes/service.yaml
6. frontend/deployments/kubernetes/ingress.yaml (host: app.example.com)
7. Update docker-compose.yml to use production-like environment (separate networks, secrets)

Also add sealed-secrets or external secrets operator templates for DATABASE_URL and JWT_SECRET.
```
These are added to a `deploy/` directory or separate branch; OpenCode can commit them directly if you have kubeconfig access, or just create the YAML files for manual apply.

---

## Phase 9: Documentation & Handoff

Finally:
```
Write comprehensive docs:
- README.md at repo root with architecture diagram (Mermaid) and local dev instructions.
- backend/README.md with API spec (OpenAPI 3.0 in backend/docs/openapi.yaml)
- frontend/README.md with component storybook instructions (if Storybook setup)
- Runbooks: how to roll back, view logs (kubectl logs -l app=backend), DB migrations.
```
OpenCode generates clear diagrams and keeps them in sync with code.

---

## Success Indicators

- All backend tests pass (`go test ./...` 100%)
- Frontend builds without errors (`npm run build`)
- Docker images build and run via docker-compose (`docker compose up --build`)
- GitHub Actions CI passes on PR
- PR can be reviewed and amended automatically
- Kubernetes manifests are ready for `kubectl apply -f k8s/`
- No manual edits needed after OpenCode finishes

---

## Conclusion

This scenario demonstrates a complete product development cycle with OpenCode as the primary implementer. The key is to break work into phases, use `/plan` before `/build`, and leverage undo/redo for safe iteration. When combined with CI/CD and proper testing, OpenCode can ship production code at scale.
