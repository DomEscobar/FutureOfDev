/**
 * Task Controller Tests
 * 
 * Tests for the Task API endpoints in server.js
 * Fixed: Converted to ESM syntax to match package.json "type": "module"
 * Also uses proper mock setup to avoid "TypeError: require(...) is not a function" error
 */

import request from 'supertest';
import express from 'express';

// CORRECT IMPORT: Destructure Task from the module export
// This avoids "TypeError: require(...) is not a function" error
// The server.js exports: { app, Task, sequelize }
// If you do: import Task from './server', Task becomes { app, Task, sequelize }
// which is NOT a function, causing the error when calling Task.create()
import { Task, sequelize, app as serverApp } from './server.js';

describe('Task Controller', () => {
  let app;
  
  // Set up the app for testing
  beforeAll(async () => {
    // Use the app directly from server.js - no need to create a new one
    app = serverApp;
    
    // Sync database for tests
    await sequelize.sync({ force: true });
  });
  
  afterAll(async () => {
    // Close database connection
    await sequelize.close();
  });
  
  beforeEach(async () => {
    // Clear tasks before each test
    await Task.destroy({ truncate: true });
  });

  describe('GET /api/tasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const response = await request(app).get('/api/tasks');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should return all tasks', async () => {
      // Create test tasks
      await Task.create({ title: 'Task 1', status: 'todo', priority: 'high' });
      await Task.create({ title: 'Task 2', status: 'done', priority: 'low' });
      
      const response = await request(app).get('/api/tasks');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should filter tasks by status', async () => {
      await Task.create({ title: 'Task 1', status: 'todo' });
      await Task.create({ title: 'Task 2', status: 'done' });
      
      const response = await request(app).get('/api/tasks?status=todo');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('todo');
    });

    it('should filter tasks by priority', async () => {
      await Task.create({ title: 'Task 1', priority: 'high' });
      await Task.create({ title: 'Task 2', priority: 'low' });
      
      const response = await request(app).get('/api/tasks?priority=high');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].priority).toBe('high');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return a single task by id', async () => {
      const task = await Task.create({ title: 'Test Task' });
      
      const response = await request(app).get(`/api/tasks/${task.id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Test Task');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app).get('/api/tasks/99999');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const newTask = {
        title: 'New Task',
        description: 'Task description',
        status: 'todo',
        priority: 'high',
        assignee: 'John Doe'
      };
      
      const response = await request(app)
        .post('/api/tasks')
        .send(newTask);
      
      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Task');
      expect(response.body.description).toBe('Task description');
    });

    it('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ description: 'No title' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required');
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test', status: 'invalid_status' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status value');
    });

    it('should return 400 for invalid priority', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test', priority: 'invalid_priority' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid priority value');
    });

    it('should sanitize input', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: '  <script>alert("xss")</script>Task  ' });
      
      expect(response.status).toBe(201);
      // The script tags should be removed
      expect(response.body.title).not.toContain('<script>');
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update an existing task', async () => {
      const task = await Task.create({ title: 'Original Title' });
      
      const response = await request(app)
        .put(`/api/tasks/${task.id}`)
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put('/api/tasks/99999')
        .send({ title: 'Updated' });
      
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid status', async () => {
      const task = await Task.create({ title: 'Test' });
      
      const response = await request(app)
        .put(`/api/tasks/${task.id}`)
        .send({ status: 'invalid' });
      
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete an existing task', async () => {
      const task = await Task.create({ title: 'To Delete' });
      
      const response = await request(app).delete(`/api/tasks/${task.id}`);
      
      expect(response.status).toBe(204);
      
      // Verify task is deleted
      const verify = await Task.findByPk(task.id);
      expect(verify).toBeNull();
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app).delete('/api/tasks/99999');
      
      expect(response.status).toBe(404);
    });
  });
});