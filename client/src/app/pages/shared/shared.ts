import { Component, OnInit, ViewChild, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpEventType } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { ProgressBarModule } from 'primeng/progressbar';
import { MenuItem, ConfirmationService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { ShareService } from '../../core/share.service';
import { FolderService } from '../../core/folder.service';
import { DriveView, DriveViewItem } from '../../shared/components/drive-view/drive-view';
import { PermissionsDialog } from '../../shared/components/permissions-dialog/permissions-dialog';
import { FileEditorDialog } from '../../shared/components/file-editor-dialog/file-editor-dialog';
import type { ShareItem } from '../../models/share.model';

interface SharedGroup {
  id: string;
  kind: 'folder' | 'file';
  name: string;
  ownerEmail?: string;
  people: { email: string; permission: string }[];
}

interface ActionTarget {
  kind: 'folder' | 'file';
  id: string;
  name: string;
  canEdit: boolean;
  isOwner: boolean;
}

@Component({
  selector: 'app-shared',
  imports: [
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    DriveView,
    FileEditorDialog,
    InputTextModule,
    MenuModule,
    PermissionsDialog,
    FileEditorDialog,
    ProgressBarModule,
    SelectModule,
  ],
  templateUrl: './shared.html',
  styleUrl: './shared.css',
})
export class Shared implements OnInit {
  protected readonly mode = signal<'with-me' | 'by-me'>('with-me');
  protected readonly shares = signal<ShareItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly layout = signal<'list' | 'grid'>('grid');
  protected readonly downloadingId = signal<string | null>(null);

  protected readonly permTarget = signal<{ kind: 'file' | 'folder'; id: string; name: string } | null>(null);
  protected readonly showPermissions = signal(false);

  protected readonly title = computed(() =>
    this.mode() === 'with-me' ? 'Compartidos conmigo' : 'Compartidos por mí'
  );
  protected readonly subtitle = computed(() =>
    this.mode() === 'with-me'
      ? 'Archivos y carpetas que otros te compartieron'
      : 'Lo que compartiste con otros usuarios'
  );

  protected readonly groups = computed<SharedGroup[]>(() => {
    const groups = new Map<string, SharedGroup>();
    for (const share of this.shares()) {
      const key = `${share.resourceType}:${share.resourceId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.people.push({ email: share.sharedWithEmail, permission: share.permission });
        continue;
      }
      groups.set(key, {
        id: share.resourceId,
        kind: share.resourceType === 'folder' ? 'folder' : 'file',
        name: share.resourceName,
        ownerEmail: share.ownerEmail,
        people: [{ email: share.sharedWithEmail, permission: share.permission }],
      });
    }
    return [...groups.values()];
  });

  protected readonly sharedItems = computed<DriveViewItem[]>(() =>
    this.groups().map((group) => ({
      id: group.id,
      kind: group.kind,
      name: group.name,
      tag: group.kind === 'folder' ? 'Carpeta' : 'Archivo',
      meta: [
        group.ownerEmail ? `Propietario: ${group.ownerEmail}` : '',
        `${group.people.length} ${group.people.length === 1 ? 'persona' : 'personas'}`,
      ]
        .filter(Boolean)
        .join(' · '),
      data: group,
    }))
  );

  protected readonly withMeItems = computed<DriveViewItem[]>(() =>
    this.shares().map((share) => ({
      id: share.id,
      kind: share.resourceType === 'folder' ? 'folder' : 'file',
      name: share.resourceName,
      tag: share.resourceType === 'folder' ? 'Carpeta' : 'Archivo',
      meta: `Propietario: ${share.ownerEmail} · ${share.permission === 'edit' ? 'Edición' : 'Lectura'}`,
      updatedAt: share.createdAt,
      data: share,
    }))
  );

  protected readonly viewItems = computed<DriveViewItem[]>(() =>
    this.mode() === 'by-me' ? this.sharedItems() : this.withMeItems()
  );

  @ViewChild('itemMenu') private readonly itemMenu?: Menu;
  protected readonly menuItems = signal<MenuItem[]>([]);

  protected readonly renameTarget = signal<ActionTarget | null>(null);
  protected readonly showRename = signal(false);
  protected readonly renameName = signal('');
  protected readonly renameError = signal<string | null>(null);
  protected readonly renaming = signal(false);

  protected readonly moveTarget = signal<ActionTarget | null>(null);
  protected readonly showMove = signal(false);
  protected readonly destinations = signal<{ label: string; value: string }[]>([]);
  protected readonly destinationId = signal<string>('');
  protected readonly moveError = signal<string | null>(null);
  protected readonly moving = signal(false);

  protected readonly showReplace = signal(false);
  protected readonly uploadPercent = signal(0);

  protected readonly trashTarget = signal<ActionTarget | null>(null);

  @ViewChild(FileEditorDialog) protected editor!: FileEditorDialog;

  constructor(
    private sharesApi: ShareService,
    private foldersApi: FolderService,
    private route: ActivatedRoute,
    private router: Router,
    private confirm: ConfirmationService,
  ) {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.mode.set(data['mode'] === 'by-me' ? 'by-me' : 'with-me');
      this.reload();
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    const request =
      this.mode() === 'with-me' ? this.sharesApi.withMe(1, 50) : this.sharesApi.byMe(1, 50);
    request.subscribe({
      next: (result) => {
        this.shares.set(result.data);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los compartidos.');
        this.loading.set(false);
      },
    });
  }

  protected activateItem(item: DriveViewItem): void {
    const target = this.resolveTarget(item);
    if (target.kind === 'folder') {
      if (this.mode() === 'by-me') {
        this.openSharedItem(item);
        return;
      }
      this.openWithMeItem(item);
      return;
    }
    this.openEditorShared(item);
  }

  private resolveTarget(item: DriveViewItem): ActionTarget {
    if (this.mode() === 'by-me') {
      const group = item.data as SharedGroup;
      return { kind: group.kind, id: group.id, name: group.name, canEdit: true, isOwner: true };
    }
    const share = item.data as ShareItem;
    const kind = share.resourceType === 'folder' ? 'folder' : 'file';
    return {
      kind,
      id: share.resourceId,
      name: share.resourceName,
      canEdit: share.permission === 'edit',
      isOwner: false,
    };
  }

  protected openRenameShared(item: DriveViewItem): void {
    const target = this.resolveTarget(item);
    if (!target.canEdit) return;
    this.renameTarget.set(target);
    this.renameName.set(target.name);
    this.renameError.set(null);
    this.showRename.set(true);
  }

  protected saveRenameShared(): void {
    const target = this.renameTarget();
    const name = this.renameName().trim();
    if (!target || !name) {
      this.renameError.set('Ingresa un nombre.');
      return;
    }
    this.renaming.set(true);
    this.renameError.set(null);
    if (target.kind === 'folder') {
      this.foldersApi.rename(target.id, name).subscribe({
        next: () => {
          this.renaming.set(false);
          this.showRename.set(false);
          this.reload();
        },
        error: (err: { status?: number }) => {
          this.renameError.set(err?.status === 409 ? 'Ya existe una carpeta con ese nombre.' : 'No se pudo renombrar.');
          this.renaming.set(false);
        },
      });
      return;
    }
    this.foldersApi.renameFile(target.id, name).subscribe({
      next: () => {
        this.renaming.set(false);
        this.showRename.set(false);
        this.reload();
      },
      error: (err: { status?: number }) => {
        this.renameError.set(err?.status === 409 ? 'Ya existe un archivo con ese nombre.' : err?.status === 400 ? 'El nombre debe conservar la extensión.' : 'No se pudo renombrar.');
        this.renaming.set(false);
      },
    });
  }

  protected openMoveShared(item: DriveViewItem): void {
    const target = this.resolveTarget(item);
    if (!target.canEdit) return;
    this.moveTarget.set(target);
    this.destinationId.set('');
    this.moveError.set(null);
    this.showMove.set(true);
    this.foldersApi.moveDestinations(target.kind, target.id).subscribe({
      next: (destinations) =>
        this.destinations.set(destinations.map((destination) => ({ label: destination.label, value: destination.id }))),
      error: () => this.moveError.set('No se pudieron cargar las carpetas destino.'),
    });
  }

  protected saveMoveShared(): void {
    const target = this.moveTarget();
    const destinationId = this.destinationId();
    if (!target || !destinationId) {
      this.moveError.set('Elige la carpeta destino.');
      return;
    }
    this.moving.set(true);
    this.moveError.set(null);
    if (target.kind === 'folder') {
      this.foldersApi.move(target.id, destinationId).subscribe({
        next: () => {
          this.moving.set(false);
          this.showMove.set(false);
          this.reload();
        },
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.moveError.set(err?.error?.message || 'No se pudo mover la carpeta.');
          this.moving.set(false);
        },
      });
      return;
    }
    this.foldersApi.moveFile(target.id, destinationId).subscribe({
      next: () => {
        this.moving.set(false);
        this.showMove.set(false);
        this.reload();
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.moveError.set(err?.error?.message || 'No se pudo mover el archivo.');
        this.moving.set(false);
      },
    });
  }

  protected openEditorShared(item: DriveViewItem): void {
    const target = this.resolveTarget(item);
    if (target.kind !== 'file') return;
    const ext = target.name.toLowerCase();
    if (!ext.endsWith('.txt') && !ext.endsWith('.md')) {
      this.error.set('Solo se pueden editar archivos .txt o .md.');
      return;
    }
    this.foldersApi.previewFile(target.id).subscribe({
      next: (text) => {
        if (target.canEdit) {
          this.editor.openEdit(target.id, target.name, text);
        } else {
          this.editor.openEdit(target.id, target.name, text);
        }
      },
      error: (err: { status?: number }) => {
        this.error.set(
          err?.status === 403
            ? 'No tienes permiso para editar este archivo.'
            : 'No se pudo cargar el contenido para editar.'
        );
      },
    });
  }

  protected confirmTrashShared(item: DriveViewItem): void {
    const target = this.resolveTarget(item);
    if (!target.isOwner) return;
    this.trashTarget.set(target);
    this.confirm.confirm({
      header: 'Enviar a la papelera',
      message: `¿Enviar "${target.name}" a la papelera?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Enviar',
      rejectLabel: 'Cancelar',
      accept: () => this.trashShared(),
    });
  }

  private trashShared(): void {
    const target = this.trashTarget();
    if (!target) return;
    if (target.kind === 'folder') {
      this.foldersApi.trash(target.id).subscribe({
        next: () => this.reload(),
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.error.set(err?.error?.message || 'No se pudo enviar la carpeta a la papelera.');
        },
      });
      return;
    }
    this.foldersApi.trashFile(target.id).subscribe({
      next: () => this.reload(),
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.error.set(err?.error?.message || 'No se pudo enviar el archivo a la papelera.');
      },
    });
  }

  protected openSharedItem(item: DriveViewItem): void {
    const group = item.data as SharedGroup;
    if (group.kind === 'folder') {
      this.router.navigate(['/drive'], { queryParams: { folderId: group.id } });
      return;
    }
    this.downloadFile(group.id, group.name);
  }

  protected openWithMeItem(item: DriveViewItem): void {
    const share = item.data as ShareItem;
    if (share.resourceType !== 'folder') {
      this.downloadFile(share.resourceId, share.resourceName);
      return;
    }
    this.router.navigate(['/drive'], { queryParams: { folderId: share.resourceId } });
  }

  private downloadFile(id: string, name: string): void {
    this.downloadingId.set(id);
    this.foldersApi.downloadFile(id).subscribe({
      next: (blob) => {
        this.downloadingId.set(null);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingId.set(null);
        this.error.set('No se pudo descargar el archivo.');
      },
    });
  }

 

  protected openItemMenu(event: MouseEvent, item: DriveViewItem): void {
    event.stopPropagation();
    const target = this.resolveTarget(item);
    const isFolder = target.kind === 'folder';
    const items: MenuItem[] = [
      {
        label: isFolder ? 'Abrir' : 'Descargar',
        icon: isFolder ? 'pi pi-folder-open' : 'pi pi-download',
        command: () =>
          this.mode() === 'by-me' ? this.openSharedItem(item) : this.openWithMeItem(item),
      },
    ];
    if (!isFolder) {
      items.push({ label: 'Abrir / Editar', icon: 'pi pi-file-edit', command: () => this.openEditorShared(item) });
    } else {
      items.push({
        label: 'Abrir',
        icon: 'pi pi-folder-open',
        command: () => (this.mode() === 'by-me' ? this.openSharedItem(item) : this.openWithMeItem(item)),
      });
    }
    if (target.canEdit) {
      items.push(
        { label: 'Renombrar', icon: 'pi pi-pencil', command: () => this.openRenameShared(item) },
        { label: 'Mover', icon: 'pi pi-send', command: () => this.openMoveShared(item) },
      );
    }
    if (target.isOwner) {
      items.push({
        label: 'Administrar permisos',
        icon: 'pi pi-users',
        command: () => this.openPermissions(item.data as SharedGroup),
      });
      items.push({
        label: 'Enviar a la papelera',
        icon: 'pi pi-trash',
        styleClass: 'menu-danger',
        command: () => this.confirmTrashShared(item),
      });
    }
    this.menuItems.set(items);
    this.itemMenu?.toggle(event);
  }

  protected openPermissions(group: SharedGroup): void {
    this.permTarget.set({ kind: group.kind, id: group.id, name: group.name });
    this.showPermissions.set(true);
  }
}
