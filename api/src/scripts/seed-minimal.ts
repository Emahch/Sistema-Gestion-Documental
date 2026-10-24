import 'dotenv/config';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { FolderModel } from '../models/folder.model';
import { UserModel } from '../models/user.model';
import { UserService } from '../services/user.service';
import { FolderService } from '../services/folder.service';
import { FileService } from '../services/file.service';
import { ShareService } from '../services/share.service';
import { normalizeEmail } from '../utils/normalize';
import bcrypt from 'bcryptjs';

const USER_PASS = 'User123*';

function buildMultipart(filename: string, content: string, folderId: string) {
  const boundary = '----SeedBoundary';
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: text/plain',
    '',
    content,
    `--${boundary}`,
    `Content-Disposition: form-data; name="folderId"`,
    '',
    folderId,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  const buf = Buffer.from(body, 'utf-8');
  const stream = Readable.from(buf) as any;
  stream.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(buf.length),
  };
  return stream;
}

async function ensureUserDoc(email: string) {
  return UserModel.findOne({ emailNormalized: normalizeEmail(email) });
}

async function main() {
  await connectDB();

  const userService = new UserService();
  const folderService = new FolderService();
  const fileService = new FileService();
  const shareService = new ShareService();

  await userService.createUser({ email: 'admin@docsdrive.local', password: 'Admin123*', role: 'admin', quotaBytes: null }, null).catch(async () => {
    const u = await ensureUserDoc('admin@docsdrive.local');
    if (u) {
      u.role = 'admin';
      u.storage.quotaBytes = null;
      u.isActive = true;
      await u.save();
    }
  });

  const admin = await ensureUserDoc('admin@docsdrive.local');
  if (!admin) throw new Error('admin missing');
  const adminId = admin._id.toString();

  const juan = (await ensureUserDoc('juan@docsdrive.local')) || (await userService.createUser({ email: 'juan@docsdrive.local', password: USER_PASS, role: 'user', quotaBytes: 100 * 1024 * 1024 }, adminId) as any);
  const maria = (await ensureUserDoc('maria@docsdrive.local')) || (await userService.createUser({ email: 'maria@docsdrive.local', password: USER_PASS, role: 'user', quotaBytes: null }, adminId) as any);
  const carlos = (await ensureUserDoc('carlos@docsdrive.local')) || (await userService.createUser({ email: 'carlos@docsdrive.local', password: USER_PASS, role: 'user', quotaBytes: 50 * 1024 }, adminId) as any);

  for (const email of ['juan@docsdrive.local', 'maria@docsdrive.local', 'carlos@docsdrive.local']) {
    const u = await ensureUserDoc(email);
    if (u && !u.passwordHash) {
      u.passwordHash = await bcrypt.hash(USER_PASS, 10);
      await UserModel.updateOne({ _id: u._id }, { $set: { passwordHash: u.passwordHash } });
    }
  }

  const juanDoc = await ensureUserDoc('juan@docsdrive.local');
  const mariaDoc = await ensureUserDoc('maria@docsdrive.local');
  const rootJuan = await FolderModel.findOne({ ownerId: juanDoc!._id, isRoot: true, isDeleted: false });
  const rootMaria = await FolderModel.findOne({ ownerId: mariaDoc!._id, isRoot: true, isDeleted: false });
  const rootAdmin = await FolderModel.findOne({ ownerId: admin._id, isRoot: true, isDeleted: false });

  const docs = await folderService.createFolder(juanDoc!._id.toString(), rootJuan!._id.toString(), 'Documentos');
  const proyectos = await folderService.createFolder(juanDoc!._id.toString(), docs.id, 'Proyectos');
  const informes = await folderService.createFolder(mariaDoc!._id.toString(), rootMaria!._id.toString(), 'Informes');

  const req1 = buildMultipart('README.md', '# Proyecto\n\nDatos mínimos para pruebas.\n', proyectos.id);
  const file1 = await fileService.uploadFile(juanDoc!._id.toString(), req1);

  const req2 = buildMultipart('notas.txt', 'Notas rápidas\n- Item 1\n- Item 2\n', docs.id);
  await fileService.uploadFile(juanDoc!._id.toString(), req2);

  const req3 = buildMultipart('informe.txt', 'Informe mensual\nDatos de prueba.\n', informes.id);
  await fileService.uploadFile(mariaDoc!._id.toString(), req3);

  const req4 = buildMultipart('bienvenida.txt', 'Bienvenido al sistema\n', rootAdmin!._id.toString());
  await fileService.uploadFile(admin._id.toString(), req4);

  await shareService.shareResource(juanDoc!._id.toString(), { resourceType: 'file', resourceId: file1.id, sharedWithId: mariaDoc!._id.toString(), permission: 'read' });

  const finalAdmin = await ensureUserDoc('admin@docsdrive.local');
  const finalJuan = await ensureUserDoc('juan@docsdrive.local');
  const finalMaria = await ensureUserDoc('maria@docsdrive.local');
  const finalCarlos = await ensureUserDoc('carlos@docsdrive.local');

  console.log(JSON.stringify({
    users: [
      { email: finalAdmin?.email, role: finalAdmin?.role, quota: finalAdmin?.storage?.quotaBytes },
      { email: finalJuan?.email, role: finalJuan?.role, quota: finalJuan?.storage?.quotaBytes },
      { email: finalMaria?.email, role: finalMaria?.role, quota: finalMaria?.storage?.quotaBytes },
      { email: finalCarlos?.email, role: finalCarlos?.role, quota: finalCarlos?.storage?.quotaBytes },
    ],
    files: ['README.md', 'notas.txt', 'informe.txt', 'bienvenida.txt'],
    share: { from: finalJuan?.email, to: finalMaria?.email, file: file1.name, permission: 'read' },
    password: USER_PASS
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
