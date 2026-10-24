import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RestConstants } from './rest-constants';
import { withOptionalParams } from './http-params';
import type {
  ActivityAffectedItem,
  ActivityList,
  ActivityResourceItem,
} from '../models/activity.model';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  constructor(
    private http: HttpClient,
    private rest: RestConstants,
  ) {}

  private get baseUrl(): string {
    return this.rest.apiUrl;
  }

  resourceHistory(
    resourceType: 'file' | 'folder',
    resourceId: string,
    params: { page?: number; limit?: number; from?: string; to?: string } = {},
  ): Observable<ActivityList<ActivityResourceItem>> {
    let httpParams = new HttpParams()
      .set('resourceType', resourceType)
      .set('resourceId', resourceId);
    httpParams = withOptionalParams(httpParams, params);
    return this.http.get<ActivityList<ActivityResourceItem>>(`${this.baseUrl}/activity/resource`, {
      params: httpParams,
    });
  }

  affected(
    params: { page?: number; limit?: number; from?: string; to?: string } = {},
  ): Observable<ActivityList<ActivityAffectedItem>> {
    const httpParams = withOptionalParams(new HttpParams(), params);
    return this.http.get<ActivityList<ActivityAffectedItem>>(`${this.baseUrl}/activity/affected`, {
      params: httpParams,
    });
  }
}
