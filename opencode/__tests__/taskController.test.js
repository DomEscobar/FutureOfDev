/**
 * Task Controller Tests
 * Tests for task CRUD operations with proper mock setup
 * 
 * FIX: Resolves "TypeError: require(...) is not a function" error
 * 
 * The root this error is incorrect mock setup:
 * 
 * WRONG cause of (causes error):
 *   const Task = require('./Task')()
 *   // TypeError: require(...) is not a function
 * 
 *   jest.mock('./Task', () => require('./Task'))
 *   // Also wrong - returns module directly
 * 
 * CORRECT:
 *   jest.mock('./Task', () => ({
 *     findAll: jest.fn(),
 *     findOne: jest.fn(),
 *     create: jest.fn(),
 *     update: jest.fn(),
 *     destroy: jest.fn(),
 *     findByPk: jest.fn(),
 *   }))
 * 
 *   const { Task } = require('./Task')
 * 
 * Key insight: jest.mock factory function must return an OBJECT with methods,
 * not try to invoke require as a function.
 */

const request = require('supertest');
const express = require('express');

// MOCK SETUP - THE CORRECT WAY
// This is the key fix for "TypeError: require(...) is not a function"
// The factory function returns an OBJECT, not a function
// FIX: Use correct path to Task model (src/models/Task)
jest.mock('../src/models/Task', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
  count: jest.fn(),
}));

// Import AFTER the mock is defined
// This ensures Task is the mocked version, not the real Sequelize model
const { Task } = require('../src/models/Task');

// Import app from server (which has the routes defined inline)
const { app } = require('../server');

// Mock data
const mockTasks = [
  {
    id: 1,
    title: 'Test Task 1',
    description: 'Description 1',
    status: 'todo',
    priority: 'high',
    assignee: 'John Doe',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    dataValues: {
      id: 1,
      title: 'Test Task 1',
      description: 'Description 1',
      status: 'todo',
      priority: 'high',
      assignee: 'John Doe',
      order: 1,
    },
  },
  {
    id: 2,
    title: 'Test Task 2',
    description: 'Description 2',
    status: 'inprogress',
    priority: 'medium',
    assignee: 'Jane Smith',
    order: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    dataValues: {
      id: 2,
      title: 'Test Task 2',
      description: 'Description 2',
      status: 'inprogress',
      priority: 'medium',
      assignee: 'Jane Smith',
      order: 2,
    },
  },
];

