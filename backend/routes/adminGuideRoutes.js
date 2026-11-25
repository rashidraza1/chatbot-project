const express = require('express');
const router = express.Router();
const adminGuideController = require('../controllers/adminGuideController');
const { protect } = require('../middleware/authMiddleware');

// All admin guide routes are protected
router.use(protect);

// Categories
router.get('/bots/:botId/categories', adminGuideController.getAdminCategories);
router.post('/bots/:botId/categories', adminGuideController.createCategory);
router.put('/bots/:botId/categories/:categoryId', adminGuideController.updateCategory);
router.delete('/bots/:botId/categories/:categoryId', adminGuideController.deleteCategory);

// Items (Brands / Services)
router.get('/categories/:categoryId/items', adminGuideController.getAdminItems);
router.post('/categories/:categoryId/items', adminGuideController.createItem);
router.put('/items/:itemId', adminGuideController.updateItem);
router.delete('/items/:itemId', adminGuideController.deleteItem);
router.post('/items/:itemId/pdf', adminGuideController.mapItemPdf);

// Callbacks
router.get('/bots/:botId/callbacks', adminGuideController.getAdminCallbacks);
router.put('/callbacks/:id/status', adminGuideController.updateCallbackStatus);

module.exports = router;
