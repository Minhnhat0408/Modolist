# Plan: Guest User Feature (localStorage-only)

## Decisions
- **Storage**: localStorage via Zustand persist (no DB user, no API calls for guest data)
- **Migration**: After signup, batch-import guest tasks to real account
- **Locked features**: AI tasks (show "Đăng ký để dùng" banner)
- **Allowed features**: Everything else (Spotify, Focus timer, Focus World, Stats from local data)
- **Expiry**: 30 days (client-side via createdAt in store)
- **No new backend endpoints needed** (except optionally a batch-task import endpoint)

---

## Architecture

### Guest detection
- Cookie `guestMode=1` (set when clicking "Continue as guest", read by middleware + server components)
- `useGuestStore().guestId` non-null (client-side signal)
- `useIsGuest()` hook: client-side returns `!!guestId`

### Data flow
- Guest tasks → `useGuestStore.tasks[]` in localStorage
- Guest focus log → `useGuestStore.focusLog[]`
- `dashboard/page.tsx` wraps task CRUD: if `isGuest` → guest store ops; else → API calls
- `useFocusStore` actions for guest: skip API session create/complete, call `guestStore.logFocusSession()` on complete
- `StatsModal`: if guest → compute stats from `guestStore`

---

## Phase 1 — Access & Guest Session *(no backend)*

1. **Create `useGuestStore.ts`** — Zustand + `persist` (key: `modolist-guest`)
   - State: `guestId` (UUID via `crypto.randomUUID()`), `createdAt`, `tasks[]`, `focusLog[]`
   - Methods: `addTask`, `updateTask`, `deleteTask`, `reorderTask`, `logFocusSession`, `isExpired()` (> 30 days)

2. **Create `useIsGuest()` hook** — reads cookie `guestMode=1` client-side

3. **Modify `proxy.ts`** — allow `/dashboard` if cookie `guestMode=1` is present (alongside NextAuth check)

4. **Modify `dashboard/layout.tsx`** — two guards:
   - If `guestMode` cookie present but **`localStorage['modolist-guest']` does not exist** → clear cookie, redirect `/auth/signin` *(prevents cookie/localStorage desync)*
   - If guest store `isExpired()` → clear store, clear cookie, redirect `/auth/signin`
   - Otherwise render `<GuestBanner>` + page normally

5. **Modify signin page** — add **"Dùng thử không cần đăng ký →"** button below form: sets cookie `guestMode=1`, initialises guest store with new UUID, redirects `/dashboard`

---

## Phase 2 — Data Abstraction Layer *(Repository / Facade Pattern)*

> ⚠️ **Anti-pattern to avoid**: Do NOT scatter `if (isGuest)` branches across UI components.
> All branching logic must be centralized — UI components stay oblivious to guest vs. real-user mode.

6. **Create `useTaskManager.ts`** — single facade hook used by all task UI:
   ```ts
   export function useTaskManager() {
     const isGuest = useIsGuest();
     const guestStore = useGuestStore();
     return {
       getTasks:    ()           => isGuest ? guestStore.tasks       : api.get('/tasks'),
       addTask:     (data)       => isGuest ? guestStore.addTask(data) : api.post('/tasks', data),
       updateTask:  (id, data)   => isGuest ? guestStore.updateTask(id, data) : api.patch(`/tasks/${id}`, data),
       deleteTask:  (id)         => isGuest ? guestStore.deleteTask(id) : api.delete(`/tasks/${id}`),
       reorderTask: (id, order, status) => isGuest ? guestStore.reorderTask(id, order, status) : api.patch(...),
     };
   }
   ```
   `dashboard/page.tsx` and `KanbanBoard` call only `useTaskManager()` — zero `isGuest` checks in UI.

7. **Create `useFocusLogger.ts`** — facade for session recording:
   - `isGuest` → `guestStore.logFocusSession(...)`, skip all `/focus-sessions` API calls
   - `!isGuest` → existing API flow unchanged
   Used by `useFocusStore` completion actions and `useSessionLifecycle`.

8. **Modify `StatsModal.tsx`** — read from `useStatsSource()` hook:
   - `isGuest` → aggregate from `guestStore.focusLog` + `guestStore.tasks`
   - `!isGuest` → existing `api.get('/focus-sessions/stats/dashboard')`

