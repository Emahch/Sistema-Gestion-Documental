import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AdminUserRow, AuthService } from '../../core/auth.service';
import { isValidEmail } from '../../shared/validators';

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

@Component({
  selector: 'app-users',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
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

  protected readonly roleOptions = [
    { label: 'Usuario', value: 'user' },
    { label: 'Administrador', value: 'admin' },
  ];

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.reload();
  }

  protected reload(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.listUsers(page, 10).subscribe({
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
    this.auth
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

  protected formatBytes = formatBytes;
}
