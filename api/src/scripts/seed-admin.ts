import { connectDB, mongoose } from '../config/db';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';
import { UserService } from '../services/user.service';
import { normalizeEmail } from '../utils/normalize';

async function main() {
  if (!env.adminEmail || !env.adminPassword) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios en el .env');
  }
  await connectDB();
  const existing = await UserModel.findOne({ emailNormalized: normalizeEmail(env.adminEmail) });
  if (existing) {
    console.log(`El admin ${existing.email} ya existe, sin cambios`);
  } else {
    const created = await new UserService().createUser(
      { email: env.adminEmail, password: env.adminPassword, role: 'admin', quotaBytes: null },
      null
    );
    console.log(`Admin creado: ${created.email}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
