const User = require('../models/User');
const authService = require('../services/authService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Register a new user (donor, recipient, or delivery agent).
 * Admin registration via this endpoint is strictly rejected.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, location, address, organization } = req.body;

  // Check for duplicate email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'An account with this email address already exists');
  }

  // Create user record
  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    location,
    address,
    organization,
  });

  // Generate JWT containing ONLY user ID
  const token = authService.generateToken(user._id);

  return ApiResponse.send(res, 201, 'User registered successfully', {
    user,
    token,
  });
});

/**
 * Authenticate user with email and password.
 * TIMING ATTACK MITIGATION: Runs dummy bcrypt comparison on non-existent emails and
 * returns identical generic error message for both invalid email and invalid password.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +isActive');

  if (!user) {
    // Perform dummy bcrypt comparison to equalize execution time
    await authService.dummyCompare(password);
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid email or password');
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      ERROR_CODES.DEACTIVATED_ACCOUNT,
      'This account has been deactivated. Access is denied.'
    );
  }

  const token = authService.generateToken(user._id);

  return ApiResponse.send(res, 200, 'Login successful', {
    user,
    token,
  });
});

/**
 * Client-side logout acknowledgment.
 */
const logout = asyncHandler(async (req, res) => {
  return ApiResponse.send(res, 200, 'Logged out successfully');
});

/**
 * Retrieve authenticated user's current profile.
 */
const getMe = asyncHandler(async (req, res) => {
  return ApiResponse.send(res, 200, 'Current user profile retrieved', {
    user: req.user,
  });
});

module.exports = {
  register,
  login,
  logout,
  getMe,
};
