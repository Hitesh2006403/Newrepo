const express = require('express');
const reviewController = require('../controllers/reviewController');

const router = express.Router();

router.get('/', reviewController.listReviews);
router.post('/', reviewController.createReview);

module.exports = router;
