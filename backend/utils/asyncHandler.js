// utils/asyncHandler.js
const logger = require('./logger');

module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logger.error('ROUTE_ERROR', {
      id: req.id,
      path: req.originalUrl || req.url,
      msg: err?.message,
      stack: err?.stack
    });
    next(err);
  });
};
