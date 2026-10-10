const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const querySanitizer = require('./src/middlewares/querySanitizer');
const apiRouter = require('./src/routes/index');
const notFoundHandler = require('./src/middlewares/notFoundHandler');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();

// 1. Security Headers
app.use(helmet());

// 2. Cross-Origin Resource Sharing (whitelisted strictly to frontend CLIENT_URL)
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origin === allowedOrigin) {
      return callback(null, true);
    }
    return callback(null, false);
  },
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

// 5. Query Parameter Sanitization (NoSQL injection guard)
app.use(querySanitizer);

// 6. Mount API Routes
app.use('/api/v1', apiRouter);

// 6. 404 Route Catch-All
app.use(notFoundHandler);

// 7. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
