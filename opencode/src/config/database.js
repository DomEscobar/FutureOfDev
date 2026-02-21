const { Sequelize } = require('sequelize');
const path = require('path');

/**
 * Database Configuration
 * 
 * Uses SQLite for development/testing.
 * Update for production to use PostgreSQL or MySQL.
 */
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database.sqlite'),
  logging: false,
  define: {
    timestamps: true,
    underscored: true
  }
});

module.exports = sequelize;
