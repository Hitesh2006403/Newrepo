const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const { optionalAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/tasks', optionalAuth, deliveryController.getDeliveryTasks);
router.post('/tasks', deliveryController.createDeliveryTask);
router.post('/feasibility', deliveryController.checkFeasibility);
router.patch('/tasks/:id/status', deliveryController.updateDeliveryTaskStatus);
router.post('/tasks/:id/claim', optionalAuth, deliveryController.claimDeliveryTask);

module.exports = router;

