const porterService = require('../services/porterService');
const DeliveryTask = require('../models/DeliveryTask');
const Donation = require('../models/Donation');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/v1/porter/estimate
 * Returns real-time vehicle options and fare estimates from Porter.
 */
const estimateFare = asyncHandler(async (req, res) => {
  const { pickupLocation, dropoffLocation, quantityServings, distanceKm } = req.body;
  const estimate = await porterService.getFareEstimate({
    pickupLocation,
    dropoffLocation,
    quantityServings,
    distanceKm,
  });

  return ApiResponse.send(res, 200, 'Porter fare estimates generated', estimate);
});

/**
 * POST /api/v1/porter/book
 * Books a live Porter courier dispatch and binds it to a delivery task.
 */
const bookPorter = asyncHandler(async (req, res) => {
  const {
    donationId,
    taskId,
    vehicleType,
    pickup,
    dropoff,
    instructions,
  } = req.body;

  let task = null;
  if (taskId) {
    task = await DeliveryTask.findById(taskId);
  }
  if (!task && donationId) {
    task = await DeliveryTask.findOne({ donationId });
  }

  const pickupInfo = pickup || task?.pickup || {
    location: 'Donor Kitchen Location',
    donorName: 'Donor Kitchen',
    donorPhone: '+91 98765 43210',
  };

  const dropoffInfo = dropoff || task?.dropoff || {
    location: 'Recipient Shelter Location',
    recipientName: 'Community Shelter',
    recipientPhone: '+91 91234 56789',
  };

  const booking = await porterService.createPorterOrder({
    donationId: donationId || task?.donationId || 'don-gen',
    foodName: task?.foodName || 'Surplus Food Rescue Parcel',
    quantity: task?.quantity || '50 servings',
    vehicleType: vehicleType || '3_WHEELER',
    pickup: pickupInfo,
    dropoff: dropoffInfo,
    instructions,
  });

  // If a task exists in DB, update it with Porter details
  if (task) {
    task.deliveryProvider = 'PORTER';
    task.currentMilestone = 'EN_ROUTE_PICKUP';
    task.porterDetails = {
      orderId: booking.orderId,
      crn: booking.crn,
      driverName: booking.driverName,
      driverPhone: booking.driverPhone,
      vehicleNumber: booking.vehicleNumber,
      vehicleType: booking.vehicleType,
      fare: booking.fare,
      trackingUrl: booking.trackingUrl,
      status: booking.status,
      bookedAt: booking.bookedAt,
    };
    await task.save();
  } else if (donationId) {
    // Create new DeliveryTask with Porter provider
    task = await DeliveryTask.create({
      donationId,
      deliveryAgentId: booking.driverPhone,
      foodName: 'Surplus Food Package',
      quantity: '50 servings',
      pickup: pickupInfo,
      dropoff: dropoffInfo,
      currentMilestone: 'EN_ROUTE_PICKUP',
      deliveryProvider: 'PORTER',
      porterDetails: {
        orderId: booking.orderId,
        crn: booking.crn,
        driverName: booking.driverName,
        driverPhone: booking.driverPhone,
        vehicleNumber: booking.vehicleNumber,
        vehicleType: booking.vehicleType,
        fare: booking.fare,
        trackingUrl: booking.trackingUrl,
        status: booking.status,
        bookedAt: booking.bookedAt,
      },
    });
  }

  return ApiResponse.send(res, 201, 'Porter delivery booked successfully', {
    booking,
    task,
  });
});

/**
 * GET /api/v1/porter/track/:orderId
 * Tracks live progress of a Porter courier.
 */
const trackPorter = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { crn } = req.query;
  const trackingData = await porterService.trackPorterOrder(orderId, crn);

  return ApiResponse.send(res, 200, 'Porter tracking details retrieved', trackingData);
});

/**
 * POST /api/v1/porter/webhook
 * Receives live Porter courier milestone callbacks.
 */
const handlePorterWebhook = asyncHandler(async (req, res) => {
  const { order_id, crn, status } = req.body;

  if (order_id || crn) {
    const task = await DeliveryTask.findOne({
      $or: [
        { 'porterDetails.orderId': order_id },
        { 'porterDetails.crn': crn },
      ],
    });

    if (task) {
      if (status === 'PICKED_UP') task.currentMilestone = 'PICKED_UP';
      if (status === 'DELIVERED') task.currentMilestone = 'DELIVERED';
      if (task.porterDetails) task.porterDetails.status = status;
      await task.save();
    }
  }

  return ApiResponse.send(res, 200, 'Webhook acknowledged', { received: true });
});

module.exports = {
  estimateFare,
  bookPorter,
  trackPorter,
  handlePorterWebhook,
};
