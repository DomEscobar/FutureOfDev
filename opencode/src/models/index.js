/**
 * Models Index
 * 
 * Central export point for all Sequelize models.
 * This allows importing models as: const { Task } = require('../models')
 * 
 * @see ARCHITECTURE.md for data flow and integration rules
 */

const Task = require('./Task');

module.exports = {
  Task,
};
