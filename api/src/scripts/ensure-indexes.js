const { connectDB, mongoose } = require('../config/db');
const { User } = require('../models/user.model');
const { Folder } = require('../models/folder.model');
const { File } = require('../models/file.model');
const { Share } = require('../models/share.model');
const { ActivityLog } = require('../models/activity-log.model');

async function main() {
  await connectDB();
  for (const model of [User, Folder, File, Share, ActivityLog]) {
    await model.createIndexes();
    const indexes = await model.listIndexes();
    console.log(`${model.collection.name}: ${indexes.map((i) => i.name).join(', ')}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
