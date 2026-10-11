import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<typeof mongoose.connection> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  return mongoose.connection;
}

export { mongoose };
