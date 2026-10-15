import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataViewModule } from 'primeng/dataview';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { MenuItem, ConfirmationService } from 'primeng/api';
import { FolderService } from '../../core/folder.service';
import type { DriveFile, DriveFolder } from '../../models/folder.model';
import { formatBytes } from '../../shared/format';

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
  protected readonly rows = signal(12);
  protected readonly first = signal(0);
  protected readonly totalRecords = signal(0);

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

  protected readonly breadcrumb = computed<MenuItem[]>(() =>
    this.crumbs().map((folder, index, chain) =>
      index === chain.length - 1
        ? { label: folder.name }
        : { label: folder.name, command: () => this.openFolder(folder.id) }
    )
  );

  constructor(
    private foldersApi: FolderService,
    private route: ActivatedRoute,
    private router: Router,
    private confirm: ConfirmationService,
  ) {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.currentId.set(params.get('folderId'));
      this.first.set(0);
      this.reload(1);
    });
  }

  ngOnInit(): void {
    this.reload(1);
  }

  protected openFolder(id: string | null): void {
    this.router.navigate(['/drive'], { queryParams: id ? { folderId: id } : {} });
  }

  protected reload(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.foldersApi.children(this.currentId(), page, this.rows()).subscribe({
      next: (result) => {
        this.folders.set(result.folders);
        this.files.set(result.files);
        this.totalRecords.set(result.totalFolders + result.totalFiles);
        this.loading.set(false);
        this.loadCrumbs();
      },
      error: () => {
        this.error.set('No se pudo cargar la carpeta.');
        this.loading.set(false);
      },
    });
  }

  protected onPage(event: { first?: number; rows?: number }): void {
    const rows = event.rows ?? this.rows();
    if (rows !== this.rows()) {
      this.rows.set(rows);
    }
    this.first.set(event.first ?? 0);
    this.reload(Math.floor((event.first ?? 0) / rows) + 1);
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
        this.first.set(0);
        this.reload(1);
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
        this.first.set(0);
        this.reload(1);
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
        this.first.set(0);
        this.reload(1);
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
        this.first.set(0);
        this.reload(1);
      },
      error: (err: { status?: number }) => {
        this.error.set(
          err?.status === 400 ? 'No se puede eliminar: revisa el contenido.' : 'No se pudo eliminar la carpeta.'
        );
      },
    });
  }

  protected formatBytes = formatBytes;
}
