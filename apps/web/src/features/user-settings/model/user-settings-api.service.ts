import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface UserSettings {
  idleHoursPerDay: number;
  language: string;
}

@Injectable({ providedIn: 'root' })
export class UserSettingsApiService {
  private readonly http = inject(HttpClient);

  getSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>('api/users/settings', { withCredentials: true });
  }

  updateSettings(patch: Partial<UserSettings>): Observable<UserSettings> {
    return this.http.patch<UserSettings>('api/users/settings', patch, { withCredentials: true });
  }
}
