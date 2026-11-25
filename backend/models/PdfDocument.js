const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PdfDocument = sequelize.define('PdfDocument', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  bot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  download_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  timestamps: true,
  tableName: 'pdf_documents'
});

module.exports = PdfDocument;
