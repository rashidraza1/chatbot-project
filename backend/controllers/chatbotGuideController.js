const path = require('path');
const fs = require('fs');
const { Bot, ChatbotCategory, ChatbotItem, ChatbotCallbackRequest, PdfDocument } = require('../models');

// GET /api/chatbot/:botId/categories
exports.getCategories = async (req, res) => {
  try {
    const { botId } = req.params;
    const bot = await Bot.findByPk(botId);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const categories = await ChatbotCategory.findAll({
      where: {
        bot_id: botId,
        status: 'active'
      },
      order: [
        ['display_order', 'ASC'],
        ['name', 'ASC']
      ],
      attributes: ['id', 'bot_id', 'name', 'display_order', 'status']
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// GET /api/chatbot/:botId/categories/:categoryId/items
exports.getItemsByCategory = async (req, res) => {
  try {
    const { botId, categoryId } = req.params;

    // Validate category belongs to bot
    const category = await ChatbotCategory.findOne({
      where: { id: categoryId, bot_id: botId, status: 'active' }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found for this bot' });
    }

    const items = await ChatbotItem.findAll({
      where: {
        category_id: categoryId,
        status: 'active'
      },
      order: [
        ['display_order', 'ASC'],
        ['name', 'ASC']
      ],
      attributes: ['id', 'category_id', 'name', 'type', 'display_order', 'status']
    });

    res.json({
      category: {
        id: category.id,
        name: category.name
      },
      items
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

// GET /api/chatbot/:botId/items/:itemId
exports.getItemDetails = async (req, res) => {
  try {
    const { botId, itemId } = req.params;

    const item = await ChatbotItem.findByPk(itemId, {
      include: [
        {
          model: ChatbotCategory,
          attributes: ['id', 'bot_id', 'name']
        }
      ]
    });

    if (!item || !item.ChatbotCategory || String(item.ChatbotCategory.bot_id) !== String(botId)) {
      return res.status(404).json({ error: 'Item not found for this bot' });
    }

    // Find mapped PDF document for this item (if any)
    const pdf = await PdfDocument.findOne({
      where: {
        bot_id: botId,
        item_id: itemId
      },
      attributes: ['id', 'file_name', 'status', 'download_enabled']
    });

    res.json({
      item: {
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        type: item.type,
        category_name: item.ChatbotCategory.name
      },
      document: pdf ? {
        id: pdf.id,
        file_name: pdf.file_name,
        status: pdf.status,
        download_enabled: pdf.download_enabled
      } : null
    });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ error: 'Failed to fetch item details' });
  }
};

// GET /api/chatbot/documents/:documentId/download
exports.downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await PdfDocument.findByPk(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.download_enabled === false) {
      return res.status(403).json({ error: 'Document download is disabled' });
    }

    let resolvedPath = document.file_path;
    if (!fs.existsSync(resolvedPath)) {
      const filename = path.basename((document.file_path || '').replace(/\\/g, '/'));
      const fallbackPath = path.join(__dirname, '..', 'uploads', filename);
      if (fs.existsSync(fallbackPath)) {
        resolvedPath = fallbackPath;
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Physical document file missing on server' });
    }

    // Set secure headers and stream file without exposing filesystem path
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.file_name)}"`);

    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
};

// POST /api/chatbot/callback
exports.requestCallback = async (req, res) => {
  try {
    const { bot_id, category_id, item_id, mobile } = req.body;

    if (!bot_id || !category_id || !item_id || !mobile) {
      return res.status(400).json({ error: 'bot_id, category_id, item_id, and mobile are required.' });
    }

    // Mobile number validation: Clean and check Indian 10-digit mobile number
    const trimmed = String(mobile).trim();
    // Match optional +91 or 91, then 10 digits starting with 6, 7, 8, or 9
    const indianMobileRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
    if (!indianMobileRegex.test(trimmed)) {
      return res.status(400).json({
        error: 'Please enter a valid 10-digit Indian mobile number (e.g., 9876543210).'
      });
    }

    // Extract exact 10 digits
    const cleanedMobile = trimmed.replace(/\D/g, '').slice(-10);

    // Security validation: verify relationship between bot, category, and item
    const item = await ChatbotItem.findByPk(item_id, {
      include: [{ model: ChatbotCategory }]
    });

    if (
      !item ||
      String(item.category_id) !== String(category_id) ||
      !item.ChatbotCategory ||
      String(item.ChatbotCategory.bot_id) !== String(bot_id)
    ) {
      return res.status(400).json({ error: 'Invalid category or item relationship for this bot.' });
    }

    const callbackRecord = await ChatbotCallbackRequest.create({
      bot_id,
      category_id,
      item_id,
      mobile: cleanedMobile,
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Callback request received successfully.',
      callback_id: callbackRecord.id
    });
  } catch (error) {
    console.error('Error recording callback request:', error);
    res.status(500).json({ error: 'Failed to record callback request' });
  }
};
