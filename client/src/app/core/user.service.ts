import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import type {
  AdminUserRow,
  CreateUserRequest,
  PagedUsers,
  StorageInfo,
  UpdateUserRequest,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(
    private http: HttpClient,
    private rest: RestConstants,
  ) { }

  private get baseUrl(): string {
    return this.rest.apiUrl;
  }

  listUsers(page = 1, limit = 20): Observable<PagedUsers> {
    return this.http.get<PagedUsers>(`${this.baseUrl}/users`, { params: { page, limit } });
  }

  createUser(data: CreateUserRequest): Observable<AdminUserRow> {
    return this.http.post<AdminUserRow>(`${this.baseUrl}/users`, data);
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<AdminUserRow> {
    return this.http.patch<AdminUserRow>(`${this.baseUrl}/users/${id}`, data);
  }

  setUserStatus(id: string, isActive: boolean): Observable<AdminUserRow> {
    return this.http.patch<AdminUserRow>(`${this.baseUrl}/users/${id}/status`, { isActive });
  }

  setUserQuota(id: string, quotaBytes: number | null): Observable<AdminUserRow> {
    return this.http.patch<AdminUserRow>(`${this.baseUrl}/users/${id}/quota`, { quotaBytes });
  }

  getUserStorage(id: string, reconcile = false): Observable<StorageInfo> {
    return this.http.get<StorageInfo>(`${this.baseUrl}/users/${id}/storage`, {
      params: { reconcile },
    });
  }

  updateMe(data: { email?: string; password?: string }): Observable<AdminUserRow> {
    return this.http.patch<AdminUserRow>(`${this.baseUrl}/users/me`, data);
  }
}
