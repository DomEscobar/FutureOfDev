# Kanban Backend API

This is the backend API for a Kanban Task Management Dashboard.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials.

3. Set up PostgreSQL database:
   ```bash
   createdb kanban_db
   ```

4. Run migrations (if using sequelize-cli):
   ```bash
   npm run migrate
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`.

## API Endpoints

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/status/:status` - Get tasks by status
- `GET /api/tasks/assignee/:assignee` - Get tasks by assignee
- `GET /api/tasks/priority/:priority` - Get tasks by priority

### Health
- `GET /api/health` - Health check endpoint

## Task Schema
```json
{
  "id": "integer",
  "title": "string (required)",
  "description": "string (optional)",
  "status": "enum: todo, inprogress, done",
  "priority": "enum: low, medium, high",
  "assignee": "string (optional)",
  "order": "integer",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

## Status Values
- `todo` - Task not started
- `inprogress` - Task in progress
- `done` - Task completed

## Priority Values
- `low` - Low priority
- `medium` - Medium priority (default)
- `high` - High priority
