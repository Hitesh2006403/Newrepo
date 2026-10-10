const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * List all users with pagination and optional filtering by role, isVerified, isActive.
 */
const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.role) {
    filter.role = req.query.role;
  }
  if (req.query.isVerified !== undefined) {
    filter.isVerified = req.query.isVerified === 'true';
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return ApiResponse.send(res, 200, 'Users retrieved successfully', users, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * Approve and verify a user account (recipient or delivery agent).
 */
const verifyUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `User with ID '${id}' not found`);
  }

  user.isVerified = true;
  await user.save();

  return ApiResponse.send(res, 200, 'User account verified successfully', { user });
});

/**
 * Deactivate a user account.
 * INVARIANT: An administrator cannot deactivate their own account.
 */
const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user._id.toString() === id) {
    throw new ApiError(
      400,
      'CANNOT_DEACTIVATE_SELF',
      'Administrators cannot deactivate their own account'
    );
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, ERROR_CODES.NOT_FOUND, `User with ID '${id}' not found`);
  }

  user.isActive = false;
  await user.save();

  return ApiResponse.send(res, 200, 'User account deactivated successfully', { user });
});

module.exports = {
  listUsers,
  verifyUser,
  deactivateUser,
};
