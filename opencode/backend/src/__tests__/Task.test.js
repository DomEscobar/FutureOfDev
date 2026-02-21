const { Sequelize, DataTypes } = require('sequelize');

// Create in-memory SQLite database for testing
const sequelize = new Sequelize('sqlite::memory:', { logging: false });

// Import the Task model
const Task = require('../../../src/models/Task')(sequelize);

describe('Task Model', () => {
  beforeAll(async () => {
    // Sync database (create tables)
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await Task.destroy({ truncate: true, cascade: true });
  });

  describe('Field Validation', () => {
    test('should create a task with all required fields', async () => {
      const task = await Task.create({
        title: 'Test Task',
        description: 'Test Description',
        status: 'todo',
        priority: 'high',
        assignee: 'John Doe',
        order: 1
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Test Description');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('high');
      expect(task.assignee).toBe('John Doe');
      expect(task.order).toBe(1);
    });

    test('should create a task with only required title (optional fields use defaults)', async () => {
      const task = await Task.create({
        title: 'Minimal Task'
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Minimal Task');
      expect(task.description).toBeNull();
      expect(task.status).toBe('todo'); // default value
      expect(task.priority).toBe('medium'); // default value
      expect(task.assignee).toBeNull();
      expect(task.order).toBe(0); // default value
    });

    test('should reject task creation without title (notNull)', async () => {
      await expect(Task.create({})).rejects.toThrow();
    });

    test('should reject task creation with empty title (notEmpty)', async () => {
      await expect(Task.create({ title: '' })).rejects.toThrow();
    });

    test('should reject task creation with title set to null', async () => {
      await expect(Task.create({ title: null })).rejects.toThrow();
    });

    test('should allow null for description', async () => {
      const task = await Task.create({
        title: 'Test Task',
        description: null
      });

      expect(task.description).toBeNull();
    });

    test('should allow null for assignee', async () => {
      const task = await Task.create({
        title: 'Test Task',
        assignee: null
      });

      expect(task.assignee).toBeNull();
    });

    test('should set default values correctly', async () => {
      const task = await Task.create({
        title: 'Test Task'
      });

      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.order).toBe(0);
    });

    test('should handle long title (up to STRING limit)', async () => {
      const longTitle = 'A'.repeat(255);
      const task = await Task.create({ title: longTitle });

      expect(task.title).toBe(longTitle);
    });
  });

  describe('Status Enum Validation', () => {
    test('should accept valid status: todo', async () => {
      const task = await Task.create({
        title: 'Test Task',
        status: 'todo'
      });

      expect(task.status).toBe('todo');
    });

    test('should accept valid status: inprogress', async () => {
      const task = await Task.create({
        title: 'Test Task',
        status: 'inprogress'
      });

      expect(task.status).toBe('inprogress');
    });

    test('should accept valid status: done', async () => {
      const task = await Task.create({
        title: 'Test Task',
        status: 'done'
      });

      expect(task.status).toBe('done');
    });

    test('should reject invalid status value', async () => {
      await expect(Task.create({
        title: 'Test Task',
        status: 'invalid_status'
      })).rejects.toThrow();
    });

    test('should reject status set to null', async () => {
      await expect(Task.create({
        title: 'Test Task',
        status: null
      })).rejects.toThrow();
    });

    test('should update status to valid values', async () => {
      const task = await Task.create({ title: 'Test Task' });
      
      task.status = 'inprogress';
      await task.save();
      expect(task.status).toBe('inprogress');

      task.status = 'done';
      await task.save();
      expect(task.status).toBe('done');
    });
  });

  describe('Priority Enum Validation', () => {
    test('should accept valid priority: low', async () => {
      const task = await Task.create({
        title: 'Test Task',
        priority: 'low'
      });

      expect(task.priority).toBe('low');
    });

    test('should accept valid priority: medium', async () => {
      const task = await Task.create({
        title: 'Test Task',
        priority: 'medium'
      });

      expect(task.priority).toBe('medium');
    });

    test('should accept valid priority: high', async () => {
      const task = await Task.create({
        title: 'Test Task',
        priority: 'high'
      });

      expect(task.priority).toBe('high');
    });

    test('should reject invalid priority value', async () => {
      await expect(Task.create({
        title: 'Test Task',
        priority: 'urgent'
      })).rejects.toThrow();
    });

    test('should reject priority set to null', async () => {
      await expect(Task.create({
        title: 'Test Task',
        priority: null
      })).rejects.toThrow();
    });

    test('should update priority to valid values', async () => {
      const task = await Task.create({ title: 'Test Task' });
      
      task.priority = 'high';
      await task.save();
      expect(task.priority).toBe('high');

      task.priority = 'low';
      await task.save();
      expect(task.priority).toBe('low');
    });
  });

  describe('Indexes', () => {
    test('should have status index defined', () => {
      const indexes = Task.tableIndexes;
      const statusIndex = indexes.find(idx => idx.fields && idx.fields.includes('status'));
      expect(statusIndex).toBeDefined();
    });

    test('should have priority index defined', () => {
      const indexes = Task.tableIndexes;
      const priorityIndex = indexes.find(idx => idx.fields && idx.fields.includes('priority'));
      expect(priorityIndex).toBeDefined();
    });

    test('should have assignee index defined', () => {
      const indexes = Task.tableIndexes;
      const assigneeIndex = indexes.find(idx => idx.fields && idx.fields.includes('assignee'));
      expect(assigneeIndex).toBeDefined();
    });

    test('should have compound index on status and order', () => {
      const indexes = Task.tableIndexes;
      const compoundIndex = indexes.find(
        idx => idx.fields && idx.fields.includes('status') && idx.fields.includes('order')
      );
      expect(compoundIndex).toBeDefined();
    });
  });

  describe('Model Configuration', () => {
    test('should have correct tableName', () => {
      expect(Task.tableName).toBe('tasks');
    });

    test('should have timestamps enabled', () => {
      const task = Task.build({ title: 'Test Task' });
      expect(task.dataValues.createdAt).toBeUndefined(); // Not set until saved
      
      // After save, timestamps should be set
      return task.save().then(savedTask => {
        expect(savedTask.createdAt).toBeInstanceOf(Date);
        expect(savedTask.updatedAt).toBeInstanceOf(Date);
      });
    });

    test('should use underscored table names', () => {
      expect(Task.options.underscored).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    test('should find all tasks', async () => {
      await Task.create({ title: 'Task 1' });
      await Task.create({ title: 'Task 2' });

      const tasks = await Task.findAll();
      expect(tasks.length).toBe(2);
    });

    test('should find task by primary key', async () => {
      const created = await Task.create({ title: 'Test Task' });
      const found = await Task.findByPk(created.id);

      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Test Task');
    });

    test('should update task', async () => {
      const task = await Task.create({ title: 'Original Title' });
      
      task.title = 'Updated Title';
      await task.save();

      const updated = await Task.findByPk(task.id);
      expect(updated.title).toBe('Updated Title');
    });

    test('should delete task', async () => {
      const task = await Task.create({ title: 'Test Task' });
      const id = task.id;

      await task.destroy();
      const deleted = await Task.findByPk(id);

      expect(deleted).toBeNull();
    });

    test('should find tasks with where clause (status)', async () => {
      await Task.create({ title: 'Task 1', status: 'todo' });
      await Task.create({ title: 'Task 2', status: 'done' });
      await Task.create({ title: 'Task 3', status: 'todo' });

      const todoTasks = await Task.findAll({ where: { status: 'todo' } });
      expect(todoTasks.length).toBe(2);
    });

    test('should find tasks with where clause (priority)', async () => {
      await Task.create({ title: 'Task 1', priority: 'high' });
      await Task.create({ title: 'Task 2', priority: 'low' });
      await Task.create({ title: 'Task 3', priority: 'high' });

      const highPriorityTasks = await Task.findAll({ where: { priority: 'high' } });
      expect(highPriorityTasks.length).toBe(2);
    });

    test('should find tasks ordered by order field', async () => {
      await Task.create({ title: 'Task 1', order: 3 });
      await Task.create({ title: 'Task 2', order: 1 });
      await Task.create({ title: 'Task 3', order: 2 });

      const tasks = await Task.findAll({ order: [['order', 'ASC']] });
      expect(tasks[0].order).toBe(1);
      expect(tasks[1].order).toBe(2);
      expect(tasks[2].order).toBe(3);
    });
  });
});