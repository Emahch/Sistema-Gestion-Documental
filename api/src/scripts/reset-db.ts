import 'dotenv/config';
import { connectDB, mongoose } from '../config/db';

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a MongoDB');

  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const name = c.name;
    if (name.startsWith('system.')) continue;
    if (name === 'fs.files' || name === 'fs.chunks') {
      await db.collection(name).deleteMany({});
      continue;
    }
    await db.collection(name).deleteMany({});
  }

  console.log('Base de datos limpia (excepto collections system)');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
