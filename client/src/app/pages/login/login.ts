import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth.service';
import { isValidEmail } from '../../shared/validators';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-login',
  imports: [FormsModule, ButtonModule, CardModule, InputTextModule, PasswordModule, ThemeToggle],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  protected submit(): void {
    if (!this.email().trim() || !this.password()) {
      this.error.set('Ingresa email y contraseña.');
      return;
    }
    if (!isValidEmail(this.email())) {
      this.error.set('Ingresa un email válido.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.email().trim(), this.password()).subscribe({
      next: ({ token, user }) => {
        this.auth.setSession(token, user);
        this.router.navigate(['/']);
      },
      error: () => {
        this.error.set('Credenciales inválidas.');
        this.loading.set(false);
      },
    });
  }
}
