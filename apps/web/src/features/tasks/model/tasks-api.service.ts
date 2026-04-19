import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TrackerType } from '@progress-tracker/contracts';
import { Observable } from 'rxjs';
import { TaskBase, TaskFilters, TaskTreeNode } from '../../../entities/task/model/task.types';

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

  getRecentLeaves(filters: { isCompleted?: boolean; trackerType?: TrackerType }): Observable<TaskBase[]> {
    let params = new HttpParams();
    if (filters.isCompleted !== undefined) {
      params = params.set('isCompleted', String(filters.isCompleted));
    }
    if (filters.trackerType) {
      params = params.set('trackerType', filters.trackerType);
    }
    return this.http.get<TaskBase[]>('api/tasks/recent-leaves', { params, withCredentials: true });
  }

  getTree(): Observable<TaskTreeNode[]> {
    return this.http.get<TaskTreeNode[]>('api/tasks/tree', { withCredentials: true });
  }

  create(payload: Partial<TaskBase>): Observable<TaskBase> {
    return this.http.post<TaskBase>('api/tasks', payload, { withCredentials: true });
  }

  addLog(taskId: string, payload: { timeSpentMinutes: number; trackerMetadata: Record<string, unknown> }) {
    return this.http.post(`api/tasks/${taskId}/logs`, payload, { withCredentials: true });
  }
}
