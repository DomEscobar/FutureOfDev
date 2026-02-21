const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite for simplicity
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

// Define Task Model
const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Title is required'
      },
      notNull: {
        msg: 'Title cannot be null'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('todo', 'inprogress', 'done'),
    defaultValue: 'todo',
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
    allowNull: false
  },
  assignee: {
    type: DataTypes.STRING,
    allowNull: true
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  tableName: 'tasks',
  timestamps: true,
  underscored: true
});

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());

// Serve static files from root
app.use(express.static(path.join(__dirname)));

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body.title) {
    req.body.title = req.body.title.trim().replace(/[<>]/g, '');
  }
  if (req.body.description) {
    req.body.description = req.body.description.trim().replace(/[<>]/g, '');
  }
  if (req.body.assignee) {
    req.body.assignee = req.body.assignee.trim().replace(/[<>]/g, '');
  }
  next();
};

app.use(sanitizeInput);

// API Routes

// GET /api/tasks - Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { status, priority } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (priority) where.priority = priority;
    
    const tasks = await Task.findAll({ 
      where,
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id - Get single task
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks - Create new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, status, priority, assignee } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Validate status
    const validStatuses = ['todo', 'inprogress', 'done'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }
    
    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || null,
      status: status || 'todo',
      priority: priority || 'medium',
      assignee: assignee?.trim() || null
    });
    
    res.status(201).json(task);
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const { title, description, status, priority, assignee, order } = req.body;
    
    // Validate status
    if (status) {
      const validStatuses = ['todo', 'inprogress', 'done'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
    }
    
    // Validate priority
    if (priority) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority value' });
      }
    }
    
    await task.update({
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assignee !== undefined && { assignee: assignee?.trim() || null }),
      ...(order !== undefined && { order })
    });
    
    res.json(task);
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await task.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync();
    console.log('Database synchronized.');
    
    // Seed initial data if empty
    const taskCount = await Task.count();
    if (taskCount === 0) {
      await Task.bulkCreate([
        { title: 'Setup project structure', status: 'done', priority: 'high', order: 1 },
        { title: 'Create Task model', status: 'done', priority: 'high', order: 2 },
        { title: 'Build frontend UI', status: 'inprogress', priority: 'medium', order: 3 },
        { title: 'Add task filtering', status: 'todo', priority: 'low', order: 4 },
        { title: 'Implement drag and drop', status: 'todo', priority: 'medium', order: 5 }
      ]);
      console.log('Initial tasks seeded.');
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, Task, sequelize };
