import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
  });

  it('should start in light mode without stored value', () => {
    const service = TestBed.runInInjectionContext(() => new ThemeService());
    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
  });

  it('should toggle and persist the theme', () => {
    const service = TestBed.runInInjectionContext(() => new ThemeService());
    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(localStorage.getItem('docsdrive-theme')).toBe('dark');
    service.toggle();
    expect(service.theme()).toBe('light');
  });
});
