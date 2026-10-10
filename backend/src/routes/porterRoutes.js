const express = require('express');
const router = express.Router();
const {
  estimateFare,
  bookPorter,
  trackPorter,
  handlePorterWebhook,
} = require('../controllers/porterController');

router.post('/estimate', estimateFare);
router.post('/book', bookPorter);
router.get('/track/:orderId', trackPorter);
router.post('/webhook', handlePorterWebhook);

module.exports = router;
