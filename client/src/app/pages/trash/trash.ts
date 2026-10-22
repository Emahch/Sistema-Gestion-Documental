import { Component, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { TrashService } from '../../core/trash.service';
import { FolderTreeService } from '../../core/folder-tree.service';
import {
  DriveView,
  DriveViewAction,
  DriveViewItem,
} from '../../shared/components/drive-view/drive-view';
import type { TrashContentItem, TrashContents, TrashItem } from '../../models/trash.model';
import { formatBytes } from '../../shared/format';

interface TrashCrumb {
  id: string;
  name: string;
}

interface RestoreTarget {
  id: string;
  name: string;
  scope: 'group' | 'item';
}

@Component({
  selector: 'app-trash',
  imports: [
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    DriveView,
    FormsModule,
    MenuModule,
    SelectModule,
  ],
  templateUrl: './trash.html',
  styleUrl: './trash.css',
})
export class Trash implements OnInit {
  protected readonly entries = signal<TrashItem[]>([]);
  protected readonly contents = signal<TrashContents | null>(null);
  protected readonly crumbs = signal<TrashCrumb[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly layout = signal<'list' | 'grid'>('grid');
  protected readonly restoringId = signal<string | null>(null);

  protected readonly showRestore = signal(false);
  protected readonly restoreTarget = signal<RestoreTarget | null>(null);
  protected readonly destinations = signal<{ label: string; value: string }[]>([]);
  protected readonly destinationId = signal<string>('');
  protected readonly restoreError = signal<string | null>(null);
  protected readonly restoring = signal(false);

  protected readonly viewItems = computed<DriveViewItem[]>(() => {
    const contents = this.contents();
    if (contents) {
      return [
        ...contents.folders.map((folder) => this.toViewItem(folder)),
        ...contents.files.map((file) => this.toViewItem(file)),
      ];
    }
    return this.entries().map((entry) => ({
      id: entry.id,
      kind: entry.resourceType === 'folder' ? 'folder' : 'file',
      name: entry.name,
      tag: entry.resourceType === 'folder' ? 'Carpeta' : 'Archivo',
      meta: this.describe(entry),
      updatedAt: entry.deletedAt,
      data: entry,
    }));
  });

  @ViewChild('itemMenu') private readonly itemMenu?: Menu;
  protected readonly menuItems = signal<MenuItem[]>([]);

  constructor(
    private trashApi: TrashService,
    private folderTree: FolderTreeService,
    private confirm: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.trashApi.list().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.contents.set(null);
        this.crumbs.set([]);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la papelera.');
        this.loading.set(false);
      },
    });
  }

  protected openFolder(item: DriveViewItem): void {
    if (item.kind !== 'folder') {
      return;
    }
    const name = item.name;
    this.crumbs.update((crumbs) => [...crumbs, { id: item.id, name }]);
    this.loading.set(true);
    this.error.set(null);
    this.trashApi.contents(item.id).subscribe({
      next: (contents) => {
        this.contents.set(contents);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el contenido de la carpeta.');
        this.loading.set(false);
        this.goBack();
      },
    });
  }

  protected goBack(): void {
    const crumbs = this.crumbs().slice(0, -1);
    this.crumbs.set(crumbs);
    if (crumbs.length === 0) {
      this.contents.set(null);
      this.reload();
      return;
    }
    const current = crumbs[crumbs.length - 1];
    this.loading.set(true);
    this.trashApi.contents(current.id).subscribe({
      next: (contents) => {
        this.contents.set(contents);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el contenido de la carpeta.');
        this.loading.set(false);
      },
    });
  }

  private toViewItem(item: TrashContentItem): DriveViewItem {
    const parts: string[] = [];
    if (item.itemCount > 1) {
      parts.push(`${item.itemCount} elementos`);
    }
    if (item.sizeBytes > 0) {
      parts.push(formatBytes(item.sizeBytes));
    }
    return {
      id: item.id,
      kind: item.resourceType === 'folder' ? 'folder' : 'file',
      name: item.name,
      tag: item.resourceType === 'folder' ? 'Carpeta' : 'Archivo',
      meta: parts.join(' · '),
      updatedAt: item.deletedAt,
      data: item,
    };
  }

  private describe(entry: TrashItem): string {
    const parts: string[] = [];
    if (entry.itemCount > 1) {
      parts.push(`${entry.itemCount} elementos`);
    }
    if (entry.sizeBytes > 0) {
      parts.push(formatBytes(entry.sizeBytes));
    }
    if (entry.locationName) {
      parts.push(entry.locationName);
    }
    return parts.join(' · ');
  }

  protected readonly rowActions = (item: DriveViewItem): DriveViewAction[] => {
    if (this.contents()) {
      return [
        { id: 'restore-item', icon: 'pi pi-refresh', label: 'Restaurar', severity: 'secondary' },
      ];
    }
    return [
      { id: 'restore', icon: 'pi pi-refresh', label: 'Restaurar', severity: 'secondary' },
      {
        id: 'restore-elsewhere',
        icon: 'pi pi-folder-open',
        label: 'Restaurar en otra ubicación',
        severity: 'secondary',
      },
      {
        id: 'delete',
        icon: 'pi pi-trash',
        label: 'Eliminar definitivamente',
        severity: 'danger',
      },
    ];
  };

  protected onAction(event: { item: DriveViewItem; actionId: string }): void {
    if (event.actionId === 'restore') {
      this.restore(event.item.data as TrashItem);
      return;
    }
    if (event.actionId === 'restore-elsewhere') {
      const entry = event.item.data as TrashItem;
      this.openRestoreDialog({ id: entry.id, name: entry.name, scope: 'group' });
      return;
    }
    if (event.actionId === 'restore-item') {
      const item = event.item.data as TrashContentItem;
      this.openRestoreDialog({ id: item.id, name: item.name, scope: 'item' });
      return;
    }
    if (event.actionId === 'delete') {
      this.confirmDelete(event.item.data as TrashItem);
    }
  }

  protected openItemMenu(event: MouseEvent, item: DriveViewItem): void {
    event.stopPropagation();
    const items: MenuItem[] = [];
    if (this.contents()) {
      const content = item.data as TrashContentItem;
      items.push({
        label: 'Restaurar',
        icon: 'pi pi-refresh',
        command: () =>
          this.openRestoreDialog({ id: content.id, name: content.name, scope: 'item' }),
      });
    } else {
      const entry = item.data as TrashItem;
      items.push({
        label: 'Restaurar',
        icon: 'pi pi-refresh',
        command: () => this.restore(entry),
      });
      items.push({
        label: 'Restaurar en otra ubicación',
        icon: 'pi pi-folder-open',
        command: () =>
          this.openRestoreDialog({ id: entry.id, name: entry.name, scope: 'group' }),
      });
      items.push({
        label: 'Eliminar definitivamente',
        icon: 'pi pi-trash',
        command: () => this.confirmDelete(entry),
      });
    }
    this.menuItems.set(items);
    this.itemMenu?.toggle(event);
  }

  private confirmDelete(entry: TrashItem): void {
    this.confirm.confirm({
      header: 'Eliminar definitivamente',
      message: `¿Eliminar "${entry.name}" y todo su contenido? Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deletePermanent(entry),
    });
  }

  private deletePermanent(entry: TrashItem): void {
    this.error.set(null);
    this.trashApi.deletePermanent(entry.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('No se pudo eliminar definitivamente.'),
    });
  }

  private async openRestoreDialog(target: RestoreTarget): Promise<void> {
    this.restoreTarget.set(target);
    this.destinationId.set('');
    this.restoreError.set(null);
    this.showRestore.set(true);
    try {
      this.destinations.set(await this.folderTree.options({ includeRoot: true }));
    } catch {
      this.destinations.set([]);
    }
  }

  private restore(entry: TrashItem): void {
    this.restoringId.set(entry.id);
    this.error.set(null);
    this.trashApi.restore(entry.id).subscribe({
      next: () => {
        this.restoringId.set(null);
        this.reload();
      },
      error: (err: { status?: number }) => {
        this.restoringId.set(null);
        if (err?.status === 400) {
          this.openRestoreDialog({ id: entry.id, name: entry.name, scope: 'group' });
          return;
        }
        this.error.set(
          err?.status === 409
            ? 'Ya existe un elemento con ese nombre en el destino.'
            : 'No se pudo restaurar.',
        );
      },
    });
  }

  protected saveRestore(): void {
    const target = this.restoreTarget();
    const destinationId = this.destinationId();
    if (!target || !destinationId) {
      this.restoreError.set('Elige la carpeta destino.');
      return;
    }
    this.restoring.set(true);
    this.restoreError.set(null);
    const request =
      target.scope === 'group'
        ? this.trashApi.restore(target.id, destinationId)
        : this.trashApi.restoreItem(target.id, destinationId);
    request.subscribe({
      next: () => {
        this.restoring.set(false);
        this.showRestore.set(false);
        this.refreshCurrent();
      },
      error: (err: { status?: number }) => {
        this.restoring.set(false);
        this.restoreError.set(
          err?.status === 409
            ? 'Ya existe un elemento con ese nombre en el destino.'
            : 'No se pudo restaurar el elemento.',
        );
      },
    });
  }

  private refreshCurrent(): void {
    const crumbs = this.crumbs();
    if (crumbs.length === 0) {
      this.reload();
      return;
    }
    const current = crumbs[crumbs.length - 1];
    this.loading.set(true);
    this.trashApi.contents(current.id).subscribe({
      next: (contents) => {
        this.contents.set(contents);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el contenido de la carpeta.');
        this.loading.set(false);
      },
    });
  }
}
