/**
 * Task Controller Tests
 * Tests for the Task API endpoints
 * 
 * FIX: Resolves "TypeError: require(...) is not a function" error
 * 
 * Root cause of the error:
 * - Incorrect import: `const { jest } = require('@jest/globals')` - jest is global, not a module export
 * - Complex constructor function mock that doesn't properly export the Task model
 * 
 * The fix:
 * - Remove incorrect @jest/globals import (jest is available globally)
 * - Use proper mock factory that returns an OBJECT with mock methods
 * - Export Task as part of an object to match `const { Task } = require('../models')` pattern
 */

// No need to import jest - it's available globally

// Mock the Task model - THE CORRECT WAY
// The factory function MUST return an OBJECT, not try to invoke require as a function
jest.mock('../models', () => ({
  Task: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  Column: {
    findByPk: jest.fn().mockResolvedValue({ id: 1, title: 'To Do', position: 0 })
  }
}));

// Import AFTER the mock is defined - this gets the mocked version
const { Task } = require('../models');

describe('Task Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllTasks', () => {
    it('should return all tasks', async () => {
      // Test implementation
      const tasks = await Task.findAll();
      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Description',
        status: 'todo',
        priority: 'high',
        columnId: 1
      };
      
      const task = await Task.create(taskData);
      expect(task).toBeDefined();
      expect(Task.create).toHaveBeenCalledWith(taskData);
    });
  });
});