---

## Phase 3 — Guest UI

9. **Create `GuestBanner.tsx`** — sticky top bar:
    > `👤 Chế độ khách · Dữ liệu chỉ lưu trong trình duyệt này · Còn ${daysLeft} ngày · [Đăng ký để lưu vĩnh viễn →]`

10. **Modify `dashboard/layout.tsx`** — render `<GuestBanner>` if guest

11. **Modify `user-nav.tsx`** — guest: avatar "👤 Khách", menu has **[Đăng ký]** (prominent green CTA) + **[Đăng nhập]**; AI option disabled with tooltip "Cần đăng ký"

12. **Modify `TaskFormDialog.tsx`** — AI button disabled for guests with tooltip "Đăng ký để dùng AI"

---

## Phase 4 — Migration on Signup / Signin

> ⚠️ **Never loop `POST /tasks`** — performance disaster + risk of 429 rate-limit.
> A single `POST /tasks/batch` endpoint is **required**.

13. **Add `POST /tasks/batch` on NestJS API** (`tasks.controller.ts` + `tasks.service.ts`):
    - Body: `{ tasks: CreateTaskDto[] }`
    - Returns: `{ created: number }`
    - Protected by `JwtAuthGuard` like all other task routes

14. **Modify `signup/page.tsx`** — after successful registration (new account = empty, safe to auto-import):
    - Detect `localStorage["modolist-guest"]` with tasks
    - If found: auto sign-in → single `POST /tasks/batch` → show progress "Đang chuyển X tasks..." → clear guestStore → clear cookie

15. **Modify `signin/page.tsx`** — after successful login (existing account may already have data):
    - If guest data exists: show **MigrateModal**:
      > *"Chúng tôi tìm thấy 5 tasks bạn vừa tạo ẩn danh. Bạn có muốn gộp vào tài khoản hiện tại?"*
      > **[Gộp Data]** / **[Bỏ qua & Xóa]**
    - On confirm: `POST /tasks/batch` → clear guestStore → clear cookie
    - On skip: clear guestStore + cookie silently

---

## Key files

| File | Change |
|------|--------|
| `stores/useGuestStore.ts` | **NEW** |
| `hooks/useIsGuest.ts` | **NEW** |
| `hooks/useTaskManager.ts` | **NEW** — facade for all task CRUD |
| `hooks/useFocusLogger.ts` | **NEW** — facade for session recording |
| `hooks/useStatsSource.ts` | **NEW** — facade for stats data |
| `components/guest/GuestBanner.tsx` | **NEW** |
| `components/guest/MigrateModal.tsx` | **NEW** — shown on signin with existing account |
| `proxy.ts` | Allow `guestMode` cookie bypass |
| `app/dashboard/layout.tsx` | Skip auth redirect, render banner, cookie↔localStorage sync guard, expiry check |
| `app/dashboard/page.tsx` | Use `useTaskManager()` — remove direct API calls |
| `app/auth/signin/page.tsx` | "Dùng thử" button + MigrateModal trigger |
| `app/auth/signup/page.tsx` | Auto-import guest tasks via `POST /tasks/batch` |
| `stores/useFocusStore.ts` | Use `useFocusLogger` — no direct API calls in guest path |
| `hooks/useSessionLifecycle.ts` | No-op if guest |
| `components/stats/StatsModal.tsx` | Use `useStatsSource()` |
| `components/user-nav.tsx` | Guest avatar + Sign up CTA |
| `components/kanban/TaskFormDialog.tsx` | Lock AI button |
| `api/src/tasks/tasks.controller.ts` | Add `POST /tasks/batch` |
| `api/src/tasks/tasks.service.ts` | `createBatch(userId, tasks[])` |

---

## Open Questions / Considerations

1. **Focus World with guest** — WS gateway requires JWT. Options: (a) read-only spectate mode, (b) block entirely with signup CTA
2. **Batch import endpoint** — looping `POST /tasks` is simple but slow for many tasks; consider `POST /tasks/batch` on API side
3. **Spotify with guest** — OAuth callback expects a real session; consider blocking Spotify for guests entirely
4. **Guest ID uniqueness** — generate UUID via `crypto.randomUUID()` at guest store init
