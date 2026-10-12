import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';
import type { AdminUserRow, StorageInfo } from '../../models/user.model';
import { isValidEmail } from '../../shared/validators';
import { formatBytes } from '../../shared/format';

@Component({
  selector: 'app-users',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    ConfirmDialogModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    TableModule,
    TagModule,
  ],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users implements OnInit {
  protected readonly users = signal<AdminUserRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly showDialog = signal(false);
  protected readonly newEmail = signal('');
  protected readonly newPassword = signal('');
  protected readonly newRole = signal<'user' | 'admin'>('user');
  protected readonly unlimitedQuota = signal(true);
  protected readonly newQuotaMB = signal<number | null>(1024);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly showEditDialog = signal(false);
  protected readonly editId = signal('');
  protected readonly editEmail = signal('');
  protected readonly editPassword = signal('');
  protected readonly editRole = signal<'user' | 'admin'>('user');
  protected readonly editIsSelf = signal(false);
  protected readonly editSaving = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly showQuotaDialog = signal(false);
  protected readonly quotaId = signal('');
  protected readonly quotaUnlimited = signal(true);
  protected readonly quotaMB = signal<number | null>(1024);
  protected readonly quotaSaving = signal(false);
  protected readonly quotaError = signal<string | null>(null);

  protected readonly showStorageDialog = signal(false);
  protected readonly storageInfo = signal<StorageInfo | null>(null);
  protected readonly storageEmail = signal('');

  protected readonly roleOptions = [
    { label: 'Usuario', value: 'user' },
    { label: 'Administrador', value: 'admin' },
  ];

  constructor(
    private userApi: UserService,
    protected readonly auth: AuthService,
    private confirm: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  protected isSelf(id: string): boolean {
    return this.auth.currentUser()?.id === id;
  }

  protected reload(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.userApi.listUsers(page, 10).subscribe({
      next: (result) => {
        this.users.set(result.data);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los usuarios.');
        this.loading.set(false);
      },
    });
  }

  protected onPage(event: { first?: number; rows?: number }): void {
    const rows = event.rows ?? 10;
    const page = Math.floor((event.first ?? 0) / rows) + 1;
    this.reload(page);
  }

  protected openDialog(): void {
    this.newEmail.set('');
    this.newPassword.set('');
    this.newRole.set('user');
    this.unlimitedQuota.set(true);
    this.newQuotaMB.set(1024);
    this.formError.set(null);
    this.showDialog.set(true);
  }

  protected save(): void {
    if (!this.newEmail().trim() || !this.newPassword()) {
      this.formError.set('Email y contraseña son obligatorios.');
      return;
    }
    if (!isValidEmail(this.newEmail())) {
      this.formError.set('Ingresa un email válido.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.userApi
      .createUser({
        email: this.newEmail().trim(),
        password: this.newPassword(),
        role: this.newRole(),
        quotaBytes: this.unlimitedQuota() ? null : (this.newQuotaMB() ?? 0) * 1024 * 1024,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showDialog.set(false);
          this.reload();
        },
        error: (err: { status?: number }) => {
          this.formError.set(err?.status === 409 ? 'Ese email ya está registrado.' : 'No se pudo crear el usuario.');
          this.saving.set(false);
        },
      });
  }

  protected openEdit(row: AdminUserRow): void {
    this.editId.set(row.id);
    this.editEmail.set(row.email);
    this.editPassword.set('');
    this.editRole.set(row.role as 'user' | 'admin');
    this.editIsSelf.set(this.isSelf(row.id));
    this.editError.set(null);
    this.showEditDialog.set(true);
  }

  protected saveEdit(): void {
    if (!isValidEmail(this.editEmail())) {
      this.editError.set('Ingresa un email válido.');
      return;
    }
    this.editSaving.set(true);
    this.editError.set(null);
    this.userApi
      .updateUser(this.editId(), {
        email: this.editEmail().trim(),
        password: this.editPassword() || undefined,
        role: this.editRole(),
      })
      .subscribe({
        next: () => {
          this.editSaving.set(false);
          this.showEditDialog.set(false);
          this.reload();
        },
        error: (err: { status?: number }) => {
          this.editError.set(
            err?.status === 409
              ? 'Ese email ya está registrado.'
              : err?.status === 400
                ? 'Cambio no permitido.'
                : 'No se pudo actualizar el usuario.'
          );
          this.editSaving.set(false);
        },
      });
  }

  protected confirmToggle(row: AdminUserRow): void {
    this.confirm.confirm({
      header: row.isActive ? 'Desactivar usuario' : 'Activar usuario',
      message: row.isActive
        ? `¿Desactivar a ${row.email}? Perderá el acceso de inmediato.`
        : `¿Activar a ${row.email}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: row.isActive ? 'Desactivar' : 'Activar',
      rejectLabel: 'Cancelar',
      accept: () => this.toggleStatus(row),
    });
  }

  private toggleStatus(row: AdminUserRow): void {
    this.userApi.setUserStatus(row.id, !row.isActive).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('No se pudo cambiar el estado.'),
    });
  }

  protected openQuota(row: AdminUserRow): void {
    this.quotaId.set(row.id);
    this.quotaUnlimited.set(row.storage.quotaBytes === null);
    this.quotaMB.set(row.storage.quotaBytes === null ? 1024 : Math.round(row.storage.quotaBytes / 1024 / 1024));
    this.quotaError.set(null);
    this.showQuotaDialog.set(true);
  }

  protected saveQuota(): void {
    this.quotaSaving.set(true);
    this.quotaError.set(null);
    this.userApi.setUserQuota(this.quotaId(), this.quotaUnlimited() ? null : (this.quotaMB() ?? 0) * 1024 * 1024).subscribe({
      next: () => {
        this.quotaSaving.set(false);
        this.showQuotaDialog.set(false);
        this.reload();
      },
      error: () => {
        this.quotaError.set('No se pudo ajustar la cuota.');
        this.quotaSaving.set(false);
      },
    });
  }

  protected openStorage(row: AdminUserRow): void {
    this.storageEmail.set(row.email);
    this.storageInfo.set(null);
    this.showStorageDialog.set(true);
    this.userApi.getUserStorage(row.id, true).subscribe({
      next: (info) => this.storageInfo.set(info),
      error: () => this.storageInfo.set(null),
    });
  }

  protected formatBytes = formatBytes;
}
