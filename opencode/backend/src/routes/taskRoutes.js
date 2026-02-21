const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// Task routes
router.get('/', taskController.getAllTasks);
router.get('/status/:status', taskController.getTasksByStatus);
router.get('/assignee/:assignee', taskController.getTasksByAssignee);
router.get('/priority/:priority', taskController.getTasksByPriority);
router.get('/:id', taskController.getTaskById);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.patch('/:id/status', taskController.updateTaskStatus);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
