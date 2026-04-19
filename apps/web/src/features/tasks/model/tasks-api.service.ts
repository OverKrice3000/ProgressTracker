import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TrackerType } from '@progress-tracker/contracts';
import { Observable } from 'rxjs';
import { TaskBase, TaskFilters, TaskTreeNode } from '../../../entities/task/model/task.types';

export interface CurrentTrackingSession {
  taskId: string;
  taskName: string;
  startTimeMs: number;
}

export interface StopTrackingResult {
  taskId: string;
  taskName: string;
  startTimeMs: number;
  stopTime: string;
  elapsedMinutes: number;
}

@Injectable({ providedIn: 'root' })
export class TasksApiService {
  private readonly http = inject(HttpClient);

  list(filters: TaskFilters): Observable<TaskBase[]> {
    let params = new HttpParams()
      .set('rootOnly', String(filters.rootOnly))
      .set('sortBy', filters.sortBy)
      .set('sortOrder', filters.sortOrder);

    if (filters.isCompleted !== undefined) {
      params = params.set('isCompleted', String(filters.isCompleted));
    }
    if (filters.trackerType) {
      params = params.set('trackerType', filters.trackerType);
    }

    return this.http.get<TaskBase[]>('api/tasks', { params, withCredentials: true });
  }

  getTask(taskId: string): Observable<TaskBase> {
    return this.http.get<TaskBase>(`api/tasks/${taskId}`, { withCredentials: true });
  }

  getChildren(taskId: string): Observable<TaskBase[]> {
    return this.http.get<TaskBase[]>(`api/tasks/${taskId}/children`, { withCredentials: true });
  }

  getRecentLeaves(filters: {
    isCompleted?: boolean;
    trackerType?: TrackerType;
    includeHidden?: boolean;
  }): Observable<TaskBase[]> {
    let params = new HttpParams();
    if (filters.isCompleted !== undefined) {
      params = params.set('isCompleted', String(filters.isCompleted));
    }
    if (filters.trackerType) {
      params = params.set('trackerType', filters.trackerType);
    }
    if (filters.includeHidden !== undefined) {
      params = params.set('includeHidden', String(filters.includeHidden));
    }
    return this.http.get<TaskBase[]>('api/tasks/recent-leaves', { params, withCredentials: true });
  }

  getTree(includeHidden = false): Observable<TaskTreeNode[]> {
    let params = new HttpParams();
    if (includeHidden) {
      params = params.set('includeHidden', 'true');
    }
    return this.http.get<TaskTreeNode[]>('api/tasks/tree', { params, withCredentials: true });
  }

  create(payload: Partial<TaskBase>): Observable<TaskBase> {
    return this.http.post<TaskBase>('api/tasks', payload, { withCredentials: true });
  }

  update(taskId: string, payload: { name: string; description: string }): Observable<TaskBase> {
    return this.http.patch<TaskBase>(`api/tasks/${taskId}`, payload, { withCredentials: true });
  }

  delete(taskId: string): Observable<{ archivedTaskIds: string[]; deletedTaskIds: string[] }> {
    return this.http.delete<{ archivedTaskIds: string[]; deletedTaskIds: string[] }>(`api/tasks/${taskId}`, {
      withCredentials: true,
    });
  }

  restore(taskId: string): Observable<TaskBase> {
    return this.http.patch<TaskBase>(`api/tasks/${taskId}/restore`, {}, { withCredentials: true });
  }

  addLog(taskId: string, payload: { timeSpentMinutes: number; trackerMetadata: Record<string, unknown> }) {
    return this.http.post(`api/tasks/${taskId}/logs`, payload, { withCredentials: true });
  }

  getCurrentTracking(): Observable<CurrentTrackingSession | null> {
    return this.http.get<CurrentTrackingSession | null>('api/tasks/tracking/current', {
      withCredentials: true,
    });
  }

  startTracking(payload: { taskId: string; startTimeMs: number; stopExisting?: boolean }): Observable<CurrentTrackingSession> {
    return this.http.post<CurrentTrackingSession>('api/tasks/tracking/start', payload, {
      withCredentials: true,
    });
  }

  stopTracking(): Observable<StopTrackingResult> {
    return this.http.post<StopTrackingResult>('api/tasks/tracking/stop', {}, { withCredentials: true });
  }
}
