import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { showAddProgressOnListRow } from '../../../entities/task/lib/task-progress-helpers';
import { TaskTreeNode } from '../../../entities/task/model/task.types';
import { TaskActionsMenuComponent } from '../../../entities/task/ui/task-actions-menu.component';
import { TaskAvatarComponent } from '../../../entities/task/ui/task-avatar.component';
import { TaskStatusBadgeComponent } from '../../../entities/task/ui/task-status-badge.component';
import { TrackerTypeLabelPipe } from '../../../entities/task/ui/tracker-type-label.pipe';
import { TaskNameSegmentsPipe } from '../../../shared/pipes/task-name-segments.pipe';

@Component({
  selector: 'app-task-hierarchy-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TaskActionsMenuComponent,
    TaskAvatarComponent,
    TaskStatusBadgeComponent,
    TaskNameSegmentsPipe,
    TrackerTypeLabelPipe,
  ],
  template: `
    <ul
      class="flex flex-col gap-2 border-l border-transparent"
      [class.ml-6]="depth > 0"
      role="group"
    >
      <li *ngFor="let node of nodes" class="flex flex-col gap-2" role="treeitem" [attr.aria-expanded]="ariaExpanded(node)">
        <div
          class="grid grid-cols-[auto,auto,1fr,auto,auto] items-center gap-2 rounded-xl bg-white p-3 shadow-sm"
          [class.opacity-60]="node.isHidden"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center">
            <button
              *ngIf="isExpandableFolder(node)"
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
              [attr.aria-expanded]="isExpanded(node.id)"
              [attr.aria-label]="isExpanded(node.id) ? 'Collapse folder' : 'Expand folder'"
              (click)="onChevronClick($event, node.id)"
            >
              <svg
                class="h-5 w-5 transition-transform duration-150"
                [class.rotate-90]="isExpanded(node.id)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <app-task-avatar class="shrink-0" [avatarUrl]="node.avatarUrl" [taskName]="node.name" />

          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <a
                [routerLink]="['/task', node.id]"
                class="line-clamp-1 text-sm font-semibold text-slate-900"
                (click)="$event.stopPropagation()"
              >
                <span *ngFor="let s of (node.name | taskNameSegments:searchQuery)">
                  <span [class]="s.match ? 'rounded-sm bg-sky-100/90' : null">{{ s.text }}</span>
                </span>
              </a>
              <span
                *ngIf="node.isHidden"
                class="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
              >
                Archived
              </span>
              <span
                *ngIf="activeTrackingTaskId === node.id"
                class="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
              >
                Tracking
              </span>
            </div>
            <p class="truncate text-xs text-slate-500">
              {{ node.trackerType | trackerTypeLabel }}
            </p>
          </div>

          <div class="flex min-h-8 items-center justify-end gap-2">
            <app-task-status-badge *ngIf="node.trackerType !== trackerType.SUBTASK" [isCompleted]="node.isCompleted" />
          </div>

          <div class="self-center justify-self-end">
            <app-task-actions-menu
              [canLogProgress]="canLogProgress(node)"
              [showEditOption]="!node.isHidden"
              [showLogProgressOption]="!node.isHidden && node.trackerType !== trackerType.SUBTASK && !node.isCompleted"
              [showTrackingOption]="!node.isHidden && node.trackerType !== trackerType.SUBTASK && !node.isCompleted"
              [isTrackingActive]="activeTrackingTaskId === node.id"
              [showDeleteOption]="!node.isHidden"
              [showRestoreOption]="node.isHidden"
              (editTask)="editTask.emit(node)"
              (logProgress)="logProgress.emit(node)"
              (toggleTracking)="toggleTracking.emit(node)"
              (deleteTask)="deleteTask.emit(node)"
              (restoreTask)="restoreTask.emit(node)"
            />
          </div>
        </div>

        <app-task-hierarchy-view
          *ngIf="shouldShowChildren(node)"
          [nodes]="node.children"
          [searchQuery]="searchQuery"
          [expandedFolderIds]="expandedFolderIds"
          [depth]="depth + 1"
          [activeTrackingTaskId]="activeTrackingTaskId"
          (folderExpandToggle)="folderExpandToggle.emit($event)"
          (editTask)="editTask.emit($event)"
          (logProgress)="logProgress.emit($event)"
          (toggleTracking)="toggleTracking.emit($event)"
          (deleteTask)="deleteTask.emit($event)"
          (restoreTask)="restoreTask.emit($event)"
        />
      </li>
    </ul>
  `,
})
export class TaskHierarchyViewComponent {
  readonly trackerType = TrackerType;

  @Input({ required: true }) nodes: TaskTreeNode[] = [];
  @Input() searchQuery = '';
  @Input() depth = 0;
  @Input() activeTrackingTaskId: string | null = null;
  /** IDs of folders that are expanded; set by the parent (Tasks or Task detail), shared at every nesting level. */
  @Input({ required: true }) expandedFolderIds!: Set<string>;

  @Output() folderExpandToggle = new EventEmitter<string>();
  @Output() editTask = new EventEmitter<TaskTreeNode>();
  @Output() logProgress = new EventEmitter<TaskTreeNode>();
  @Output() toggleTracking = new EventEmitter<TaskTreeNode>();
  @Output() deleteTask = new EventEmitter<TaskTreeNode>();
  @Output() restoreTask = new EventEmitter<TaskTreeNode>();

  isExpanded(id: string): boolean {
    return this.expandedFolderIds.has(id);
  }

  /** Folder (SUBTASK) rows that have children can expand/collapse. */
  isExpandableFolder(node: TaskTreeNode): boolean {
    return node.trackerType === TrackerType.SUBTASK && node.children.length > 0;
  }

  ariaExpanded(node: TaskTreeNode): boolean | null {
    if (!this.isExpandableFolder(node)) {
      return null;
    }
    return this.isExpanded(node.id);
  }

  /** Folders (SUBTASK) hide children until expanded; other parents with children stay visible (edge case). */
  shouldShowChildren(node: TaskTreeNode): boolean {
    if (node.children.length === 0) {
      return false;
    }
    if (!this.isExpandableFolder(node)) {
      return true;
    }
    return this.isExpanded(node.id);
  }

  onChevronClick(event: MouseEvent, taskId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.folderExpandToggle.emit(taskId);
  }

  canLogProgress(node: TaskTreeNode): boolean {
    return showAddProgressOnListRow(node);
  }
}
