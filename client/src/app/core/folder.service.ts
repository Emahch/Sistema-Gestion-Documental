import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import type { DriveFile, DriveFolder, FolderChildren } from '../models/folder.model';

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

  moveDestinations(
    resourceType: 'file' | 'folder',
    resourceId: string,
  ): Observable<{ id: string; name: string; label: string }[]> {
    return this.http.get<{ id: string; name: string; label: string }[]>(
      `${this.baseUrl}/folders/move-destinations`,
      { params: { resourceType, resourceId } },
    );
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

  trash(id: string): Observable<{ deletionId: string; folders: number; files: number }> {
    return this.http.delete<{ deletionId: string; folders: number; files: number }>(`${this.baseUrl}/folders/${id}`);
  }

  uploadFile(folderId: string, file: File): Observable<HttpEvent<DriveFile>> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('folderId', folderId);
    return this.http.post<DriveFile>(`${this.baseUrl}/files`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  editFileContent(id: string, file: File): Observable<HttpEvent<DriveFile>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.put<DriveFile>(`${this.baseUrl}/files/${id}/content`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  renameFile(id: string, name: string): Observable<DriveFile> {
    return this.http.patch<DriveFile>(`${this.baseUrl}/files/${id}`, { name });
  }

  moveFile(id: string, destinationId: string): Observable<DriveFile> {
    return this.http.patch<DriveFile>(`${this.baseUrl}/files/${id}/move`, { destinationId });
  }

  trashFile(id: string): Observable<{ deletionId: string }> {
    return this.http.delete<{ deletionId: string }>(`${this.baseUrl}/files/${id}`);
  }

  editContent(id: string, file: File): Observable<HttpEvent<DriveFile>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.put<DriveFile>(`${this.baseUrl}/files/${id}/content`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  downloadFile(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/files/${id}/content`, { responseType: 'blob' });
  }
}
