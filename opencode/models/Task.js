/**
 * Task Model
 * 
 * Sequelize model definition for Task entity.
 * Supports Kanban board workflow with status and priority tracking.
 */

const { DataTypes } = require('sequelize');

/**
 * Create Task model
 * @param {Object} sequelize - Sequelize instance
 * @returns {Model} Task model
 */
const createTaskModel = (sequelize) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Title is required'
        },
        notNull: {
          msg: 'Title cannot be null'
        },
        len: {
          args: [1, 255],
          msg: 'Title must be between 1 and 255 characters'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 2000],
          msg: 'Description cannot exceed 2000 characters'
        }
      }
    },
    status: {
      type: DataTypes.ENUM('todo', 'inprogress', 'done'),
      defaultValue: 'todo',
      allowNull: false,
      validate: {
        isIn: {
          args: [['todo', 'inprogress', 'done']],
          msg: 'Status must be todo, inprogress, or done'
        }
      }
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
      allowNull: false,
      validate: {
        isIn: {
          args: [['low', 'medium', 'high']],
          msg: 'Priority must be low, medium, or high'
        }
      }
    },
    assignee: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'Assignee name cannot exceed 100 characters'
        }
      }
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        isInt: {
          msg: 'Order must be an integer'
        }
      }
    }
  }, {
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['priority'] },
      { fields: ['assignee'] },
      { fields: ['status', 'order'] },
      { fields: ['created_at'] },
      { fields: ['updated_at'] }
    ],
    hooks: {
      beforeCreate: (task) => {
        if (task.title) {
          task.title = task.title.trim();
        }
        if (task.description) {
          task.description = task.description.trim();
        }
        if (task.assignee) {
          task.assignee = task.assignee.trim();
        }
      },
      beforeUpdate: (task) => {
        if (task.changed('title') && task.title) {
          task.title = task.title.trim();
        }
        if (task.changed('description') && task.description !== undefined) {
          task.description = task.description?.trim() || null;
        }
        if (task.changed('assignee') && task.assignee !== undefined) {
          task.assignee = task.assignee?.trim() || null;
        }
      }
    }
  });

  // Instance methods
  Task.prototype.toJSON = function() {
    const values = { ...this.get() };
    return values;
  };

  Task.prototype.isOverdue = function() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return this.status !== 'done' && this.createdAt < threeDaysAgo;
  };

  // Class methods
  Task.findByStatus = async function(status) {
    return this.findAll({ 
      where: { status },
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });
  };

  Task.findByPriority = async function(priority) {
    return this.findAll({ 
      where: { priority },
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });
  };

  Task.getBoardView = async function() {
    const tasks = await this.findAll({
      order: [['order', 'ASC'], ['createdAt', 'DESC']]
    });
    
    return {
      todo: tasks.filter(t => t.status === 'todo'),
      inprogress: tasks.filter(t => t.status === 'inprogress'),
      done: tasks.filter(t => t.status === 'done')
    };
  };

  return Task;
};

// Status constants
const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'inprogress',
  DONE: 'done'
};

// Priority constants
const TASK_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

module.exports = createTaskModel;
module.exports.TASK_STATUS = TASK_STATUS;
module.exports.TASK_PRIORITY = TASK_PRIORITY;
