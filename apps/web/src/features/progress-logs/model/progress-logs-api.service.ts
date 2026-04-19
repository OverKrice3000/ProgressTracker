import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TrackerType } from '@progress-tracker/contracts';
import { Observable } from 'rxjs';

export interface DailyTotalResponse {
  totalMinutes: number;
}

export interface ProgressLogListItem {
  id: string;
  taskId: string;
  taskName: string;
  loggedDateYmd: string;
  timeSpentMinutes: number;
  trackerType: TrackerType;
  appliedTrackerMetadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface UpdateProgressLogPayload {
  timeSpentMinutes?: number;
  trackerMetadata?: Record<string, unknown>;
  loggedDateYmd?: string;
  timestamp?: string;
  dayStartIso?: string;
  dayEndIso?: string;
  clientTimezoneOffsetMinutes?: number;
}

@Injectable({ providedIn: 'root' })
export class ProgressLogsApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<ProgressLogListItem[]> {
    return this.http.get<ProgressLogListItem[]>('api/progress-logs', { withCredentials: true });
  }

  updateLog(taskId: string, logId: string, payload: UpdateProgressLogPayload): Observable<unknown> {
    return this.http.patch(`api/tasks/${taskId}/logs/${logId}`, payload, { withCredentials: true });
  }

  deleteLog(taskId: string, logId: string): Observable<void> {
    return this.http.delete<void>(`api/tasks/${taskId}/logs/${logId}`, { withCredentials: true });
  }

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