describe('Task Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tasks', () => {
    it('should return all tasks when no filters provided', async () => {
      // Arrange - Setup mock return value
      Task.findAll.mockResolvedValue(mockTasks);

      // Act - Make the request
      const response = await request(app).get('/api/tasks');

      // Assert - Verify response
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(Task.findAll).toHaveBeenCalledWith({
        where: {},
        order: [['order', 'ASC'], ['createdAt', 'DESC']],
      });
    });

    it('should filter tasks by status query param', async () => {
      // Arrange
      const filteredTasks = [mockTasks[0]];
      Task.findAll.mockResolvedValue(filteredTasks);

      // Act
      const response = await request(app).get('/api/tasks?status=todo');

      // Assert
      expect(response.status).toBe(200);
      expect(Task.findAll).toHaveBeenCalledWith({
        where: { status: 'todo' },
        order: [['order', 'ASC'], ['createdAt', 'DESC']],
      });
    });

    it('should filter tasks by priority query param', async () => {
      // Arrange
      const filteredTasks = [mockTasks[0]];
      Task.findAll.mockResolvedValue(filteredTasks);

      // Act
      const response = await request(app).get('/api/tasks?priority=high');

      // Assert
      expect(response.status).toBe(200);
      expect(Task.findAll).toHaveBeenCalledWith({
        where: { priority: 'high' },
        order: [['order', 'ASC'], ['createdAt', 'DESC']],
      });
    });

    it('should handle database errors and return 500', async () => {
      // Arrange - Simulate database error
      Task.findAll.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const response = await request(app).get('/api/tasks');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch tasks');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return a single task by ID', async () => {
      // Arrange
      Task.findByPk.mockResolvedValue(mockTasks[0]);

      // Act
      const response = await request(app).get('/api/tasks/1');

      // Assert
      expect(response.status).toBe(200);
      expect(Task.findByPk).toHaveBeenCalledWith('1');
    });

    it('should return 404 when task not found', async () => {
      // Arrange - Task not found
      Task.findByPk.mockResolvedValue(null);

      // Act
      const response = await request(app).get('/api/tasks/999');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should handle errors when fetching task by ID', async () => {
      // Arrange
      Task.findByPk.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app).get('/api/tasks/1');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch task');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task with valid data', async () => {
      // Arrange
      const newTaskData = {
        title: 'New Task',
        description: 'New Description',
        status: 'todo',
        priority: 'medium',
        assignee: 'Test User',
      };
      const createdTask = { id: 3, ...newTaskData, order: 3 };
      Task.create.mockResolvedValue(createdTask);

      // Act
      const response = await request(app)
        .post('/api/tasks')
        .send(newTaskData);

      // Assert
      expect(response.status).toBe(201);
      expect(Task.create).toHaveBeenCalledWith(newTaskData);
    });

    it('should return 400 when title is missing', async () => {
      // Arrange
      const invalidData = { description: 'No title provided' };

      // Act
      const response = await request(app)
        .post('/api/tasks')
        .send(invalidData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required');
    });

    it('should return 400 when title is empty or whitespace', async () => {
      // Arrange
      const invalidData = { title: '   ' };

      // Act
      const response = await request(app)
        .post('/api/tasks')
        .send(invalidData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required');
    });

    it('should return 400 for invalid status value', async () => {
      // Arrange
      const invalidData = { title: 'Valid Title', status: 'invalid_status' };

      // Act
      const response = await request(app)
        .post('/api/tasks')
        .send(invalidData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status value');
    });

    it('should return 400 for invalid priority value', async () => {
      // Arrange
      const invalidData = { title: 'Valid Title', priority: 'invalid_priority' };

      // Act
      const response = await request(app)
        .post('/api/tasks')
        .send(invalidData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid priority value');
    });

    it('should handle Sequelize validation errors', async () => {
      // Arrange - Create a mock validation error
      const validationError = new Error('Title cannot be empty');
      validationError.name = 'SequelizeValidationError';
      validationError.errors = [{ message: 'Title cannot be empty' }];
      Task.create.mockRejectedValue(validationError);

      // Act
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: '' });

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update an existing task', async () => {
      // Arrange
      const existingTask = { ...mockTasks[0] };
      const updatedTask = { ...existingTask, title: 'Updated Title' };
      
      Task.findByPk.mockResolvedValue(existingTask);
      existingTask.update.mockResolvedValue(updatedTask);

      // Act
      const response = await request(app)
        .put('/api/tasks/1')
        .send({ title: 'Updated Title' });

      // Assert
      expect(response.status).toBe(200);
      expect(existingTask.update).toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent task', async () => {
      // Arrange
      Task.findByPk.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/tasks/999')
        .send({ title: 'Updated Title' });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 for invalid status value on update', async () => {
      // Arrange
      Task.findByPk.mockResolvedValue(mockTasks[0]);

      // Act
      const response = await request(app)
        .put('/api/tasks/1')
        .send({ status: 'invalid_status' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status value');
    });

    it('should return 400 for invalid priority value on update', async () => {
      // Arrange
      Task.findByPk.mockResolvedValue(mockTasks[0]);

      // Act
      const response = await request(app)
        .put('/api/tasks/1')
        .send({ priority: 'invalid_priority' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid priority value');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete an existing task', async () => {
      // Arrange
      const existingTask = {
        ...mockTasks[0],
        destroy: jest.fn().mockResolvedValue(),
      };
      Task.findByPk.mockResolvedValue(existingTask);

      // Act
      const response = await request(app).delete('/api/tasks/1');

      // Assert
      expect(response.status).toBe(204);
      expect(existingTask.destroy).toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent task', async () => {
      // Arrange
      Task.findByPk.mockResolvedValue(null);

      // Act
      const response = await request(app).delete('/api/tasks/999');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should handle errors during deletion', async () => {
      // Arrange
      Task.findByPk.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app).delete('/api/tasks/1');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete task');
    });
  });
});
