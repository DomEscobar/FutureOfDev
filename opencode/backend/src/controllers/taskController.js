const { Task } = require('../models');

class TaskController {
  // Get all tasks
  async getAllTasks(req, res) {
    try {
      const tasks = await Task.findAll({
        order: [['created_at', 'DESC']]
      });
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  // Get single task by ID
  async getTaskById(req, res) {
    try {
      const { id } = req.params;
      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  }

  // Create new task
  async createTask(req, res) {
    try {
      const { title, description, status, priority, assignee } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const task = await Task.create({
        title,
        description: description || '',
        status: status || 'todo',
        priority: priority || 'medium',
        assignee: assignee || null
      });

      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: error.errors.map(e => e.message)
        });
      }
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  // Update task
  async updateTask(req, res) {
    try {
      const { id } = req.params;
      const { title, description, status, priority, assignee } = req.body;

      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (priority !== undefined) updates.priority = priority;
      if (assignee !== undefined) updates.assignee = assignee;

      await task.update(updates);
      res.json(task);
    } catch (error) {
      console.error('Error updating task:', error);
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: error.errors.map(e => e.message)
        });
      }
      res.status(500).json({ error: 'Failed to update task' });
    }
  }

  // Delete task
  async deleteTask(req, res) {
    try {
      const { id } = req.params;
      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      await task.destroy();
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  }

  // Get tasks by status
  async getTasksByStatus(req, res) {
    try {
      const { status } = req.params;
      const validStatuses = ['todo', 'inprogress', 'done'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status. Must be one of: todo, inprogress, done' 
        });
      }

      const tasks = await Task.findAll({
        where: { status },
        order: [['order', 'ASC'], ['created_at', 'DESC']]
      });

      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks by status:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  // Update task status
  async updateTaskStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['todo', 'inprogress', 'done'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status. Must be one of: todo, inprogress, done' 
        });
      }

      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      await task.update({ status });
      res.json(task);
    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(500).json({ error: 'Failed to update task status' });
    }
  }

  // Get tasks by assignee
  async getTasksByAssignee(req, res) {
    try {
      const { assignee } = req.params;
      const tasks = await Task.findAll({
        where: { assignee },
        order: [['created_at', 'DESC']]
      });
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks by assignee:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  // Get tasks by priority
  async getTasksByPriority(req, res) {
    try {
      const { priority } = req.params;
      const validPriorities = ['low', 'medium', 'high'];

      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ 
          error: 'Invalid priority. Must be one of: low, medium, high' 
        });
      }

      const tasks = await Task.findAll({
        where: { priority },
        order: [['created_at', 'DESC']]
      });

      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks by priority:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }
}

module.exports = new TaskController();
