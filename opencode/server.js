const express = require('express');
const cors = require('cors');
const path = require('path');

// Simple in-memory task store (can be replaced with database later)
let tasks = [
  { id: 1, title: 'Setup project structure', status: 'done', priority: 'high' },
  { id: 2, title: 'Create Task model', status: 'done', priority: 'high' },
  { id: 3, title: 'Build frontend UI', status: 'inprogress', priority: 'medium' },
  { id: 4, title: 'Add task filtering', status: 'todo', priority: 'low' },
  { id: 5, title: 'Implement drag and drop', status: 'todo', priority: 'medium' },
];

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API Routes
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const { title, status, priority } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const newTask = {
    id: tasks.length + 1,
    title,
    status: status || 'todo',
    priority: priority || 'medium'
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, status, priority } = req.body;
  
  if (title) task.title = title;
  if (status) task.status = status;
  if (priority) task.priority = priority;

  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const index = tasks.findIndex(t => t.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks.splice(index, 1);
  res.status(204).send();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;