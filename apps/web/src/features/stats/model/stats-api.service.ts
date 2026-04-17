import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface StatsResponse {
  range: { from: string; to: string; days: number };
  totals: { loggedMinutes: number; idleMinutes: number; untrackedMinutes: number };
  byTask: { taskId: string; taskName: string; minutes: number }[];
}

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);

  getSummary(from: string, to: string, idleHours: number): Observable<StatsResponse> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('idleHours', String(idleHours));

    return this.http.get<StatsResponse>('/api/stats', {
      params,
      withCredentials: true,
    });
  }
}
