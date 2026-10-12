import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  storage: { quotaBytes: number | null; usedBytes: number };
  createdAt: string;
}

export interface PagedUsers {
  data: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: 'user' | 'admin';
  quotaBytes: number | null;
}

const API_URL = 'http://localhost:3000/api';
const TOKEN_KEY = 'docsdrive-token';
const USER_KEY = 'docsdrive-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<SessionUser | null>(AuthService.loadUser());

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  private static loadUser(): SessionUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, { email, password });
  }

  setSession(token: string, user: SessionUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  listUsers(page = 1, limit = 20): Observable<PagedUsers> {
    return this.http.get<PagedUsers>(`${API_URL}/users`, { params: { page, limit } });
  }

  createUser(data: CreateUserRequest): Observable<SessionUser> {
    return this.http.post<SessionUser>(`${API_URL}/users`, data);
  }

  updateMe(data: { email?: string; password?: string }): Observable<SessionUser> {
    return this.http.patch<SessionUser>(`${API_URL}/users/me`, data);
  }

  patchSession(patch: Partial<SessionUser>): void {
    const current = this.currentUser();
    if (!current) {
      return;
    }
    const updated = { ...current, ...patch };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    this.currentUser.set(updated);
  }
}
