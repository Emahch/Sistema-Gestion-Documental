import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ThemeService } from '../../../core/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [ButtonModule],
  template: `
    <p-button
      [icon]="theme.theme() === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
      [rounded]="true"
      [text]="true"
      severity="secondary"
      ariaLabel="Alternar tema claro/oscuro"
      (onClick)="theme.toggle()"
    />
  `,
})
export class ThemeToggle {
  constructor(protected readonly theme: ThemeService) {}
}
