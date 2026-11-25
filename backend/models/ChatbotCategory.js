const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatbotCategory = sequelize.define('ChatbotCategory', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  bot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
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
  tableName: 'chatbot_categories'
});

module.exports = ChatbotCategory;
