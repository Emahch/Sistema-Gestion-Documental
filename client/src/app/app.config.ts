import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { DocsDrivePreset } from './theme/app.preset';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: DocsDrivePreset,
        options: { darkModeSelector: '.app-dark' },
      },
    }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
};
