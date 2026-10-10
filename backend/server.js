require('dotenv').config();
const app = require('./app');
const { connectDB, closeDB } = require('./src/config/db');
const { startExpirySweeper } = require('./src/services/expirySweeper');

const PORT = process.env.PORT || 5000;

let server;
let sweeperInterval;

/**
 * Validates that all critical secrets and configuration parameters are configured
 * securely when running in production mode.
 *
 * @param {Object} [env=process.env]
 * @throws {Error} If any mandatory variable is missing or retains default placeholder
 */
const validateProductionEnv = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const requiredVariables = [
    'MONGODB_URI',
    'JWT_SECRET',
    'CLIENT_URL',
    'QR_SIGNING_SECRET',
  ];

  const violations = [];

  for (const varName of requiredVariables) {
    const val = env[varName];
    if (!val || typeof val !== 'string' || val.trim() === '') {
      violations.push(`${varName} is missing`);
    } else if (val.toLowerCase().includes('change-me')) {
      violations.push(`${varName} still contains placeholder "change-me"`);
    }
  }

  if (violations.length > 0) {
    const errorMsg = `[Fatal Startup Guard] Production environment validation failed:\n - ${violations.join(
      '\n - '
    )}`;
    throw new Error(errorMsg);
  }
};

const startServer = async () => {
  try {
    validateProductionEnv();
    await connectDB();
    sweeperInterval = startExpirySweeper(300000); // 5 minutes
    server = app.listen(PORT, () => {
      console.log(
        `[Server] Share A Plate API listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
    });
    return server;
  } catch (error) {
    console.error(`[Server Fatal] Initialization failed: ${error.message}`);
    process.exit(1);
  }
};

// Start the HTTP listener in non-test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Graceful shutdown listeners
const handleShutdown = async (signal) => {
  console.log(`[Server] ${signal} signal received. Commencing graceful shutdown...`);
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
  }
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP connection pool drained and server closed.');
      await closeDB();
      process.exit(0);
    });
  } else {
    await closeDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Process Error] Unhandled Rejection detected:', reason);
  handleShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('[Process Error] Uncaught Exception detected:', err.message);
  process.exit(1);
});

module.exports = {
  server,
  startServer,
  validateProductionEnv,
};
