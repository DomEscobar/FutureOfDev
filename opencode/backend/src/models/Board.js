const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Board = sequelize.define('Board', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Board name is required'
        },
        notNull: {
          msg: 'Board name cannot be null'
        },
        len: {
          args: [1, 255],
          msg: 'Board name must be between 1 and 255 characters'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        isHexColor(value) {
          if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
            throw new Error('Color must be a valid hex color code (e.g., #FF5733)');
          }
        }
      }
    }
  }, {
    tableName: 'boards',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['name']
      }
    ]
  });

  // Define associations
  Board.associate = (models) => {
    Board.hasMany(models.Task, {
      foreignKey: 'board_id',
      as: 'tasks',
      onDelete: 'CASCADE'
    });
  };

  return Board;
};