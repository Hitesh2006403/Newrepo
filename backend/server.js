require('dotenv').config();
const app = require('./app');
const { connectDB, closeDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(
        `[Server] Share A Plate API listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(`[Server Fatal] Initialization failed: ${error.message}`);
    process.exit(1);
  }
};

// Start the HTTP listener
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Graceful shutdown listeners
const handleShutdown = async (signal) => {
  console.log(`[Server] ${signal} signal received. Commencing graceful shutdown...`);
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

module.exports = server;
