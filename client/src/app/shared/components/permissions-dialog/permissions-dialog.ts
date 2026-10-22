import { Component, effect, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ConfirmationService } from 'primeng/api';
import { ShareService } from '../../../core/share.service';
import { UserService } from '../../../core/user.service';
import { isValidEmail } from '../../validators';
import type { ShareItem, SharePermission } from '../../../models/share.model';

@Component({
  selector: 'app-permissions-dialog',
  imports: [
    AutoCompleteModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    TagModule,
  ],
  templateUrl: './permissions-dialog.html',
  styleUrl: './permissions-dialog.css',
})
export class PermissionsDialog {
  readonly visible = model(false);
  readonly resourceType = input<'file' | 'folder'>('folder');
  readonly resourceId = input('');
  readonly resourceName = input('');

  protected readonly shares = signal<ShareItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly email = signal('');
  protected readonly permission = signal<SharePermission>('read');
  protected readonly saving = signal(false);
  protected readonly busyUserId = signal<string | null>(null);
  protected readonly suggestions = signal<string[]>([]);
  protected readonly searching = signal(false);

  protected readonly permissionOptions = [
    { label: 'Lectura', value: 'read' },
    { label: 'Edición', value: 'edit' },
  ];

  constructor(
    private sharesApi: ShareService,
    private users: UserService,
    private confirm: ConfirmationService,
  ) {
    effect(() => {
      if (this.visible() && this.resourceId()) {
        this.email.set('');
        this.suggestions.set([]);
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sharesApi.forResource(this.resourceType(), this.resourceId()).subscribe({
      next: (shares) => {
        this.shares.set(shares);
        this.loading.set(false);
      },
      error: (err: { status?: number }) => {
        this.error.set(err?.status === 403 ? 'Solo el propietario administra permisos.' : 'No se pudieron cargar los permisos.');
        this.loading.set(false);
      },
    });
  }

  protected changePermission(share: ShareItem, permission: SharePermission): void {
    if (share.permission === permission) {
      return;
    }
    this.busyUserId.set(share.sharedWithId);
    this.error.set(null);
    this.sharesApi.updatePermission(this.resourceId(), share.sharedWithId, permission).subscribe({
      next: () => {
        this.busyUserId.set(null);
        this.load();
      },
      error: (err: { status?: number }) => {
        this.error.set(err?.status === 403 ? 'Solo el propietario administra permisos.' : 'No se pudo cambiar el permiso.');
        this.busyUserId.set(null);
      },
    });
  }

  protected removeAccess(share: ShareItem): void {
    this.confirm.confirm({
      header: 'Quitar acceso',
      message: `¿Quitar el acceso de ${share.sharedWithEmail}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Quitar',
      rejectLabel: 'Cancelar',
      accept: () => this.remove(share),
    });
  }

  private remove(share: ShareItem): void {
    this.busyUserId.set(share.sharedWithId);
    this.error.set(null);
    this.sharesApi.remove(this.resourceId(), share.sharedWithId).subscribe({
      next: () => {
        this.busyUserId.set(null);
        this.load();
      },
      error: (err: { status?: number }) => {
        this.error.set(
          err?.status === 400
            ? 'La carpeta contiene archivos de otros usuarios.'
            : err?.status === 403
              ? 'Solo el propietario administra permisos.'
              : 'No se pudo quitar el acceso.'
        );
        this.busyUserId.set(null);
      },
    });
  }

  protected search(event: AutoCompleteCompleteEvent): void {
    const query = event.query.trim();
    if (query.length < 2) {
      this.suggestions.set([]);
      return;
    }
    this.searching.set(true);
    this.users.searchUsers(query).subscribe({
      next: (users) => {
        const withAccess = new Set(this.shares().map((share) => share.sharedWithEmail.toLowerCase()));
        this.suggestions.set(
          users.map((user) => user.email).filter((email) => !withAccess.has(email.toLowerCase()))
        );
        this.searching.set(false);
      },
      error: () => {
        this.suggestions.set([]);
        this.searching.set(false);
      },
    });
  }

  protected addUser(): void {
    const email = this.email().trim();
    if (!isValidEmail(email)) {
      this.error.set('Ingresa un email válido.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.users.resolveByEmail(email).subscribe({
      next: (resolved) => {
        this.sharesApi
          .share({
            resourceType: this.resourceType(),
            resourceId: this.resourceId(),
            sharedWithId: resolved.id,
            permission: this.permission(),
          })
          .subscribe({
            next: () => {
              this.saving.set(false);
              this.email.set('');
              this.load();
            },
            error: (err: { status?: number }) => {
              this.error.set(
                err?.status === 403
                  ? 'Solo el propietario puede compartir.'
                  : err?.status === 409
                    ? 'Ya compartido con ese usuario.'
                    : err?.status === 404
                      ? 'Recurso no encontrado.'
                      : 'No se pudo compartir.'
              );
              this.saving.set(false);
            },
          });
      },
      error: (err: { status?: number }) => {
        this.error.set(err?.status === 404 ? 'Ese email no está registrado.' : 'No se pudo resolver el usuario.');
        this.saving.set(false);
      },
    });
  }
}
