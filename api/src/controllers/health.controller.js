const { asyncHandler } = require('../utils/asyncHandler');

const health = asyncHandler(async (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

module.exports = { health };
