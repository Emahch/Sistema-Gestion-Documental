import { Component, OnInit, ViewChild, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataViewModule } from 'primeng/dataview';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { MenuItem, ConfirmationService } from 'primeng/api';
import { FolderService } from '../../core/folder.service';
import { ShareService } from '../../core/share.service';
import { UserService } from '../../core/user.service';
import type { DriveFile, DriveFolder } from '../../models/folder.model';
import { formatBytes } from '../../shared/format';
import { isValidEmail } from '../../shared/validators';

type DriveItem =
  | { kind: 'folder'; id: string; name: string; updatedAt: string; folder: DriveFolder }
  | { kind: 'file'; id: string; name: string; updatedAt: string; file: DriveFile };

@Component({
  selector: 'app-drive',
  imports: [
    DatePipe,
    FormsModule,
    BreadcrumbModule,
    ButtonModule,
    ConfirmDialogModule,
    DataViewModule,
    DialogModule,
    InputTextModule,
    MenuModule,
    ProgressBarModule,
    SelectModule,
    TagModule,
  ],
  templateUrl: './drive.html',
  styleUrl: './drive.css',
})
export class Drive implements OnInit {
  protected readonly folders = signal<DriveFolder[]>([]);
  protected readonly files = signal<DriveFile[]>([]);
  protected readonly crumbs = signal<DriveFolder[]>([]);
  protected readonly currentId = signal<string | null>(null);
  protected readonly currentFolder = signal<DriveFolder | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly layout = signal<'list' | 'grid'>('grid');

  protected readonly items = computed<DriveItem[]>(() => [
    ...this.folders().map((folder) => ({
      kind: 'folder' as const,
      id: folder.id,
      name: folder.name,
      updatedAt: folder.updatedAt,
      folder,
    })),
    ...this.files().map((file) => ({
      kind: 'file' as const,
      id: file.id,
      name: file.name,
      updatedAt: file.updatedAt,
      file,
    })),
  ]);

  protected readonly showCreate = signal(false);
  protected readonly newName = signal('');
  protected readonly createError = signal<string | null>(null);
  protected readonly creating = signal(false);

  protected readonly renameTarget = signal<DriveFolder | null>(null);
  protected readonly showRename = signal(false);
  protected readonly renameName = signal('');
  protected readonly renameError = signal<string | null>(null);
  protected readonly renaming = signal(false);

  protected readonly moveTarget = signal<DriveFolder | null>(null);
  protected readonly showMove = signal(false);
  protected readonly destinations = signal<{ label: string; value: string }[]>([]);
  protected readonly destinationId = signal<string>('');
  protected readonly moveError = signal<string | null>(null);
  protected readonly moving = signal(false);

  protected readonly uploading = signal(false);
  protected readonly uploadPercent = signal(0);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly downloadingId = signal<string | null>(null);

  protected readonly renameFileTarget = signal<DriveFile | null>(null);
  protected readonly showRenameFile = signal(false);
  protected readonly renameFileName = signal('');
  protected readonly renameFileError = signal<string | null>(null);
  protected readonly renamingFile = signal(false);

  protected readonly moveFileTarget = signal<DriveFile | null>(null);
  protected readonly showMoveFile = signal(false);

  protected readonly replaceTarget = signal<DriveFile | null>(null);
  protected readonly showReplace = signal(false);
  protected readonly replaceError = signal<string | null>(null);
  protected readonly replacing = signal(false);

  protected readonly shareTarget = signal<DriveItem | null>(null);
  protected readonly showShare = signal(false);
  protected readonly shareEmail = signal('');
  protected readonly sharePermission = signal<'read' | 'edit'>('read');
  protected readonly shareError = signal<string | null>(null);
  protected readonly sharing = signal(false);

  protected readonly permissionOptions = [
    { label: 'Lectura', value: 'read' },
    { label: 'Edición', value: 'edit' },
  ];

  protected readonly breadcrumb = computed<MenuItem[]>(() =>
    this.crumbs().map((folder, index, chain) =>
      index === chain.length - 1
        ? { label: folder.name }
        : { label: folder.name, command: () => this.openFolder(folder.id) }
    )
  );

