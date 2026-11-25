const express = require('express');
const router = express.Router();
const chatbotGuideController = require('../controllers/chatbotGuideController');

// Public widget routes
router.get('/:botId/categories', chatbotGuideController.getCategories);
router.get('/:botId/categories/:categoryId/items', chatbotGuideController.getItemsByCategory);
router.get('/:botId/items/:itemId', chatbotGuideController.getItemDetails);
router.get('/documents/:documentId/download', chatbotGuideController.downloadDocument);
router.post('/callback', chatbotGuideController.requestCallback);

module.exports = router;
