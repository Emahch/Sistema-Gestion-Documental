import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import type {
  DeletePermanentResult,
  RestoreResult,
  TrashContents,
  TrashItem,
} from '../models/trash.model';

@Injectable({ providedIn: 'root' })
export class TrashService {
  constructor(
    private http: HttpClient,
    private rest: RestConstants,
  ) {}

  private get baseUrl(): string {
    return this.rest.apiUrl;
  }

  list(): Observable<TrashItem[]> {
    return this.http.get<TrashItem[]>(`${this.baseUrl}/trash`);
  }

  contents(folderId: string): Observable<TrashContents> {
    return this.http.get<TrashContents>(`${this.baseUrl}/trash/${folderId}/contents`);
  }

  restore(id: string, destinationId?: string): Observable<RestoreResult> {
    return this.http.patch<RestoreResult>(
      `${this.baseUrl}/trash/${id}/restore`,
      destinationId ? { destinationId } : {},
    );
  }

  restoreItem(id: string, destinationId: string): Observable<RestoreResult> {
    return this.http.patch<RestoreResult>(`${this.baseUrl}/trash/${id}/restore-item`, {
      destinationId,
    });
  }

  deletePermanent(id: string): Observable<DeletePermanentResult> {
    return this.http.delete<DeletePermanentResult>(`${this.baseUrl}/trash/${id}`);
  }
}
