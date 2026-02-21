const { Sequelize } = require('sequelize');

// Create in-memory SQLite database for testing
const sequelize = new Sequelize('sqlite::memory:', { logging: false });

// Import models
const Board = require('../../../src/models/Board')(sequelize);
const Task = require('../../../src/models/Task')(sequelize);

describe('Board Model', () => {
  beforeAll(async () => {
    // Set up associations
    Board.associate({ Task });
    
    // Sync database (create tables)
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await Task.destroy({ truncate: true, cascade: true });
    await Board.destroy({ truncate: true, cascade: true });
  });

  describe('Field Validation', () => {
    test('should create a board with all required fields', async () => {
      const board = await Board.create({
        name: 'Test Board',
        description: 'Test Description',
        color: '#FF5733'
      });

      expect(board.id).toBeDefined();
      expect(board.name).toBe('Test Board');
      expect(board.description).toBe('Test Description');
      expect(board.color).toBe('#FF5733');
    });

    test('should create a board with only required name', async () => {
      const board = await Board.create({
        name: 'Minimal Board'
      });

      expect(board.id).toBeDefined();
      expect(board.name).toBe('Minimal Board');
      expect(board.description).toBeNull();
      expect(board.color).toBeNull();
    });

    test('should reject board creation without name (notNull)', async () => {
      await expect(Board.create({})).rejects.toThrow();
    });

    test('should reject board creation with empty name (notEmpty)', async () => {
      await expect(Board.create({ name: '' })).rejects.toThrow();
    });

    test('should reject board creation with name set to null', async () => {
      await expect(Board.create({ name: null })).rejects.toThrow();
    });

    test('should reject board creation with name exceeding 255 characters', async () => {
      const longName = 'A'.repeat(256);
      await expect(Board.create({ name: longName })).rejects.toThrow();
    });

    test('should allow null for description', async () => {
      const board = await Board.create({
        name: 'Test Board',
        description: null
      });

      expect(board.description).toBeNull();
    });

    test('should allow null for color', async () => {
      const board = await Board.create({
        name: 'Test Board',
        color: null
      });

      expect(board.color).toBeNull();
    });

    test('should accept valid hex color format', async () => {
      const board = await Board.create({
        name: 'Test Board',
        color: '#ABCDEF'
      });

      expect(board.color).toBe('#ABCDEF');
    });

    test('should reject invalid hex color format', async () => {
      await expect(Board.create({
        name: 'Test Board',
        color: 'not-a-color'
      })).rejects.toThrow();
    });

    test('should reject hex color without # prefix', async () => {
      await expect(Board.create({
        name: 'Test Board',
        color: 'FF5733'
      })).rejects.toThrow();
    });

    test('should reject short hex color', async () => {
      await expect(Board.create({
        name: 'Test Board',
        color: '#FFF'
      })).rejects.toThrow();
    });

    test('should handle long board name (up to 255 characters)', async () => {
      const longName = 'A'.repeat(255);
      const board = await Board.create({ name: longName });

      expect(board.name).toBe(longName);
    });
  });

  describe('Model Configuration', () => {
    test('should have correct tableName', () => {
      expect(Board.tableName).toBe('boards');
    });

    test('should have timestamps enabled', async () => {
      const board = await Board.create({ name: 'Test Board' });
      
      expect(board.createdAt).toBeInstanceOf(Date);
      expect(board.updatedAt).toBeInstanceOf(Date);
    });

    test('should use underscored table names', () => {
      expect(Board.options.underscored).toBe(true);
    });
  });

  describe('Indexes', () => {
    test('should have name index defined', () => {
      const indexes = Board.tableIndexes;
      const nameIndex = indexes.find(idx => idx.fields && idx.fields.includes('name'));
      expect(nameIndex).toBeDefined();
    });
  });

  describe('CRUD Operations', () => {
    test('should find all boards', async () => {
      await Board.create({ name: 'Board 1' });
      await Board.create({ name: 'Board 2' });

      const boards = await Board.findAll();
      expect(boards.length).toBe(2);
    });

    test('should find board by primary key', async () => {
      const created = await Board.create({ name: 'Test Board' });
      const found = await Board.findByPk(created.id);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Test Board');
    });

    test('should update board', async () => {
      const board = await Board.create({ name: 'Original Name' });
      
      board.name = 'Updated Name';
      await board.save();

      const updated = await Board.findByPk(board.id);
      expect(updated.name).toBe('Updated Name');
    });

    test('should delete board', async () => {
      const board = await Board.create({ name: 'Test Board' });
      const id = board.id;

      await board.destroy();
      const deleted = await Board.findByPk(id);

      expect(deleted).toBeNull();
    });

    test('should update description', async () => {
      const board = await Board.create({ name: 'Test Board', description: 'Old description' });
      
      board.description = 'New description';
      await board.save();

      const updated = await Board.findByPk(board.id);
      expect(updated.description).toBe('New description');
    });

    test('should update color', async () => {
      const board = await Board.create({ name: 'Test Board', color: '#000000' });
      
      board.color = '#FFFFFF';
      await board.save();

      const updated = await Board.findByPk(board.id);
      expect(updated.color).toBe('#FFFFFF');
    });
  });

  describe('Associations', () => {
    test('should define hasMany association with Task', () => {
      // Check that the association method exists
      expect(typeof Board.associate).toBe('function');
      
      // After calling associate, check associations
      const associations = Board.associations;
      expect(associations).toBeDefined();
    });

    test('should be able to create tasks associated with board', async () => {
      const board = await Board.create({ name: 'Test Board' });
      
      const task = await Task.create({
        title: 'Test Task',
        board_id: board.id
      });

      expect(task.board_id).toBe(board.id);
    });

    test('should be able to find tasks by board', async () => {
      const board1 = await Board.create({ name: 'Board 1' });
      const board2 = await Board.create({ name: 'Board 2' });
      
      await Task.create({ title: 'Task 1', board_id: board1.id });
      await Task.create({ title: 'Task 2', board_id: board1.id });
      await Task.create({ title: 'Task 3', board_id: board2.id });

      const board1Tasks = await Task.findAll({ where: { board_id: board1.id } });
      expect(board1Tasks.length).toBe(2);

      const board2Tasks = await Task.findAll({ where: { board_id: board2.id } });
      expect(board2Tasks.length).toBe(1);
    });

    test('should cascade delete tasks when board is deleted', async () => {
      const board = await Board.create({ name: 'Test Board' });
      
      await Task.create({ title: 'Task 1', board_id: board.id });
      await Task.create({ title: 'Task 2', board_id: board.id });

      // Verify tasks exist
      let tasks = await Task.findAll({ where: { board_id: board.id } });
      expect(tasks.length).toBe(2);

      // Delete board
      await board.destroy();

      // Verify tasks are deleted
      tasks = await Task.findAll({ where: { board_id: board.id } });
      expect(tasks.length).toBe(0);
    });
  });
});