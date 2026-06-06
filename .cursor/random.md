# Random Task Feature — Requirements

## Summary

Users can navigate to a randomly selected task with one click. The feature is available on the **Tasks page** (root-level pool) and on every **task detail page** (children pool).

---

## Where the button appears

| Context | Pool |
|---|---|
| Tasks page (`/tasks`) | All root tasks (depth 0) |
| Task detail page (`/task/:id`) | Children of the current task |

The button is hidden when the pool (after filtering, see below) is empty.

---

## Selection modes

Two modes are available via a compact inline mode selector next to / inside the button:

| Mode | Label (proposed) | Description |
|---|---|---|
| **Immediate** | "Direct child" | Pick uniformly at random from the pool described in the table above (root tasks or immediate children). |
| **Leaf** | "Leaf task" | Pick uniformly at random from all non-folder (non-SUBTASK) leaf descendants reachable from the current scope. On the Tasks page this means any non-SUBTASK leaf in the entire tree; on a task detail page, any non-SUBTASK leaf within that subtree. |

---

## UI design (proposed)

A single compact control in the page action area (next to "Create task" on Tasks page; next to the other action buttons on task detail):

```
[ 🎲 Random  ▾ ]
```

Clicking the **left part** navigates immediately using the last-selected mode (default: Immediate).

Clicking the **▾ chevron** opens a small dropdown:
```
● Direct child
○ Leaf task
```
Selecting an option both changes the active mode and immediately triggers a random pick.

Alternatively (simpler, no split button complexity): two small `outline-grayscale` / `s`-size buttons:

```
[ 🎲 Random child ]   [ 🎲 Random leaf ]
```

Both are hidden together when the pool is empty; the "Random leaf" button is additionally hidden when there are no leaf descendants (e.g. all children are folders with no further children).

> **Decision needed (open question #3):** split-button vs two separate buttons — see open questions below.

---

## Task pool / filtering

### Tasks page
- Pool is always drawn from **all root tasks in the full tree**, independent of the completion / tracker-type filters or the Show Archived toggle.

### Task detail page
- Pool is always the unfiltered children / leaf descendants of the current task.

---

## Eligibility rules

A task is **eligible** for the random pool if:
- It is **active** (`isHidden === false` **and** `isCompleted === false`)
- For "Immediate" mode: it is a direct child (or root task on Tasks page)
- For "Leaf" mode: it has no children of its own and `trackerType !== SUBTASK`

---

## Mode persistence

Mode selection (child vs leaf) is **not** persisted; always defaults to "Immediate child" on each page visit.

---

## Implementation sketch (Angular/NestJS)

### Frontend only (no new API needed)
- The tree is already loaded in both pages (`tree` / `subtaskTree` signals).
- A pure helper function `pickRandom(pool: T[]): T | null` is sufficient.

### Files to touch
- `apps/web/src/pages/tasks/tasks.page.ts` — add two buttons + logic
- `apps/web/src/pages/task-detail/task-detail.page.ts` — add two buttons + logic
- `apps/web/src/shared/lib/random-task.ts` (new) — pure helpers: `collectImmediatePool`, `collectLeafPool`, `pickRandom`

---

## Decisions (resolved)

| Question | Answer |
|---|---|
| Archived / completed tasks in pool? | Active only (exclude both archived and completed) |
| Tasks page filters narrow pool? | No — always draw from full tree regardless of visible filters |
| UI: two buttons or split-button? | Two separate buttons: **Random child** and **Random leaf** |
| Persist mode? | No — always defaults to "child" |
| Leaf pool on Tasks page? | All leaf tasks in the entire tree (not filtered by visible roots) |
