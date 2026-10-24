import type { SearchResultItem } from '../../core/search.service';
import type { DriveFile, DriveFolder } from '../../models/folder.model';
import type { DriveViewItem } from '../../shared/components/drive-view/drive-view';
import { formatBytes } from '../../shared/format';

export function toSearchViewItem(item: SearchResultItem, currentUserId?: string | null): DriveViewItem {
    const isOwner = item.ownerId === currentUserId;
    if (item.kind === 'folder') {
        return {
            id: item.id,
            kind: 'folder',
            name: item.name,
            updatedAt: item.updatedAt,
            meta: isOwner ? 'propietario' : undefined,
            data: {
                id: item.id,
                name: item.name,
                ownerId: item.ownerId,
                permission: item.permission,
                parentId: item.parentId,
                isRoot: item.isRoot,
                ancestors: [],
                createdAt: item.updatedAt,
                updatedAt: item.updatedAt,
            } as DriveFolder,
        };
    }

    return {
        id: item.id,
        kind: 'file',
        name: item.name,
        updatedAt: item.updatedAt,
        meta: [isOwner ? 'propietario' : undefined, formatBytes(item.size || 0)].filter(Boolean).join(' · '),
        tag: item.mimeType || item.category || '—',
        data: {
            id: item.id,
            name: item.name,
            mimeType: item.mimeType,
            category: item.category,
            size: item.size || 0,
            folderId: item.folderId,
            ownerId: item.ownerId,
            permission: item.permission,
            createdAt: item.updatedAt,
            updatedAt: item.updatedAt,
        } as DriveFile,
    };
}

export function startOfDayIso(date: Date): string {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString();
}

export function endOfDayIso(date: Date): string {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy.toISOString();
}
