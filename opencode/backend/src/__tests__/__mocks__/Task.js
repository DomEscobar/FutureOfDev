// Mock Task model for testing
const mockTaskInstances = new Map();

const createMockTaskInstance = (data) => ({
  id: data.id || 1,
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
  const task = mockTaskInstances.get(id);
  return Promise.resolve(task || null);
});

Task.create.mockImplementation((data) => {
  const id = mockTaskInstances.size + 1;
  const task = createMockTaskInstance({ ...data, id });
  mockTaskInstances.set(id, task);
  return Promise.resolve(task);
});

// Helper function to reset and seed mock data
Task.__reset = () => {
  mockTaskInstances.clear();
};

Task.__seed = (tasks) => {
  mockTaskInstances.clear();
  tasks.forEach(task => {
    mockTaskInstances.set(task.id, createMockTaskInstance(task));
  });
};

Task.__getMockInstances = () => mockTaskInstances;

module.exports = Task;
