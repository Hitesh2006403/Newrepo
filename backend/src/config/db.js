const mongoose = require('mongoose');
const os = require('os');

/**
 * Connects to MongoDB Atlas using Mongoose.
 * SECURITY: Never logs connection strings, passwords, or credentials.
 *
 * @param {string} [uri] - Optional MongoDB URI (defaults to process.env.MONGODB_URI)
 * @param {object} [options] - Additional Mongoose connection options
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async (uri = process.env.MONGODB_URI, options = {}) => {
  if (!uri) {
    throw new Error('Database connection failed: MONGODB_URI is not defined in environment');
  }

  try {
    const conn = await mongoose.connect(uri, {
      runtimeAdapters: { os },
      ...options,
    });

    // Safe sanitized logging: prints host and database name ONLY, never credentials
    const host = conn.connection.host;
    const dbName = conn.connection.name;
    console.log(`[Database] MongoDB connected successfully to host "${host}", db "${dbName}"`);

    return conn;
  } catch (error) {
    // Log error message safely without leaking the connection URI
    console.error(`[Database Error] Connection attempt failed: ${error.message}`);
    throw error;
  }
};

/**
 * Gracefully closes the MongoDB connection.
 * @returns {Promise<void>}
 */
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed gracefully');
  } catch (error) {
    console.error(`[Database Error] Error during connection closure: ${error.message}`);
    throw error;
  }
};

module.exports = {
  connectDB,
  closeDB,
};
