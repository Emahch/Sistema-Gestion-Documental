import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RestConstants {
  readonly apiUrl = 'http://localhost:3000/api';
}
