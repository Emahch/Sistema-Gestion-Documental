import { mongoose } from '../config/db';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import type {
  GroupRow,
  GroupTotals,
  TrashContentItem,
  TrashContents,
  TrashEntry,
} from '../types/trash';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/http-error';

function keyOf(value: unknown): string {
  return value ? String(value) : '';
}

function emptyTotals(): GroupTotals {
  return { folders: 0, files: 0, sizeBytes: 0 };
}

export class TrashQueryService {
  async list(userId: string): Promise<TrashEntry[]> {
    const ownerId = new mongoose.Types.ObjectId(userId);
    const [folders, files, folderGroups, fileGroups] = await Promise.all([
      FolderModel.find({ ownerId, isDeleted: true, isDeletionRoot: true }).sort({ deletedAt: -1 }).lean(),
      FileModel.find({ ownerId, isDeleted: true, isDeletionRoot: true }).sort({ deletedAt: -1 }).lean(),
      FolderModel.aggregate([
        { $match: { ownerId, isDeleted: true } },
        { $group: { _id: '$deletionId', folders: { $sum: 1 } } },
      ]),
      FileModel.aggregate([
        { $match: { ownerId, isDeleted: true } },
        { $group: { _id: '$deletionId', files: { $sum: 1 }, sizeBytes: { $sum: '$size' } } },
      ]),
    ]);

    const totals = new Map<string, GroupTotals>();
    for (const group of folderGroups as GroupRow[]) {
      totals.set(keyOf(group._id), { ...emptyTotals(), folders: group.folders ?? 0 });
    }
    for (const group of fileGroups as GroupRow[]) {
      const current = totals.get(keyOf(group._id)) ?? emptyTotals();
      current.files = group.files ?? 0;
      current.sizeBytes = group.sizeBytes ?? 0;
      totals.set(keyOf(group._id), current);
    }

    const parentIds = [...folders.map((folder) => folder.parentId), ...files.map((file) => file.folderId)]
      .filter((id): id is mongoose.Types.ObjectId => id !== null && id !== undefined);
    const parents = await FolderModel.find({ _id: { $in: parentIds }, isDeleted: false }, { name: 1 }).lean();
    const locationNames = new Map(parents.map((parent) => [keyOf(parent._id), parent.name]));

    const entries: TrashEntry[] = [];
    for (const folder of folders) {
      const group = totals.get(keyOf(folder.deletionId)) ?? emptyTotals();
      entries.push({
        id: folder._id.toString(), resourceType: 'folder', name: folder.name,
        deletedAt: folder.deletedAt ? new Date(folder.deletedAt).toISOString() : '',
        itemCount: group.folders + group.files, sizeBytes: group.sizeBytes,
        locationName: locationNames.get(keyOf(folder.parentId)) ?? null,
      });
    }
    for (const file of files) {
      const group = totals.get(keyOf(file.deletionId)) ?? emptyTotals();
      entries.push({
        id: file._id.toString(), resourceType: 'file', name: file.name,
        deletedAt: file.deletedAt ? new Date(file.deletedAt).toISOString() : '',
        itemCount: group.folders + group.files, sizeBytes: group.sizeBytes,
        locationName: locationNames.get(keyOf(file.folderId)) ?? null,
      });
    }
    return entries.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  }

  async contents(userId: string, id: string): Promise<TrashContents> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestError('id inválido');
    const root = await FolderModel.findOne({ _id: id, isDeleted: true });
    if (!root) throw new NotFoundError('La carpeta eliminada no existe');
    if (root.ownerId.toString() !== userId) throw new ForbiddenError('Solo el propietario puede ver la papelera');
    const deletionId = root.deletionId;
    if (!deletionId) throw new BadRequestError('El elemento no pertenece a una eliminación');

    const [groupFolders, groupFiles] = await Promise.all([
      FolderModel.find({ deletionId, ownerId: root.ownerId, isDeleted: true }).lean(),
      FileModel.find({ deletionId, ownerId: root.ownerId, isDeleted: true }).lean(),
    ]);
    const subtreeFolders = groupFolders.filter((folder) => !folder._id.equals(root._id));
    const subtreeFiles = groupFiles.filter((file) => !file._id.equals(root._id));
    const folders: TrashContentItem[] = [];
    for (const folder of subtreeFolders) {
      if (keyOf(folder.parentId) !== keyOf(root._id)) continue;
      const descendants = subtreeFolders.filter((child) => child.ancestors.some((ancestor) => ancestor.equals(folder._id)));
      const descFiles = subtreeFiles.filter(
        (file) => file.folderId.equals(folder._id) || descendants.some((descendant) => file.folderId.equals(descendant._id))
      );
      folders.push({
        id: folder._id.toString(), resourceType: 'folder', name: folder.name,
        deletedAt: folder.deletedAt ? new Date(folder.deletedAt).toISOString() : '',
        sizeBytes: descFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        itemCount: descendants.length + 1 + descFiles.length,
      });
    }
    const files: TrashContentItem[] = [];
    for (const file of subtreeFiles) {
      if (keyOf(file.folderId) !== keyOf(root._id)) continue;
      files.push({
        id: file._id.toString(), resourceType: 'file', name: file.name,
        deletedAt: file.deletedAt ? new Date(file.deletedAt).toISOString() : '',
        sizeBytes: file.size || 0, itemCount: 1,
      });
    }
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return { folderId: root._id.toString(), name: root.name, folders, files };
  }
}
