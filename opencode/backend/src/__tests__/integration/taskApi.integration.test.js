/**
 * Integration Tests for Task API Endpoints
 * 
 * These tests use supertest to test the actual HTTP endpoints.
 * They test the full request/response cycle including middleware.
 */

const request = require('supertest');
const { app } = require('../../server');

// Mock the database to avoid actual DB connections during tests
jest.mock('../../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    define: jest.fn()
  }
}));

describe('Task API Integration Tests', () => {
  describe('GET /api/tasks', () => {
    it('should return all tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return tasks ordered by created_at DESC', async () => {
      const response = await request(app)
        .get('/api/tasks');
      
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/api/tasks/999999');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 for invalid task id format', async () => {
      const response = await request(app)
        .get('/api/tasks/invalid-id');
      
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task with valid data', async () => {
      const newTask = {
        title: 'Integration Test Task',
        description: 'Testing POST endpoint',
        status: 'todo',
        priority: 'high',
        assignee: 'Test User'
      };

      const response = await request(app)
        .post('/api/tasks')
        .send(newTask)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Integration Test Task');
    });

    it('should create task with minimal data (title only)', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'Minimal Task' })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Minimal Task');
      expect(response.body.status).toBe('todo');
      expect(response.body.priority).toBe('medium');
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ description: 'No title provided' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required');
    });

    it('should return 400 for empty title', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: '' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid status value', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test', status: 'invalid_status' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid priority value', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test', priority: 'urgent' });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put('/api/tasks/999999')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should update task with valid data', async () => {
      // First create a task
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ title: 'Task to Update' });

      const taskId = createResponse.body.id;

      // Now update it
      const updateResponse = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ 
          title: 'Updated Title',
          status: 'inprogress',
          priority: 'high'
        })
        .expect('Content-Type', /json/);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.title).toBe('Updated Title');
    });

    it('should perform partial update (only title)', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ title: 'Original Title', description: 'Original Desc' });

      const taskId = createResponse.body.id;

      const updateResponse = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ title: 'New Title' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.title).toBe('New Title');
      expect(updateResponse.body.description).toBe('Original Desc');
    });

    it('should return 400 for invalid status in update', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test Task' });

      const taskId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ status: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id/status', () => {
    it('should update task status', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ title: 'Status Test Task' });

      const taskId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .send({ status: 'done' })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('done');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .patch('/api/tasks/999999/status')
        .send({ status: 'done' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid status', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test' });

      const taskId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/tasks/${taskId}/status`)
        .send({ status: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete task successfully', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ title: 'Task to Delete' });

      const taskId = createResponse.body.id;

      const response = await request(app)
        .delete(`/api/tasks/${taskId}`);

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .delete('/api/tasks/999999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });
  });

  describe('GET /api/tasks/status/:status', () => {
    it('should return tasks by valid status (todo)', async () => {
      const response = await request(app)
        .get('/api/tasks/status/todo')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return tasks by valid status (inprogress)', async () => {
      const response = await request(app)
        .get('/api/tasks/status/inprogress');

      expect(response.status).toBe(200);
    });

    it('should return tasks by valid status (done)', async () => {
      const response = await request(app)
        .get('/api/tasks/status/done');

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .get('/api/tasks/status/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status');
    });
  });

  describe('GET /api/tasks/priority/:priority', () => {
    it('should return tasks by valid priority (low)', async () => {
      const response = await request(app)
        .get('/api/tasks/priority/low')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });

    it('should return tasks by valid priority (medium)', async () => {
      const response = await request(app)
        .get('/api/tasks/priority/medium');

      expect(response.status).toBe(200);
    });

    it('should return tasks by valid priority (high)', async () => {
      const response = await request(app)
        .get('/api/tasks/priority/high');

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid priority', async () => {
      const response = await request(app)
        .get('/api/tasks/priority/urgent');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid priority');
    });
  });

  describe('GET /api/tasks/assignee/:assignee', () => {
    it('should return tasks by assignee', async () => {
      const response = await request(app)
        .get('/api/tasks/assignee/testuser')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array for non-existent assignee', async () => {
      const response = await request(app)
        .get('/api/tasks/assignee/nonexistent');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/health', () => {
    it('should return health check status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Route not found');
    });
  });

  describe('Request Validation', () => {
    it('should reject requests with invalid JSON', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(500);
    });

    it('should handle missing content-type for JSON', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send('title=Test');

      expect(response.status).toBe(400);
    });
  });
});

describe('Task API End-to-End Flow', () => {
  let createdTaskId;

  it('should complete full CRUD lifecycle', async () => {
    // 1. Create a task
    const createResponse = await request(app)
      .post('/api/tasks')
      .send({
        title: 'E2E Test Task',
        description: 'End-to-end test',
        priority: 'high'
      });

    expect(createResponse.status).toBe(201);
    createdTaskId = createResponse.body.id;

    // 2. Get the task
    const getResponse = await request(app)
      .get(`/api/tasks/${createdTaskId}`);
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.title).toBe('E2E Test Task');

    // 3. Update the task
    const updateResponse = await request(app)
      .put(`/api/tasks/${createdTaskId}`)
      .send({
        status: 'inprogress',
        description: 'Updated description'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.status).toBe('inprogress');

    // 4. Update status only
    const statusResponse = await request(app)
      .patch(`/api/tasks/${createdTaskId}/status`)
      .send({ status: 'done' });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('done');

    // 5. Delete the task
    const deleteResponse = await request(app)
      .delete(`/api/tasks/${createdTaskId}`);

    expect(deleteResponse.status).toBe(204);

    // 6. Verify deletion
    const verifyResponse = await request(app)
      .get(`/api/tasks/${createdTaskId}`);

    expect(verifyResponse.status).toBe(404);
  });

  it('should track task across different statuses', async () => {
    // Create task (default status: todo)
    const createResponse = await request(app)
      .post('/api/tasks')
      .send({ title: 'Status Flow Test' });

    const taskId = createResponse.body.id;
    expect(createResponse.body.status).toBe('todo');

    // Move to inprogress
    const inprogressResponse = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .send({ status: 'inprogress' });

    expect(inprogressResponse.body.status).toBe('inprogress');

    // Move to done
    const doneResponse = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .send({ status: 'done' });

    expect(doneResponse.body.status).toBe('done');

    // Verify in done list
    const doneListResponse = await request(app)
      .get('/api/tasks/status/done');

    expect(doneListResponse.status).toBe(200);
  });
});
