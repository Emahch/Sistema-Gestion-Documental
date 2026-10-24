import 'dotenv/config';
import { connectDB, mongoose } from '../config/db';
import { ActivityLogModel } from '../models/activity-log.model';
import { FileModel } from '../models/file.model';
import { deleteGridFsObject } from '../utils/upload';

function bucket() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Sin conexión a MongoDB');
  }
  return new mongoose.mongo.GridFSBucket(db);
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Sin conexión a MongoDB');
  }

  const [referenced, failedLogs] = await Promise.all([
    FileModel.distinct('gridFsId'),
    ActivityLogModel.find({ status: 'error', 'details.errorCode': 'GRIDFS_DELETE_FAILED' }, { 'details.gridFsId': 1 }).lean(),
  ]);

  const referencedSet = new Set(
    referenced
      .map((id) => (id ? id.toString() : null))
      .filter((id): id is string => Boolean(id))
  );
  const failedSet = new Set(
    failedLogs
      .map((log) => {
        const id = (log.details as Record<string, unknown> | undefined)?.gridFsId;
        if (!id) return null;
        return id.toString();
      })
      .filter((id): id is string => Boolean(id))
  );

  const filesCollection = db.collection('fs.files');
  const allGridFs = await filesCollection.find({}, { projection: { _id: 1 } }).toArray();

  let checked = 0;
  let deleted = 0;
  let skippedReferenced = 0;
  let errors = 0;

  for (const doc of allGridFs) {
    checked += 1;
    const id = doc._id as mongoose.Types.ObjectId;
    const key = id.toString();
    if (referencedSet.has(key)) {
      skippedReferenced += 1;
      continue;
    }

    try {
      await deleteGridFsObject(id);
      deleted += 1;
    } catch (err) {
      errors += 1;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`Error al eliminar GridFS ${key}: ${message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        checked,
        referenced: referencedSet.size,
        failedLogRefs: failedSet.size,
        deleted,
        skippedReferenced,
        errors,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