  constructor(
    private foldersApi: FolderService,
    private shares: ShareService,
    private users: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private confirm: ConfirmationService,
  ) {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.currentId.set(params.get('folderId'));
      this.reload();
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected openFolder(id: string | null): void {
    this.router.navigate(['/drive'], { queryParams: id ? { folderId: id } : {} });
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.foldersApi.children(this.currentId(), 1, 100).subscribe({
      next: (result) => {
        this.folders.set(result.folders);
        this.files.set(result.files);
        this.loading.set(false);
        this.loadCrumbs();
      },
      error: () => {
        this.error.set('No se pudo cargar la carpeta.');
        this.loading.set(false);
      },
    });
  }

  private loadCrumbs(): void {
    const id = this.currentId();
    if (!id) {
      this.foldersApi.root().subscribe({
        next: (root) => {
          this.currentFolder.set(root);
          this.crumbs.set([root]);
        },
      });
      return;
    }
    this.foldersApi.breadcrumb(id).subscribe({
      next: (chain) => {
        this.crumbs.set(chain);
        this.currentFolder.set(chain[chain.length - 1] ?? null);
      },
    });
  }

  protected openCreate(): void {
    this.newName.set('');
    this.createError.set(null);
    this.showCreate.set(true);
  }

  protected create(): void {
    const name = this.newName().trim();
    const parentId = this.currentFolder()?.id;
    if (!name) {
      this.createError.set('Ingresa un nombre.');
      return;
    }
    if (!parentId) {
      this.createError.set('Aún no se conoce la carpeta actual.');
      return;
    }
    this.creating.set(true);
    this.createError.set(null);
    this.foldersApi.create(parentId, name).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreate.set(false);
        this.reload();
      },
      error: (err: { status?: number }) => {
        this.createError.set(err?.status === 409 ? 'Ya existe una carpeta con ese nombre.' : 'No se pudo crear la carpeta.');
        this.creating.set(false);
      },
    });
  }

  protected openRename(folder: DriveFolder): void {
    this.renameTarget.set(folder);
    this.renameName.set(folder.name);
    this.renameError.set(null);
    this.showRename.set(true);
  }

  protected saveRename(): void {
    const target = this.renameTarget();
    const name = this.renameName().trim();
    if (!target || !name) {
      this.renameError.set('Ingresa un nombre.');
      return;
    }
    this.renaming.set(true);
    this.renameError.set(null);
    this.foldersApi.rename(target.id, name).subscribe({
      next: () => {
        this.renaming.set(false);
        this.showRename.set(false);
        this.reload();
      },
      error: (err: { status?: number }) => {
        this.renameError.set(
          err?.status === 409 ? 'Ya existe una carpeta con ese nombre.' : 'No se pudo renombrar.'
        );
        this.renaming.set(false);
      },
    });
  }

  protected async openMove(folder: DriveFolder): Promise<void> {
    this.moveTarget.set(folder);
    this.destinationId.set('');
    this.moveError.set(null);
    this.showMove.set(true);
    this.destinations.set(await this.flatTree(folder.id, this.currentId()));
  }

  private async flatTree(excludedId: string, parentId: string | null): Promise<{ label: string; value: string }[]> {
    const options: { label: string; value: string }[] = [];
    const walk = async (currentId: string | null, prefix: string): Promise<void> => {
      const page = await firstValueFrom(this.foldersApi.children(currentId));
      for (const folder of page.folders) {
        if (folder.id === excludedId) {
          continue;
        }
        if (folder.id !== parentId) {
          options.push({ label: `${prefix}${folder.name}`, value: folder.id });
        }
        await walk(folder.id, `${prefix}${folder.name} / `);
      }
    };
    await walk(null, '');
    return options;
  }

  protected saveMove(): void {
    const target = this.moveTarget();
    const destinationId = this.destinationId();
    if (!target || !destinationId) {
      this.moveError.set('Elige la carpeta destino.');
      return;
    }
    this.moving.set(true);
    this.moveError.set(null);
    this.foldersApi.move(target.id, destinationId).subscribe({
      next: () => {
        this.moving.set(false);
        this.showMove.set(false);
        this.reload();
      },
      error: (err: { status?: number }) => {
        this.moveError.set(
          err?.status === 400
            ? 'Movimiento inválido (ciclos, raíz o nombre ocupado).'
            : 'No se pudo mover la carpeta.'
        );
        this.moving.set(false);
      },
    });
  }

  protected confirmTrash(folder: DriveFolder): void {
    this.confirm.confirm({
      header: 'Enviar a la papelera',
      message: `¿Enviar "${folder.name}" y su contenido a la papelera?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Enviar',
      rejectLabel: 'Cancelar',
      accept: () => this.trash(folder),
    });
  }

  private trash(folder: DriveFolder): void {
    this.foldersApi.trash(folder.id).subscribe({
      next: () => {
        this.reload();
      },
      error: (err: { status?: number }) => {
        this.error.set(
          err?.status === 400 ? 'No se puede eliminar: revisa el contenido.' : 'No se pudo eliminar la carpeta.'
        );
      },
    });
  }

  @ViewChild('itemMenu') private readonly itemMenu?: Menu;
  protected readonly menuItems = signal<MenuItem[]>([]);

  protected activateItem(item: DriveItem): void {
    if (item.kind === 'folder') {
      this.openFolder(item.id);
    } else {
      this.downloadFile(item);
    }
  }

  protected openItemMenu(event: MouseEvent, item: DriveItem): void {
    event.stopPropagation();
    this.menuItems.set(item.kind === 'folder' ? this.folderMenu(item.folder) : this.fileMenu(item.file));
    this.itemMenu?.toggle(event);
  }

  private folderMenu(folder: DriveFolder): MenuItem[] {
    const items: MenuItem[] = [
      { label: 'Abrir', icon: 'pi pi-folder-open', command: () => this.openFolder(folder.id) },
      { label: 'Renombrar', icon: 'pi pi-pencil', command: () => this.openRename(folder) },
      { label: 'Mover', icon: 'pi pi-send', command: () => this.openMove(folder) },
    ];
    if (!folder.isRoot) {
      items.push({ label: 'Compartir', icon: 'pi pi-share-alt', command: () => this.openShare({ kind: 'folder', id: folder.id, name: folder.name, updatedAt: folder.updatedAt, folder }) });
      items.push({
        label: 'Enviar a la papelera',
        icon: 'pi pi-trash',
        styleClass: 'menu-danger',
        command: () => this.confirmTrash(folder),
      });
    }
    return items;
  }

  private fileMenu(file: DriveFile): MenuItem[] {
    return [
      { label: 'Descargar', icon: 'pi pi-download', command: () => this.downloadById(file) },
      { label: 'Renombrar', icon: 'pi pi-pencil', command: () => this.openRenameFile(file) },
      { label: 'Mover', icon: 'pi pi-send', command: () => this.openMoveFile(file) },
      { label: 'Reemplazar contenido', icon: 'pi pi-file-edit', command: () => this.openReplace(file) },
      { label: 'Compartir', icon: 'pi pi-share-alt', command: () => this.openShare({ kind: 'file', id: file.id, name: file.name, updatedAt: file.updatedAt, file }) },
    ];
  }

  private downloadById(file: DriveFile): void {
    this.downloadFile({ kind: 'file', id: file.id, name: file.name, updatedAt: file.updatedAt, file });
  }

  protected formatBytes = formatBytes;

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const parentId = this.currentFolder()?.id;
    if (!parentId) {
      this.uploadError.set('Aún no se conoce la carpeta actual.');
      return;
    }
    this.uploading.set(true);
    this.uploadPercent.set(0);
    this.uploadError.set(null);
    this.foldersApi.uploadFile(parentId, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? file.size;
          this.uploadPercent.set(total ? Math.round((event.loaded / total) * 100) : 0);
        } else if (event.type === HttpEventType.Response) {
          this.uploading.set(false);
          this.uploadPercent.set(0);
          this.reload();
        }
      },
      error: (err: { status?: number }) => {
        this.uploadError.set(
          err?.status === 409
            ? 'Ya existe un archivo con ese nombre.'
            : err?.status === 413
              ? 'El archivo excede tu cuota disponible.'
              : err?.status === 400
                ? 'Archivo inválido (solo .txt y .md en UTF-8).'
                : 'No se pudo subir el archivo.'
        );
        this.uploading.set(false);
        this.uploadPercent.set(0);
      },
    });
  }

  protected downloadFile(item: DriveItem): void {
    if (item.kind !== 'file') {
      return;
    }
    const file = item.file;
    this.downloadingId.set(file.id);
    this.foldersApi.downloadFile(file.id).subscribe({
      next: (blob) => {
        this.downloadingId.set(null);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingId.set(null);
        this.error.set('No se pudo descargar el archivo.');
      },
    });
  }

  protected openRenameFile(file: DriveFile): void {
    this.renameFileTarget.set(file);
    this.renameFileName.set(file.name);
    this.renameFileError.set(null);
    this.showRenameFile.set(true);
  }

  protected saveRenameFile(): void {
    const target = this.renameFileTarget();
    const name = this.renameFileName().trim();
    if (!target || !name) {
      this.renameFileError.set('Ingresa un nombre.');
      return;
    }
    this.renamingFile.set(true);
    this.renameFileError.set(null);
    this.foldersApi.renameFile(target.id, name).subscribe({
      next: () => {
        this.renamingFile.set(false);
        this.showRenameFile.set(false);
        this.reload();
      },
      error: (err: { status?: number }) => {
        this.renameFileError.set(
          err?.status === 409
            ? 'Ya existe un archivo con ese nombre.'
            : err?.status === 400
              ? 'El nombre debe conservar la extensión.'
              : 'No se pudo renombrar.'
        );
        this.renamingFile.set(false);
      },
    });
  }

  protected async openMoveFile(file: DriveFile): Promise<void> {
    this.moveFileTarget.set(file);
    this.destinationId.set('');
    this.moveError.set(null);
    this.showMoveFile.set(true);
    this.destinations.set(await this.flatTree('', null));
  }

  protected saveMoveFile(): void {
    const target = this.moveFileTarget();
    const destinationId = this.destinationId();
    if (!target || !destinationId) {
      this.moveError.set('Elige la carpeta destino.');
      return;
    }
    this.moving.set(true);
    this.moveError.set(null);
    this.foldersApi.moveFile(target.id, destinationId).subscribe({
      next: () => {
        this.moving.set(false);
        this.showMoveFile.set(false);
        this.reload();
      },
      error: () => {
        this.moveError.set('No se pudo mover el archivo.');
        this.moving.set(false);
      },
    });
  }

  protected openShare(item: DriveItem): void {
    this.shareTarget.set(item);
    this.shareEmail.set('');
    this.sharePermission.set('read');
    this.shareError.set(null);
    this.showShare.set(true);
  }

  protected saveShare(): void {
    const target = this.shareTarget();
    const email = this.shareEmail().trim();
    if (!target) {
      return;
    }
    if (!isValidEmail(email)) {
      this.shareError.set('Ingresa un email válido.');
      return;
    }
    this.sharing.set(true);
    this.shareError.set(null);
    this.users.resolveByEmail(email).subscribe({
      next: (resolved) => {
        this.shares
          .share({
            resourceType: target.kind,
            resourceId: target.id,
            sharedWithId: resolved.id,
            permission: this.sharePermission(),
          })
          .subscribe({
            next: () => {
              this.sharing.set(false);
              this.showShare.set(false);
            },
            error: (err: { status?: number }) => {
              this.shareError.set(
                err?.status === 403
                  ? 'Solo el propietario puede compartir.'
                  : err?.status === 409
                    ? 'Ya compartido con ese usuario.'
                    : err?.status === 404
                      ? 'Recurso no encontrado.'
                      : 'No se pudo compartir.'
              );
              this.sharing.set(false);
            },
          });
      },
      error: (err: { status?: number }) => {
        this.shareError.set(err?.status === 404 ? 'Ese email no está registrado.' : 'No se pudo resolver el usuario.');
        this.sharing.set(false);
      },
    });
  }

  protected openReplace(file: DriveFile): void {
    this.replaceTarget.set(file);
    this.replaceError.set(null);
    this.showReplace.set(true);
  }

  protected onReplaceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const target = this.replaceTarget();
    if (!file || !target) {
      return;
    }
    this.replacing.set(true);
    this.uploadPercent.set(0);
    this.replaceError.set(null);
    this.foldersApi.editContent(target.id, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? file.size;
          this.uploadPercent.set(total ? Math.round((event.loaded / total) * 100) : 0);
        } else if (event.type === HttpEventType.Response) {
          this.replacing.set(false);
          this.uploadPercent.set(0);
          this.showReplace.set(false);
          this.reload();
        }
      },
      error: (err: { status?: number }) => {
        this.replaceError.set(
          err?.status === 413
            ? 'El archivo excede tu cuota disponible.'
            : err?.status === 400
              ? 'Archivo inválido (solo .txt y .md en UTF-8).'
              : 'No se pudo reemplazar el contenido.'
        );
        this.replacing.set(false);
        this.uploadPercent.set(0);
      },
    });
  }
}
