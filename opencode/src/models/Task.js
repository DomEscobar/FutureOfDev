const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Task Model
 * 
 * Sequelize model for tasks in the Kanban board.
 * 
 * @see ARCHITECTURE.md for data flow and integration rules
 */
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
        msg: 'Task title is required'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('todo', 'in-progress', 'done'),
    defaultValue: 'todo'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium'
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  columnId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Columns',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  tableName: 'tasks',
  underscored: true
});

module.exports = Task;
