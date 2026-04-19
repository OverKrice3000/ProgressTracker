import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface DailyTotalResponse {
  totalMinutes: number;
}

@Injectable({ providedIn: 'root' })
export class ProgressLogsApiService {
  private readonly http = inject(HttpClient);

  getDailyTotal(
    dayStartIso: string,
    dayEndIso: string,
    excludeLogId?: string,
    /** When set, server sums by `logged_date` for this calendar day (matches retrospective logging). */
    dateYmd?: string,
  ): Observable<DailyTotalResponse> {
    let params = new HttpParams().set('dayStart', dayStartIso).set('dayEnd', dayEndIso);
    if (excludeLogId) {
      params = params.set('excludeLogId', excludeLogId);
    }
    if (dateYmd) {
      params = params.set('dateYmd', dateYmd);
    }
    return this.http.get<DailyTotalResponse>('api/progress-logs/daily-total', { params, withCredentials: true });
  }
}
