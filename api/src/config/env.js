require('dotenv').config();

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/gestion_documental',
};

module.exports = { env };
