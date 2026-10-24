import type { MenuItem } from 'primeng/api';
import type { DriveFile, DriveFolder } from '../../models/folder.model';
import type { DriveViewAction, DriveViewItem } from '../../shared/components/drive-view/drive-view';

export interface DriveActionContext {
    canEdit(resource: DriveFile | DriveFolder): boolean;
    isOwner(ownerId: string): boolean;
    openFolder(folderId: string): void;
    openFile(file: DriveFile): void;
    openHistory(item: DriveViewItem): void;
    openRenameFolder(folder: DriveFolder): void;
    openMoveFolder(folder: DriveFolder): void;
    openFolderPermissions(folder: DriveFolder): void;
    openTrashFolder(folder: DriveFolder): void;
    openRenameFile(file: DriveFile): void;
    openMoveFile(file: DriveFile): void;
    openDownloadFile(file: DriveFile): void;
    openFilePermissions(file: DriveFile): void;
    openTrashFile(file: DriveFile): void;
}

export function createDriveRowActions(item: DriveViewItem, context: DriveActionContext): DriveViewAction[] {
    if (item.kind === 'folder') {
        const folder = item.data as DriveFolder;
        const actions: DriveViewAction[] = [
            { id: 'open', icon: 'pi pi-folder-open', label: 'Abrir carpeta', severity: 'secondary' },
            { id: 'history', icon: 'pi pi-history', label: 'Historial', severity: 'secondary' },
        ];
        if (context.canEdit(folder)) {
            actions.push({ id: 'rename', icon: 'pi pi-pencil', label: 'Renombrar carpeta', severity: 'secondary' });
            actions.push({ id: 'move', icon: 'pi pi-send', label: 'Mover carpeta', severity: 'secondary' });
        }
        if (context.isOwner(folder.ownerId) && !folder.isRoot) {
            actions.push({ id: 'permissions', icon: 'pi pi-users', label: 'Administrar permisos', severity: 'secondary' });
            actions.push({ id: 'trash', icon: 'pi pi-trash', label: 'Enviar a la papelera', severity: 'danger' });
        }
        return actions;
    }

    const file = item.data as DriveFile;
    const canEditFile = context.canEdit(file);
    const actions: DriveViewAction[] = [
        { id: 'preview', icon: 'pi pi-eye', label: canEditFile ? 'Abrir / Editar' : 'Vista previa', severity: 'secondary' },
        { id: 'download', icon: 'pi pi-download', label: 'Descargar archivo', severity: 'secondary' },
        { id: 'history', icon: 'pi pi-history', label: 'Historial', severity: 'secondary' },
    ];
    if (canEditFile) {
        actions.push({ id: 'rename', icon: 'pi pi-pencil', label: 'Renombrar archivo', severity: 'secondary' });
        actions.push({ id: 'move', icon: 'pi pi-send', label: 'Mover archivo', severity: 'secondary' });
    }
    if (context.isOwner(file.ownerId)) {
        actions.push({ id: 'permissions', icon: 'pi pi-users', label: 'Administrar permisos', severity: 'secondary' });
        actions.push({ id: 'trash', icon: 'pi pi-trash', label: 'Enviar a la papelera', severity: 'danger' });
    }
    return actions;
}

export function createFolderMenuItems(folder: DriveFolder, context: DriveActionContext): MenuItem[] {
    const items: MenuItem[] = [
        { label: 'Abrir', icon: 'pi pi-folder-open', command: () => context.openFolder(folder.id) },
        {
            label: 'Historial',
            icon: 'pi pi-history',
            command: () =>
                context.openHistory({
                    id: folder.id,
                    kind: 'folder',
                    name: folder.name,
                    data: folder,
                }),
        },
    ];
    if (context.canEdit(folder)) {
        items.push(
            { label: 'Renombrar', icon: 'pi pi-pencil', command: () => context.openRenameFolder(folder) },
            { label: 'Mover', icon: 'pi pi-send', command: () => context.openMoveFolder(folder) },
        );
    }
    if (context.isOwner(folder.ownerId) && !folder.isRoot) {
        items.push({
            label: 'Administrar permisos',
            icon: 'pi pi-users',
            command: () => context.openFolderPermissions(folder),
        });
        items.push({
            label: 'Enviar a la papelera',
            icon: 'pi pi-trash',
            styleClass: 'menu-danger',
            command: () => context.openTrashFolder(folder),
        });
    }
    return items;
}

export function createFileMenuItems(file: DriveFile, context: DriveActionContext): MenuItem[] {
    const canEditFile = context.canEdit(file);
    const items: MenuItem[] = [
        { label: canEditFile ? 'Abrir / Editar' : 'Vista previa', icon: 'pi pi-eye', command: () => context.openFile(file) },
        { label: 'Descargar', icon: 'pi pi-download', command: () => context.openDownloadFile(file) },
        {
            label: 'Historial',
            icon: 'pi pi-history',
            command: () =>
                context.openHistory({
                    id: file.id,
                    kind: 'file',
                    name: file.name,
                    data: file,
                }),
        },
    ];
    if (canEditFile) {
        items.push(
            { label: 'Renombrar', icon: 'pi pi-pencil', command: () => context.openRenameFile(file) },
            { label: 'Mover', icon: 'pi pi-send', command: () => context.openMoveFile(file) },
        );
    }
    if (context.isOwner(file.ownerId)) {
        items.push({
            label: 'Administrar permisos',
            icon: 'pi pi-users',
            command: () => context.openFilePermissions(file),
        });
        items.push({
            label: 'Enviar a la papelera',
            icon: 'pi pi-trash',
            styleClass: 'menu-danger',
            command: () => context.openTrashFile(file),
        });
    }
    return items;
}
