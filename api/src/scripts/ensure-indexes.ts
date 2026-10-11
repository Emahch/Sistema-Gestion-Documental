import { connectDB, mongoose } from '../config/db';
import { UserModel } from '../models/user.model';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import { ActivityLogModel } from '../models/activity-log.model';

async function main() {
  await connectDB();
  for (const model of [UserModel, FolderModel, FileModel, ShareModel, ActivityLogModel]) {
    await model.createIndexes();
    const indexes = await model.listIndexes();
    console.log(`${model.collection.name}: ${indexes.map((i: { name: string }) => i.name).join(', ')}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
