const { Bot, ChatbotCategory, ChatbotItem, ChatbotCallbackRequest, PdfDocument } = require('../models');
const { Op } = require('sequelize');

// Helper to verify user owns the bot
const verifyBotOwnership = async (botId, userId) => {
  const bot = await Bot.findOne({ where: { id: botId, user_id: userId } });
  return bot;
};

// -------------------------------------------------------------
// CATEGORIES CRUD
// -------------------------------------------------------------

// GET /api/admin/bots/:botId/categories
exports.getAdminCategories = async (req, res) => {
  try {
    const { botId } = req.params;
    const bot = await verifyBotOwnership(botId, req.user.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found or unauthorized' });

    const categories = await ChatbotCategory.findAll({
      where: { bot_id: botId },
      include: [
        {
          model: ChatbotItem,
          include: [
            {
              model: PdfDocument,
              attributes: ['id', 'file_name', 'status', 'download_enabled']
            }
          ]
        }
      ],
      order: [
        ['display_order', 'ASC'],
        ['name', 'ASC'],
        [ChatbotItem, 'display_order', 'ASC'],
        [ChatbotItem, 'name', 'ASC']
      ]
    });

    res.json(categories);
  } catch (error) {
    console.error('Error in getAdminCategories:', error);
    res.status(500).json({ error: 'Server error fetching categories' });
  }
};

// POST /api/admin/bots/:botId/categories
exports.createCategory = async (req, res) => {
  try {
    const { botId } = req.params;
    const { name, display_order, status } = req.body;

    const bot = await verifyBotOwnership(botId, req.user.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found or unauthorized' });

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Prevent duplicate category name for the same bot
    const existing = await ChatbotCategory.findOne({
      where: {
        bot_id: botId,
        name: trimmedName
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'A category with this name already exists for this bot' });
    }

    const category = await ChatbotCategory.create({
      bot_id: botId,
      name: trimmedName,
      display_order: Number.isInteger(Number(display_order)) ? Number(display_order) : 0,
      status: status === 'inactive' ? 'inactive' : 'active'
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Server error creating category' });
  }
};

// PUT /api/admin/bots/:botId/categories/:categoryId
exports.updateCategory = async (req, res) => {
  try {
    const { botId, categoryId } = req.params;
    const { name, display_order, status } = req.body;

    const bot = await verifyBotOwnership(botId, req.user.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found or unauthorized' });

    const category = await ChatbotCategory.findOne({
      where: { id: categoryId, bot_id: botId }
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    if (name) {
      const trimmedName = name.trim();
      // Check for duplicate name if changed
      if (trimmedName.toLowerCase() !== category.name.toLowerCase()) {
        const existing = await ChatbotCategory.findOne({
          where: {
            bot_id: botId,
            name: trimmedName,
            id: { [Op.ne]: categoryId }
          }
        });
        if (existing) {
          return res.status(400).json({ error: 'Another category with this name already exists' });
        }
      }
      category.name = trimmedName;
    }

    if (display_order !== undefined) {
      category.display_order = Number.isInteger(Number(display_order)) ? Number(display_order) : 0;
    }

    if (status) {
      category.status = status === 'inactive' ? 'inactive' : 'active';
    }

    await category.save();
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Server error updating category' });
  }
};

// DELETE /api/admin/bots/:botId/categories/:categoryId
exports.deleteCategory = async (req, res) => {
  try {
    const { botId, categoryId } = req.params;
    const bot = await verifyBotOwnership(botId, req.user.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found or unauthorized' });

    const category = await ChatbotCategory.findOne({
      where: { id: categoryId, bot_id: botId }
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    // Unmap any PDFs associated with this category
    await PdfDocument.update({ category_id: null, item_id: null }, { where: { category_id: categoryId } });

    await category.destroy();
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Server error deleting category' });
  }
};

// -------------------------------------------------------------
// ITEMS (BRANDS / SERVICES) CRUD
// -------------------------------------------------------------

// GET /api/admin/categories/:categoryId/items
exports.getAdminItems = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const category = await ChatbotCategory.findByPk(categoryId, {
      include: [{ model: Bot }]
    });

    if (!category || !category.Bot || String(category.Bot.user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Category not found or unauthorized' });
    }

    const items = await ChatbotItem.findAll({
      where: { category_id: categoryId },
      include: [
        {
          model: PdfDocument,
          attributes: ['id', 'file_name', 'status', 'download_enabled']
        }
      ],
      order: [
        ['display_order', 'ASC'],
        ['name', 'ASC']
      ]
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching admin items:', error);
    res.status(500).json({ error: 'Server error fetching items' });
  }
};

// POST /api/admin/categories/:categoryId/items
exports.createItem = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, type, display_order, status, pdf_id } = req.body;

    const category = await ChatbotCategory.findByPk(categoryId, {
      include: [{ model: Bot }]
    });

    if (!category || !category.Bot || String(category.Bot.user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Category not found or unauthorized' });
    }

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const itemType = type === 'service' ? 'service' : 'brand';

    // Prevent duplicate item name inside the same category
    const existing = await ChatbotItem.findOne({
      where: {
        category_id: categoryId,
        name: trimmedName
      }
    });

    if (existing) {
      return res.status(400).json({ error: `An item with this name already exists in this category` });
    }

    const item = await ChatbotItem.create({
      category_id: categoryId,
      name: trimmedName,
      type: itemType,
      display_order: Number.isInteger(Number(display_order)) ? Number(display_order) : 0,
      status: status === 'inactive' ? 'inactive' : 'active'
    });

    // If PDF mapping requested
    if (pdf_id) {
      const pdf = await PdfDocument.findOne({
        where: { id: pdf_id, bot_id: category.Bot.id }
      });
      if (pdf) {
        await pdf.update({
          category_id: categoryId,
          item_id: item.id,
          download_enabled: true
        });
      }
    }

    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Server error creating item' });
  }
};

// PUT /api/admin/items/:itemId
exports.updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, type, display_order, status, pdf_id } = req.body;

    const item = await ChatbotItem.findByPk(itemId, {
      include: [{ model: ChatbotCategory, include: [{ model: Bot }] }]
    });

    if (!item || !item.ChatbotCategory?.Bot || String(item.ChatbotCategory.Bot.user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }

    if (name) {
      const trimmedName = name.trim();
      if (trimmedName.toLowerCase() !== item.name.toLowerCase()) {
        const existing = await ChatbotItem.findOne({
          where: {
            category_id: item.category_id,
            name: trimmedName,
            id: { [Op.ne]: itemId }
          }
        });
        if (existing) {
          return res.status(400).json({ error: 'An item with this name already exists in this category' });
        }
      }
      item.name = trimmedName;
    }

    if (type && (type === 'brand' || type === 'service')) {
      item.type = type;
    }

    if (display_order !== undefined) {
      item.display_order = Number.isInteger(Number(display_order)) ? Number(display_order) : 0;
    }

    if (status) {
      item.status = status === 'inactive' ? 'inactive' : 'active';
    }

    await item.save();

    // Handle PDF mapping update if provided
    if (pdf_id !== undefined) {
      // First unassign any current PDF for this item
      await PdfDocument.update(
        { item_id: null },
        { where: { item_id: itemId } }
      );

      if (pdf_id) {
        const pdf = await PdfDocument.findOne({
          where: { id: pdf_id, bot_id: item.ChatbotCategory.Bot.id }
        });
        if (pdf) {
          await pdf.update({
            category_id: item.category_id,
            item_id: item.id,
            download_enabled: true
          });
        }
      }
    }

    res.json(item);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Server error updating item' });
  }
};

// DELETE /api/admin/items/:itemId
exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await ChatbotItem.findByPk(itemId, {
      include: [{ model: ChatbotCategory, include: [{ model: Bot }] }]
    });

    if (!item || !item.ChatbotCategory?.Bot || String(item.ChatbotCategory.Bot.user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }

    // Unassign associated PDFs
    await PdfDocument.update({ item_id: null }, { where: { item_id: itemId } });

    await item.destroy();
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Server error deleting item' });
  }
};

// POST /api/admin/items/:itemId/pdf
exports.mapItemPdf = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { pdf_id, download_enabled } = req.body;

    const item = await ChatbotItem.findByPk(itemId, {
      include: [{ model: ChatbotCategory, include: [{ model: Bot }] }]
    });

    if (!item || !item.ChatbotCategory?.Bot || String(item.ChatbotCategory.Bot.user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }

    // Unassign old PDF mapping
    await PdfDocument.update(
      { item_id: null },
      { where: { item_id: itemId } }
    );

    if (pdf_id) {
      const pdf = await PdfDocument.findOne({
        where: { id: pdf_id, bot_id: item.ChatbotCategory.Bot.id }
      });
      if (!pdf) return res.status(404).json({ error: 'PDF not found for this bot' });

      await pdf.update({
        category_id: item.category_id,
        item_id: item.id,
        download_enabled: download_enabled !== false
      });
    }

    res.json({ message: 'PDF mapped successfully' });
  } catch (error) {
    console.error('Error mapping PDF:', error);
    res.status(500).json({ error: 'Server error mapping PDF' });
  }
};

// -------------------------------------------------------------
// CALLBACK REQUESTS
// -------------------------------------------------------------

// GET /api/admin/bots/:botId/callbacks
exports.getAdminCallbacks = async (req, res) => {
  try {
    const { botId } = req.params;
    const { category_id, item_id, status, search } = req.query;

    const bot = await verifyBotOwnership(botId, req.user.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found or unauthorized' });

    const where = { bot_id: botId };
    if (category_id) where.category_id = category_id;
    if (item_id) where.item_id = item_id;
    if (status) where.status = status;
    if (search) {
      where.mobile = { [Op.like]: `%${search.trim()}%` };
    }

    const callbacks = await ChatbotCallbackRequest.findAll({
      where,
      include: [
        { model: ChatbotCategory, attributes: ['id', 'name'] },
        { model: ChatbotItem, attributes: ['id', 'name', 'type'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(callbacks);
  } catch (error) {
    console.error('Error fetching callbacks:', error);
    res.status(500).json({ error: 'Server error fetching callback requests' });
  }
};

// PUT /api/admin/callbacks/:id/status
exports.updateCallbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'contacted', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const callback = await ChatbotCallbackRequest.findByPk(id, {
      include: [{ model: Bot }]
    });

    if (!callback || !callback.Bot || String(callback.Bot.user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Callback request not found or unauthorized' });
    }

    callback.status = status;
    await callback.save();

    res.json(callback);
  } catch (error) {
    console.error('Error updating callback status:', error);
    res.status(500).json({ error: 'Server error updating callback status' });
  }
};
