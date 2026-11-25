const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatbotItem = sequelize.define('ChatbotItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('brand', 'service'),
    allowNull: false,
    defaultValue: 'brand',
  },
  display_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  }
}, {
  timestamps: true,
  tableName: 'chatbot_items'
});

module.exports = ChatbotItem;
