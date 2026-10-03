const mongoose = require('mongoose');
const { env } = require('./env');

async function connectDB() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI no está definida. Revisa tu archivo .env');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log('MongoDB conectado');
}

module.exports = { connectDB };
