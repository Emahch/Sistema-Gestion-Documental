import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import type {
  FilesByCategoryResult,
  FilesByDateResult,
  OperationsByActionResult,
  OperationsByPeriodResult,
  ReceivedByUserResult,
  ReportUser,
  SharedByUserResult,
  TopFileRow,
  TopSharedFileRow,
  TopUserByFilesRow,
  TopUserBySharedRow,
  UserActivityResult,
} from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(
    private http: HttpClient,
    private rest: RestConstants,
  ) {}

  private get baseUrl(): string {
    return this.rest.apiUrl;
  }

  users(): Observable<ReportUser[]> {
    return this.http.get<ReportUser[]>(`${this.baseUrl}/reports/users`);
  }

  filesByCategory(): Observable<FilesByCategoryResult> {
    return this.http.get<FilesByCategoryResult>(`${this.baseUrl}/reports/files-by-category`);
  }

  filesByDate(params: {
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Observable<FilesByDateResult> {
    let httpParams = new HttpParams().set('from', params.from).set('to', params.to);
    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<FilesByDateResult>(`${this.baseUrl}/reports/files-by-date`, {
      params: httpParams,
    });
  }

  topFiles(params: { limit?: number; from?: string; to?: string } = {}): Observable<TopFileRow[]> {
    let httpParams = new HttpParams();
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params.to) {
      httpParams = httpParams.set('to', params.to);
    }
    return this.http.get<TopFileRow[]>(`${this.baseUrl}/reports/top-files`, { params: httpParams });
  }

  topUsersByFiles(): Observable<TopUserByFilesRow[]> {
    return this.http.get<TopUserByFilesRow[]>(`${this.baseUrl}/reports/top-users-by-files`);
  }

  topUsersByShared(params: { limit?: number } = {}): Observable<TopUserBySharedRow[]> {
    let httpParams = new HttpParams();
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<TopUserBySharedRow[]>(`${this.baseUrl}/reports/top-users-by-shared`, {
      params: httpParams,
    });
  }

  topSharedFiles(params: { limit?: number } = {}): Observable<TopSharedFileRow[]> {
    let httpParams = new HttpParams();
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<TopSharedFileRow[]>(`${this.baseUrl}/reports/top-shared-files`, {
      params: httpParams,
    });
  }

  sharedByUser(
    userId: string,
    params: { page?: number; limit?: number } = {},
  ): Observable<SharedByUserResult> {
    let httpParams = new HttpParams().set('userId', userId);
    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<SharedByUserResult>(`${this.baseUrl}/reports/shared-by-user`, {
      params: httpParams,
    });
  }

  receivedByUser(
    userId: string,
    params: { page?: number; limit?: number } = {},
  ): Observable<ReceivedByUserResult> {
    let httpParams = new HttpParams().set('userId', userId);
    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<ReceivedByUserResult>(`${this.baseUrl}/reports/received-by-user`, {
      params: httpParams,
    });
  }

  userActivity(
    userId: string,
    params: { from: string; to: string; page?: number; limit?: number },
  ): Observable<UserActivityResult> {
    let httpParams = new HttpParams().set('userId', userId).set('from', params.from).set('to', params.to);
    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<UserActivityResult>(`${this.baseUrl}/reports/user-activity`, {
      params: httpParams,
    });
  }

  operationsByAction(): Observable<OperationsByActionResult> {
    return this.http.get<OperationsByActionResult>(`${this.baseUrl}/reports/operations-by-action`);
  }

  operationsByPeriod(params: {
    granularity?: 'day' | 'week' | 'month';
    from?: string;
    to?: string;
  } = {}): Observable<OperationsByPeriodResult> {
    let httpParams = new HttpParams();
    if (params.granularity) {
      httpParams = httpParams.set('granularity', params.granularity);
    }
    if (params.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params.to) {
      httpParams = httpParams.set('to', params.to);
    }
    return this.http.get<OperationsByPeriodResult>(`${this.baseUrl}/reports/operations-by-period`, {
      params: httpParams,
    });
  }
}
