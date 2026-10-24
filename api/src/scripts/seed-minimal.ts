import 'dotenv/config';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import { UserModel } from '../models/user.model';
import { UserService } from '../services/user.service';
import { FolderService } from '../services/folder.service';
import { FileService } from '../services/file.service';
import { ShareService } from '../services/share.service';
import { normalizeEmail, normalizeName } from '../utils/normalize';
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

async function ensureFolder(ownerId: string, parentId: string, name: string, folderService: FolderService): Promise<string> {
  const existing = await FolderModel.findOne({ ownerId, parentId, nameNormalized: normalizeName(name), isDeleted: false });
  if (existing) {
    return existing._id.toString();
  }
  const created = await folderService.createFolder(ownerId, parentId, name);
  return created.id;
}

async function ensureFile(
  ownerId: string,
  folderId: string,
  name: string,
  content: string,
  fileService: FileService
): Promise<string> {
  const existing = await FileModel.findOne({ ownerId, folderId, nameNormalized: normalizeName(name), isDeleted: false });
  if (existing) {
    return existing._id.toString();
  }
  const created = await fileService.uploadFile(ownerId, buildMultipart(name, content, folderId));
  return created.id;
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

  const juanId = juanDoc!._id.toString();
  const mariaId = mariaDoc!._id.toString();
  const adminUserId = admin._id.toString();
  const docsId = await ensureFolder(juanId, rootJuan!._id.toString(), 'Documentos', folderService);
  const proyectosId = await ensureFolder(juanId, docsId, 'Proyectos', folderService);
  const informesId = await ensureFolder(mariaId, rootMaria!._id.toString(), 'Informes', folderService);

  const seedLocations = [
    { ownerId: juanId, folderId: docsId },
    { ownerId: juanId, folderId: proyectosId },
    { ownerId: mariaId, folderId: informesId },
    { ownerId: adminUserId, folderId: rootAdmin!._id.toString() },
  ];
  const existingFiles = await FileModel.countDocuments({});
  for (let index = existingFiles; index < 50; index += 1) {
    const location = seedLocations[index % seedLocations.length];
    const extension = index % 2 === 0 ? 'txt' : 'md';
    await ensureFile(
      location.ownerId,
      location.folderId,
      `documento-${String(index + 1).padStart(2, '0')}.${extension}`,
      `Documento de demostración ${index + 1}\nContenido inicial del sistema.\n`,
      fileService
    );
  }

  const activeFiles = await FileModel.find({ isDeleted: false }).sort({ createdAt: 1 });
  const users = [juanId, mariaId, adminUserId];
  const existingShares = await ShareModel.countDocuments({});
  let sharesCreated = existingShares;
  for (const file of activeFiles) {
    if (sharesCreated >= 20) break;
    const recipients = users.filter((id) => id !== file.ownerId.toString());
    for (const recipientId of recipients) {
      if (sharesCreated >= 20) break;
      const shareExists = await ShareModel.exists({ resourceId: file._id, sharedWithId: recipientId });
      if (shareExists) continue;
      await shareService.shareResource(file.ownerId.toString(), {
        resourceType: 'file',
        resourceId: file._id.toString(),
        sharedWithId: recipientId,
        permission: sharesCreated % 2 === 0 ? 'read' : 'edit',
      });
      sharesCreated += 1;
    }
  }

  const existingTrash = await FileModel.countDocuments({ isDeleted: true });
  const trashNeeded = Math.max(0, 2 - existingTrash);
  if (trashNeeded > 0) {
    const trashCandidates = await FileModel.find({ isDeleted: false }).sort({ createdAt: 1 }).limit(trashNeeded);
    for (const file of trashCandidates) {
      await fileService.trashFile(file.ownerId.toString(), file._id.toString());
    }
  }

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
    files: await FileModel.countDocuments({}),
    shares: await ShareModel.countDocuments({}),
    trash: await FileModel.countDocuments({ isDeleted: true }),
    password: USER_PASS
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
