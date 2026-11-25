const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatbotCallbackRequest = sequelize.define('ChatbotCallbackRequest', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  bot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  mobile: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'contacted', 'completed', 'cancelled'),
    defaultValue: 'pending',
  }
}, {
  timestamps: true,
  tableName: 'chatbot_callback_requests'
});

module.exports = ChatbotCallbackRequest;
