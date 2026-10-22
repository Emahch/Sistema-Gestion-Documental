import { Component, OnInit, ViewChild, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { ShareService } from '../../core/share.service';
import { FolderService } from '../../core/folder.service';
import { DriveView, DriveViewItem } from '../../shared/components/drive-view/drive-view';
import { PermissionsDialog } from '../../shared/components/permissions-dialog/permissions-dialog';
import type { ShareItem } from '../../models/share.model';

interface SharedGroup {
  id: string;
  kind: 'folder' | 'file';
  name: string;
  ownerEmail?: string;
  people: { email: string; permission: string }[];
}

@Component({
  selector: 'app-shared',
  imports: [
    ButtonModule,
    DriveView,
    MenuModule,
    PermissionsDialog,
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

  constructor(
    private sharesApi: ShareService,
    private foldersApi: FolderService,
    private route: ActivatedRoute,
    private router: Router,
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
    if (this.mode() === 'by-me') {
      this.openSharedItem(item);
      return;
    }
    this.openWithMeItem(item);
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
    if (this.mode() === 'by-me') {
      const group = item.data as SharedGroup;
      this.menuItems.set([
        {
          label: group.kind === 'folder' ? 'Abrir' : 'Descargar',
          icon: group.kind === 'folder' ? 'pi pi-folder-open' : 'pi pi-download',
          command: () => this.openSharedItem(item),
        },
        {
          label: 'Administrar permisos',
          icon: 'pi pi-users',
          command: () => this.openPermissions(group),
        },
      ]);
      this.itemMenu?.toggle(event);
      return;
    }
    const share = item.data as ShareItem;
    this.menuItems.set([
      {
        label: share.resourceType === 'folder' ? 'Abrir' : 'Descargar',
        icon: share.resourceType === 'folder' ? 'pi pi-folder-open' : 'pi pi-download',
        command: () => this.openWithMeItem(item),
      },
    ]);
    this.itemMenu?.toggle(event);
  }

  protected openPermissions(group: SharedGroup): void {
    this.permTarget.set({ kind: group.kind, id: group.id, name: group.name });
    this.showPermissions.set(true);
  }
}
