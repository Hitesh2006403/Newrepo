const express = require('express');
const deliveryController = require('../controllers/deliveryController');

const router = express.Router();

router.get('/tasks', deliveryController.getDeliveryTasks);
router.post('/tasks', deliveryController.createDeliveryTask);
router.patch('/tasks/:id/status', deliveryController.updateDeliveryTaskStatus);

module.exports = router;
