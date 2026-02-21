const sequelize = require('../config/database');
const Task = require('./Task')(sequelize);
const Board = require('./Board')(sequelize);

// Define associations if needed
// Task.belongsTo(Board, { foreignKey: 'boardId' });
// Board.hasMany(Task, { foreignKey: 'boardId' });

module.exports = {
  sequelize,
  Task,
  Board
};
