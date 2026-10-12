import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../core/auth.service';
import { ThemeToggle } from '../shared/components/theme-toggle/theme-toggle';
import { isValidEmail } from '../shared/validators';

@Component({
  selector: 'app-shell',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    TagModule,
    ThemeToggle,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly collapsed = signal(false);

  protected readonly showProfile = signal(false);
  protected readonly profileEmail = signal('');
  protected readonly profilePassword = signal('');
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileSaving = signal(false);

  constructor(
    protected readonly auth: AuthService,
    private router: Router,
  ) {}

  protected toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }

  protected openProfile(): void {
    this.profileEmail.set(this.auth.currentUser()?.email ?? '');
    this.profilePassword.set('');
    this.profileError.set(null);
    this.showProfile.set(true);
  }

  protected saveProfile(): void {
    const email = this.profileEmail().trim();
    if (email && !isValidEmail(email)) {
      this.profileError.set('Ingresa un email válido.');
      return;
    }
    if (!email && !this.profilePassword()) {
      this.profileError.set('Ingresa un email o una contraseña nueva.');
      return;
    }
    this.profileSaving.set(true);
    this.profileError.set(null);
    this.auth.updateMe({ email: email || undefined, password: this.profilePassword() || undefined }).subscribe({
      next: (user) => {
        this.auth.patchSession({ email: user.email });
        this.profileSaving.set(false);
        this.showProfile.set(false);
      },
      error: (err: { status?: number }) => {
        this.profileError.set(err?.status === 409 ? 'Ese email ya está registrado.' : 'No se pudo actualizar el perfil.');
        this.profileSaving.set(false);
      },
    });
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
