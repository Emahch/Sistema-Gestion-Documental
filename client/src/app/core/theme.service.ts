import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'docsdrive-theme';
const DARK_CLASS = 'app-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(ThemeService.initial());

  private static initial(): Theme {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private set(theme: Theme): void {
    this.theme.set(theme);
    this.apply(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* almacenamiento no disponible: el tema igual aplica en memoria */
    }
  }

  private apply(theme: Theme): void {
    document.documentElement.classList.toggle(DARK_CLASS, theme === 'dark');
  }
}
