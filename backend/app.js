const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRouter = require('./src/routes/index');
const notFoundHandler = require('./src/middlewares/notFoundHandler');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();

// 1. Security Headers
app.use(helmet());

// 2. Cross-Origin Resource Sharing (whitelisted to frontend CLIENT_URL)
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// 3. HTTP Request Logging (suppressed during automated tests)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 4. Body Parsers with Strict Payload Size Limits (DoS mitigation)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 5. Mount API Routes
app.use('/api/v1', apiRouter);

// 6. 404 Route Catch-All
app.use(notFoundHandler);

// 7. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
