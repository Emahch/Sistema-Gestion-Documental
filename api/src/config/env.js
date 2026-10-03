require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://mongo:27017/gestion_documental',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
};

module.exports = { env };
