import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Notifies the Tasks list (and similar) to reload the task tree after progress changes elsewhere (e.g. task detail). */
@Injectable({ providedIn: 'root' })
export class TaskTreeRefreshService {
  private readonly subject = new Subject<void>();
  readonly treeChanged$ = this.subject.asObservable();

  notifyProgressChanged(): void {
    this.subject.next();
  }
}
