// Mock the Task model - all mock logic inside factory function
jest.mock('../models/Task', () => {
  const mockTaskInstances = new Map();
  let idCounter = 1;
  
  const createMockTaskInstance = (data) => ({
    id: data.id || idCounter++,
    title: data.title || 'Test Task',
    description: data.description || '',
    status: data.status || 'todo',
    priority: data.priority || 'medium',
    assignee: data.assignee || null,
    order: data.order || 0,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    update: jest.fn().mockImplementation(function(updates) {
      Object.assign(this, updates);
      return Promise.resolve(this);
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
    toJSON: function() {
      return { ...this };
    }
  });

  const Task = {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn()
  };

  Task.findAll.mockImplementation((options) => {
    let tasks = Array.from(mockTaskInstances.values());
    
    if (options?.where) {
      if (options.where.status) {
        tasks = tasks.filter(t => t.status === options.where.status);
      }
      if (options.where.priority) {
        tasks = tasks.filter(t => t.priority === options.where.priority);
      }
      if (options.where.assignee) {
        tasks = tasks.filter(t => t.assignee === options.where.assignee);
      }
    }
    
    if (options?.order) {
      const orderField = options.order[0][0];
      const orderDir = options.order[0][1] || 'ASC';
      tasks.sort((a, b) => {
        if (orderDir === 'ASC') {
          return a[orderField] > b[orderField] ? 1 : -1;
        }
        return a[orderField] < b[orderField] ? 1 : -1;
      });
    }
    
    return Promise.resolve(tasks);
  });

  Task.findByPk.mockImplementation((id) => {
    const task = mockTaskInstances.get(Number(id));
    return Promise.resolve(task || null);
  });

  Task.create.mockImplementation((data) => {
    const id = mockTaskInstances.size + 1;
    const task = createMockTaskInstance({ ...data, id });
    mockTaskInstances.set(id, task);
    return Promise.resolve(task);
  });

  Task.__reset = () => {
    mockTaskInstances.clear();
    idCounter = 1;
  };

  Task.__seed = (tasks) => {
    mockTaskInstances.clear();
    idCounter = 1;
    tasks.forEach(task => {
      mockTaskInstances.set(task.id, createMockTaskInstance(task));
    });
  };

  Task.__getMockInstances = () => mockTaskInstances;

  return {
    __esModule: true,
    default: Task,
    Task: Task
  };
});

const taskController = require('../controllers/taskController');

describe('TaskController', () => {
  let mockReq;
  let mockRes;
  let Task;

  beforeEach(() => {
    // Get the mocked Task model
    Task = require('../models/Task').Task;
    Task.__reset();
    
    // Create mock response object
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  describe('getAllTasks', () => {
    beforeEach(() => {
      mockReq = {};
    });

    it('should return all tasks ordered by created_at DESC', async () => {
      const tasks = [
        { id: 1, title: 'Task 1', status: 'todo', createdAt: new Date('2024-01-01') },
        { id: 2, title: 'Task 2', status: 'done', createdAt: new Date('2024-01-02') }
      ];
      Task.__seed(tasks);

      await taskController.getAllTasks(mockReq, mockRes);

      expect(Task.findAll).toHaveBeenCalledWith({
        order: [['created_at', 'DESC']]
      });
      expect(mockRes.json).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should return empty array when no tasks exist', async () => {
      await taskController.getAllTasks(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should return 500 on database error', async () => {
      Task.findAll.mockRejectedValueOnce(new Error('Database error'));

      await taskController.getAllTasks(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch tasks' });
    });
  });

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      const task = { id: 1, title: 'Test Task' };
      Task.__seed([task]);
      mockReq = { params: { id: '1' } };

      await taskController.getTaskById(mockReq, mockRes);

      expect(Task.findByPk).toHaveBeenCalledWith('1');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    it('should return 404 when task not found', async () => {
      mockReq = { params: { id: '999' } };

      await taskController.getTaskById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Task not found' });
    });

    it('should return 500 on database error', async () => {
      Task.findByPk.mockRejectedValueOnce(new Error('Database error'));
      mockReq = { params: { id: '1' } };

      await taskController.getTaskById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch task' });
    });
  });

  describe('createTask', () => {
    it('should create task with valid data', async () => {
      mockReq = {
        body: {
          title: 'New Task',
          description: 'Task description',
          status: 'todo',
          priority: 'high',
          assignee: 'John'
        }
      };

      await taskController.createTask(mockReq, mockRes);

      expect(Task.create).toHaveBeenCalledWith({
        title: 'New Task',
        description: 'Task description',
        status: 'todo',
        priority: 'high',
        assignee: 'John'
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Task'
      }));
    });

    it('should return 400 when title is missing', async () => {
      mockReq = { body: { description: 'No title' } };

      await taskController.createTask(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Title is required' });
    });

    it('should use default values when optional fields missing', async () => {
      mockReq = { body: { title: 'Minimal Task' } };

      await taskController.createTask(mockReq, mockRes);

      expect(Task.create).toHaveBeenCalledWith({
        title: 'Minimal Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        assignee: null
      });
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'SequelizeValidationError';
      validationError.errors = [{ message: 'Title cannot be empty' }];
      Task.create.mockRejectedValueOnce(validationError);
      mockReq = { body: { title: '' } };

      await taskController.createTask(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['Title cannot be empty']
      });
    });

    it('should return 500 on general database error', async () => {
      Task.create.mockRejectedValueOnce(new Error('Database error'));
      mockReq = { body: { title: 'Test' } };

      await taskController.createTask(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to create task' });
    });
  });

  describe('updateTask', () => {
    it('should update task with valid data', async () => {
      const task = { id: 1, title: 'Old Title', update: jest.fn().mockResolvedValue(true) };
      Task.__seed([task]);
      mockReq = { 
        params: { id: '1' },
        body: { title: 'New Title', status: 'done' }
      };

      await taskController.updateTask(mockReq, mockRes);

      expect(Task.findByPk).toHaveBeenCalledWith('1');
      expect(task.update).toHaveBeenCalledWith({ title: 'New Title', status: 'done' });
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }));
    });

    it('should return 404 when task not found', async () => {
      mockReq = { 
        params: { id: '999' },
        body: { title: 'New Title' }
      };

      await taskController.updateTask(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Task not found' });
    });

    it('should only update provided fields (partial update)', async () => {
      const task = { id: 1, title: 'Title', description: 'Desc', update: jest.fn().mockResolvedValue(true) };
      Task.__seed([task]);
      mockReq = { 
        params: { id: '1' },
        body: { title: 'Updated Title' }
      };

      await taskController.updateTask(mockReq, mockRes);

      expect(task.update).toHaveBeenCalledWith({ title: 'Updated Title' });
    });

    it('should handle validation errors', async () => {
      const task = { id: 1, title: 'Title', update: jest.fn() };
      const validationError = new Error('Validation failed');
      validationError.name = 'SequelizeValidationError';
      validationError.errors = [{ message: 'Invalid status' }];
      task.update.mockRejectedValueOnce(validationError);
      Task.__seed([task]);
      mockReq = { 
        params: { id: '1' },
        body: { status: 'invalid' }
      };

      await taskController.updateTask(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['Invalid status']
      });
    });
  });

  describe('deleteTask', () => {
    it('should delete task when found', async () => {
      const task = { id: 1, title: 'Task', destroy: jest.fn().mockResolvedValue(true) };
      Task.__seed([task]);
      mockReq = { params: { id: '1' } };

      await taskController.deleteTask(mockReq, mockRes);

      expect(Task.findByPk).toHaveBeenCalledWith('1');
      expect(task.destroy).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should return 404 when task not found', async () => {
      mockReq = { params: { id: '999' } };

      await taskController.deleteTask(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Task not found' });
    });

    it('should return 500 on database error', async () => {
      const task = { id: 1, destroy: jest.fn().mockRejectedValue(new Error('DB error')) };
      Task.__seed([task]);
      mockReq = { params: { id: '1' } };

      await taskController.deleteTask(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to delete task' });
    });
  });

  describe('getTasksByStatus', () => {
    it('should return tasks with valid status', async () => {
      const tasks = [
        { id: 1, status: 'todo' },
        { id: 2, status: 'todo' },
        { id: 3, status: 'done' }
      ];
      Task.__seed(tasks);
      mockReq = { params: { status: 'todo' } };

      await taskController.getTasksByStatus(mockReq, mockRes);

      expect(Task.findAll).toHaveBeenCalledWith({
        where: { status: 'todo' },
        order: [['order', 'ASC'], ['created_at', 'DESC']]
      });
      expect(mockRes.json).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should return 400 for invalid status', async () => {
      mockReq = { params: { status: 'invalid' } };

      await taskController.getTasksByStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid status. Must be one of: todo, inprogress, done'
      });
    });

    it('should return 500 on database error', async () => {
      Task.findAll.mockRejectedValueOnce(new Error('DB error'));
      mockReq = { params: { status: 'todo' } };

      await taskController.getTasksByStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch tasks' });
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status with valid status', async () => {
      const task = { id: 1, status: 'todo', update: jest.fn().mockResolvedValue(true) };
      Task.__seed([task]);
      mockReq = { 
        params: { id: '1' },
        body: { status: 'done' }
      };

      await taskController.updateTaskStatus(mockReq, mockRes);

      expect(Task.findByPk).toHaveBeenCalledWith('1');
      expect(task.update).toHaveBeenCalledWith({ status: 'done' });
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    });

    it('should return 400 for invalid status', async () => {
      mockReq = { 
        params: { id: '1' },
        body: { status: 'invalid' }
      };

      await taskController.updateTaskStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid status. Must be one of: todo, inprogress, done'
      });
    });

    it('should return 404 when task not found', async () => {
      mockReq = { 
        params: { id: '999' },
        body: { status: 'done' }
      };

      await taskController.updateTaskStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Task not found' });
    });
  });

  describe('getTasksByAssignee', () => {
    it('should return tasks for given assignee', async () => {
      const tasks = [
        { id: 1, assignee: 'John' },
        { id: 2, assignee: 'John' },
        { id: 3, assignee: 'Jane' }
      ];
      Task.__seed(tasks);
      mockReq = { params: { assignee: 'John' } };

      await taskController.getTasksByAssignee(mockReq, mockRes);

      expect(Task.findAll).toHaveBeenCalledWith({
        where: { assignee: 'John' },
        order: [['created_at', 'DESC']]
      });
      expect(mockRes.json).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should return 500 on database error', async () => {
      Task.findAll.mockRejectedValueOnce(new Error('DB error'));
      mockReq = { params: { assignee: 'John' } };

      await taskController.getTasksByAssignee(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch tasks' });
    });
  });

  describe('getTasksByPriority', () => {
    it('should return tasks with valid priority', async () => {
      const tasks = [
        { id: 1, priority: 'high' },
        { id: 2, priority: 'high' },
        { id: 3, priority: 'low' }
      ];
      Task.__seed(tasks);
      mockReq = { params: { priority: 'high' } };

      await taskController.getTasksByPriority(mockReq, mockRes);

      expect(Task.findAll).toHaveBeenCalledWith({
        where: { priority: 'high' },
        order: [['created_at', 'DESC']]
      });
      expect(mockRes.json).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should return 400 for invalid priority', async () => {
      mockReq = { params: { priority: 'invalid' } };

      await taskController.getTasksByPriority(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid priority. Must be one of: low, medium, high'
      });
    });

    it('should return 500 on database error', async () => {
      Task.findAll.mockRejectedValueOnce(new Error('DB error'));
      mockReq = { params: { priority: 'high' } };

      await taskController.getTasksByPriority(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch tasks' });
    });
  });
});
