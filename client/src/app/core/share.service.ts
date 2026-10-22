import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import type { PagedShares, ShareItem, SharePermission, ShareRequest } from '../models/share.model';

@Injectable({ providedIn: 'root' })
export class ShareService {
  constructor(
    private http: HttpClient,
    private rest: RestConstants,
  ) {}

  private get baseUrl(): string {
    return this.rest.apiUrl;
  }

  share(data: ShareRequest): Observable<ShareItem> {
    return this.http.post<ShareItem>(`${this.baseUrl}/shares`, data);
  }

  forResource(resourceType: string, resourceId: string): Observable<ShareItem[]> {
    return this.http.get<ShareItem[]>(`${this.baseUrl}/shares/resource`, {
      params: { resourceType, resourceId },
    });
  }

  updatePermission(resourceId: string, sharedWithId: string, permission: SharePermission): Observable<ShareItem> {
    return this.http.patch<ShareItem>(`${this.baseUrl}/shares`, { resourceId, sharedWithId, permission });
  }

  remove(resourceId: string, sharedWithId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/shares`, { body: { resourceId, sharedWithId } });
  }

  withMe(page = 1, limit = 20): Observable<PagedShares> {
    return this.http.get<PagedShares>(`${this.baseUrl}/shares/with-me`, { params: { page, limit } });
  }

  byMe(page = 1, limit = 20): Observable<PagedShares> {
    return this.http.get<PagedShares>(`${this.baseUrl}/shares/by-me`, { params: { page, limit } });
  }
}
