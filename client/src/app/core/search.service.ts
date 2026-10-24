import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import { withOptionalParams } from './http-params';

export interface SearchResultItem {
  id: string;
  kind: 'file' | 'folder';
  name: string;
  mimeType?: string;
  category?: string;
  size?: number;
  folderId?: string;
  parentId?: string | null;
  ownerId: string;
  permission?: 'owner' | 'edit' | 'read' | null;
  isRoot?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchResult {
  data: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private http: HttpClient, private rest: RestConstants) {}

  private get baseUrl(): string {
    return this.rest.apiUrl;
  }

  search(q: string, scope: 'own' | 'shared' | 'all' = 'all', page = 1, limit = 50): Observable<SearchResult> {
    let params = new HttpParams().set('q', q).set('scope', scope).set('page', String(page)).set('limit', String(limit));
    return this.http.get<SearchResult>(`${this.baseUrl}/search`, { params });
  }

  filter(
    filters: { category?: 'TXT' | 'MD' | null; from?: string | null; to?: string | null },
    scope: 'own' | 'shared' | 'all' = 'all',
    page = 1,
    limit = 50,
  ): Observable<SearchResult> {
    const params = withOptionalParams(
      new HttpParams().set('scope', scope).set('page', String(page)).set('limit', String(limit)),
      filters,
    );
    return this.http.get<SearchResult>(`${this.baseUrl}/files/filter`, { params });
  }
}
