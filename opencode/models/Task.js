/**
 * Task Model
 * 
 * Represents a task in the task board application.
 * Supports both standalone use and integration with Sequelize.
 */

const Task = {
  /**
   * Task status constants
   */
  STATUS: {
    TODO: 'todo',
    IN_PROGRESS: 'inprogress',
    DONE: 'done'
  },

  /**
   * Task priority constants
   */
  PRIORITY: {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  },

  /**
   * Validate task status
   * @param {string} status 
   * @returns {boolean}
   */
  isValidStatus(status) {
    return Object.values(this.STATUS).includes(status);
  },

  /**
   * Validate task priority
   * @param {string} priority 
   * @returns {boolean}
   */
  isValidPriority(priority) {
    return Object.values(this.PRIORITY).includes(priority);
  },

  /**
   * Create a new task object
   * @param {Object} data - Task data
   * @param {string} data.title - Task title (required)
   * @param {string} data.status - Task status (default: 'todo')
   * @param {string} data.priority - Task priority (default: 'medium')
   * @returns {Object} Created task object
   */
  create({ title, status = 'todo', priority = 'medium' }) {
    if (!title || typeof title !== 'string') {
      throw new Error('Title is required and must be a string');
    }

    if (!this.isValidStatus(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    if (!this.isValidPriority(priority)) {
      throw new Error(`Invalid priority: ${priority}`);
    }

    return {
      id: Date.now(),
      title: title.trim(),
      status,
      priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  /**
   * Update a task object
   * @param {Object} task - Task to update
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated task
   */
  update(task, { title, status, priority }) {
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        throw new Error('Title must be a non-empty string');
      }
      task.title = title.trim();
    }

    if (status !== undefined) {
      if (!this.isValidStatus(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      task.status = status;
    }

    if (priority !== undefined) {
      if (!this.isValidPriority(priority)) {
        throw new Error(`Invalid priority: ${priority}`);
      }
      task.priority = priority;
    }

    task.updatedAt = new Date().toISOString();
    return task;
  },

  /**
   * Get Sequelize model definition
   * @param {Object} sequelize - Sequelize instance
   * @returns {Object} Sequelize model
   */
  getSequelizeModel(sequelize) {
    const { DataTypes } = require('sequelize');
    
    return sequelize.define('Task', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      status: {
        type: DataTypes.ENUM('todo', 'inprogress', 'done'),
        defaultValue: 'todo'
      },
      priority: {
        type: DataTypes.ENUM('high', 'medium', 'low'),
        defaultValue: 'medium'
      }
    }, {
      tableName: 'tasks',
      timestamps: true,
      underscored: true
    });
  }
};

module.exports = Task;