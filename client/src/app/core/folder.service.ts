import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import type { DriveFolder, FolderChildren } from '../models/folder.model';

@Injectable({ providedIn: 'root' })
export class FolderService {
  constructor(
    private http: HttpClient,
    private rest: RestConstants,
  ) {}

  private get baseUrl(): string {
    return this.rest.apiUrl;
  }

  children(parentId: string | null, page = 1, limit = 50): Observable<FolderChildren> {
    const params: Record<string, string | number> = { page, limit };
    if (parentId) {
      params['parentId'] = parentId;
    }
    return this.http.get<FolderChildren>(`${this.baseUrl}/folders`, { params });
  }

  root(): Observable<DriveFolder> {
    return this.http.get<DriveFolder>(`${this.baseUrl}/folders/root`);
  }

  breadcrumb(id: string): Observable<DriveFolder[]> {
    return this.http.get<DriveFolder[]>(`${this.baseUrl}/folders/${id}/breadcrumb`);
  }

  create(parentId: string, name: string): Observable<DriveFolder> {
    return this.http.post<DriveFolder>(`${this.baseUrl}/folders`, { parentId, name });
  }

  rename(id: string, name: string): Observable<DriveFolder> {
    return this.http.patch<DriveFolder>(`${this.baseUrl}/folders/${id}`, { name });
  }

  move(id: string, destinationId: string): Observable<DriveFolder> {
    return this.http.patch<DriveFolder>(`${this.baseUrl}/folders/${id}/move`, { destinationId });
  }
}
