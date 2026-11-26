const { sequelize } = require('../config/database');

const User = require('./User');
const Bot = require('./Bot');
const Visitor = require('./Visitor');
const Conversation = require('./Conversation');
const Message = require('./Message');
const PdfDocument = require('./PdfDocument');
const PdfChunk = require('./PdfChunk');
const ChatbotCategory = require('./ChatbotCategory');
const ChatbotItem = require('./ChatbotItem');
const ChatbotCallbackRequest = require('./ChatbotCallbackRequest');

// Associations
User.hasMany(Bot, { foreignKey: 'user_id' });
Bot.belongsTo(User, { foreignKey: 'user_id' });

Bot.hasMany(Conversation, { foreignKey: 'bot_id' });
Conversation.belongsTo(Bot, { foreignKey: 'bot_id' });

Visitor.hasMany(Conversation, { foreignKey: 'visitor_id', constraints: false });
Conversation.belongsTo(Visitor, { foreignKey: 'visitor_id', constraints: false });

User.hasMany(Conversation, { foreignKey: 'user_id', constraints: false });
Conversation.belongsTo(User, { foreignKey: 'user_id', constraints: false });

Conversation.hasMany(Message, { foreignKey: 'conversation_id' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id' });

Bot.hasMany(PdfDocument, { foreignKey: 'bot_id' });
PdfDocument.belongsTo(Bot, { foreignKey: 'bot_id' });

PdfDocument.hasMany(PdfChunk, { foreignKey: 'pdf_id', onDelete: 'CASCADE' });
PdfChunk.belongsTo(PdfDocument, { foreignKey: 'pdf_id' });

Bot.hasMany(PdfChunk, { foreignKey: 'bot_id', onDelete: 'CASCADE' });
PdfChunk.belongsTo(Bot, { foreignKey: 'bot_id' });

// Guided Chatbot Category & Brand/Service Associations
Bot.hasMany(ChatbotCategory, { foreignKey: 'bot_id', onDelete: 'CASCADE' });
ChatbotCategory.belongsTo(Bot, { foreignKey: 'bot_id' });

ChatbotCategory.hasMany(ChatbotItem, { foreignKey: 'category_id', onDelete: 'CASCADE' });
ChatbotItem.belongsTo(ChatbotCategory, { foreignKey: 'category_id' });

ChatbotCategory.hasMany(PdfDocument, { foreignKey: 'category_id', constraints: false });
PdfDocument.belongsTo(ChatbotCategory, { foreignKey: 'category_id', constraints: false });

ChatbotItem.hasMany(PdfDocument, { foreignKey: 'item_id', constraints: false });
PdfDocument.belongsTo(ChatbotItem, { foreignKey: 'item_id', constraints: false });

Bot.hasMany(ChatbotCallbackRequest, { foreignKey: 'bot_id', onDelete: 'CASCADE' });
ChatbotCallbackRequest.belongsTo(Bot, { foreignKey: 'bot_id' });

ChatbotCategory.hasMany(ChatbotCallbackRequest, { foreignKey: 'category_id', onDelete: 'CASCADE' });
ChatbotCallbackRequest.belongsTo(ChatbotCategory, { foreignKey: 'category_id' });

ChatbotItem.hasMany(ChatbotCallbackRequest, { foreignKey: 'item_id', onDelete: 'CASCADE' });
ChatbotCallbackRequest.belongsTo(ChatbotItem, { foreignKey: 'item_id' });

Visitor.hasMany(ChatbotCallbackRequest, { foreignKey: 'visitor_id', constraints: false });
ChatbotCallbackRequest.belongsTo(Visitor, { foreignKey: 'visitor_id', constraints: false });

Conversation.hasMany(ChatbotCallbackRequest, { foreignKey: 'conversation_id', constraints: false });
ChatbotCallbackRequest.belongsTo(Conversation, { foreignKey: 'conversation_id', constraints: false });

module.exports = {
  sequelize,
  User,
  Bot,
  Visitor,
  Conversation,
  Message,
  PdfDocument,
  PdfChunk,
  ChatbotCategory,
  ChatbotItem,
  ChatbotCallbackRequest
};

