import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<main class="boot"><h1>DocsDrive</h1><router-outlet /></main>`,
  styles: [
    '.boot { display: grid; place-items: center; min-height: 100dvh; font-family: sans-serif; }',
  ],
})
export class App { }
