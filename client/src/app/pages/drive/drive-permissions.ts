import type { DriveFile, DriveFolder } from '../../models/folder.model';

export function isOwner(ownerId: string, currentUserId?: string | null): boolean {
    return Boolean(currentUserId && ownerId === currentUserId);
}

export function canEditResource(
    resource: DriveFile | DriveFolder,
    currentUserId?: string | null,
): boolean {
    return (
        resource.permission === 'owner' ||
        resource.permission === 'edit' ||
        isOwner(resource.ownerId, currentUserId)
    );
}

export function canWriteInFolder(folder: DriveFolder | null, currentUserId?: string | null): boolean {
    if (!folder) {
        return true;
    }
    return folder.permission === 'owner' || folder.permission === 'edit' || isOwner(folder.ownerId, currentUserId);
}
