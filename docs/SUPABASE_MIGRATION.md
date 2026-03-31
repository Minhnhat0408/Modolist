# Supabase Architecture Guide

> Stack hiện tại: **Next.js (Vercel) + Supabase (DB + Auth + Realtime)**

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Setup Supabase từ đầu](#2-setup-supabase-từ-đầu)
3. [Database Schema](#3-database-schema)
4. [lib/supabase — từng file](#4-libsupabase--từng-file)
5. [lib/services — từng file](#5-libservices--từng-file)
6. [Flow gọi API — từng bước](#6-flow-gọi-api--từng-bước)
7. [Authentication Flow](#7-authentication-flow)
8. [Realtime Flow (Focus World)](#8-realtime-flow-focus-world)
9. [AI Service (Gemini SDK)](#9-ai-service-gemini-sdk)
10. [Cron Jobs (pg_cron)](#10-cron-jobs-pg_cron)
11. [Deploy lên Vercel](#11-deploy-lên-vercel)
12. [Environment Variables](#12-environment-variables)

---

## 1. Tổng quan kiến trúc

```
Browser
  │
  │  HTTP / WebSocket
  ▼
┌──────────────────────────────────────────┐
│            Next.js on Vercel             │
│                                          │
│  src/proxy.ts (middleware)               │  ← chạy trước MỌI request
│    └─ lib/supabase/middleware.ts         │  ← refresh session cookie
│                                          │
│  src/app/                                │
│    ├─ (pages)  — React Server Components │  ← render HTML
│    └─ api/     — Route Handlers          │  ← REST API (serverless fn)
│                                          │
│  Browser code ("use client")             │
│    ├─ lib/supabase/client.ts             │  ← browser Supabase client
│    ├─ lib/api-client.ts                  │  ← fetch wrapper với JWT
│    └─ hooks/useFocusWorld.ts             │  ← WebSocket (Realtime)
└──────────────────────────────────────────┘
  │                          │
  │  PostgreSQL / REST        │  WebSocket
  ▼                          ▼
┌────────────────────────────────────────┐
│               Supabase                 │
│  PostgreSQL + pgvector + pg_cron       │
│  Auth (JWT, Google OAuth)              │
│  Realtime (Presence + Broadcast)       │
└────────────────────────────────────────┘
  │
  │  Gemini API calls (từ API Routes)
  ▼
Google Gemini API
```

---

## 2. Setup Supabase từ đầu

### Bước 1 — Tạo project trên Supabase Dashboard

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Đặt tên, chọn region `ap-southeast-1` (Singapore — gần nhất cho VN)
3. Đặt **Database Password** (lưu lại, dùng khi connect trực tiếp)
4. Chờ project khởi động (~1 phút)

### Bước 2 — Lấy API keys

Vào **Project Settings → API**:

| Key | Dùng cho | Đặt vào |
|-----|----------|---------|
| `Project URL` | `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` |
| `anon / publishable` key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `.env.local` |
| `service_role` secret key | `SUPABASE_SECRET_KEY` | `.env.local` (KHÔNG commit) |

> **service_role key** bypass toàn bộ RLS — chỉ dùng server-side, không bao giờ expose ra browser.

### Bước 3 — Enable extensions

Vào **Database → Extensions**, enable:
- `vector` (pgvector) — dùng cho AI RAG embeddings
- `pg_cron` — dùng cho scheduled jobs

### Bước 4 — Cài Supabase CLI và push schema

```bash
# Cài CLI
brew install supabase/tap/supabase

# Đăng nhập
supabase login

# Link project (lấy project-ref từ URL dashboard)
supabase link --project-ref <project-ref>

# Push toàn bộ migration lên cloud
supabase db push
```

Lệnh `db push` chạy file `supabase/migrations/00001_initial_schema.sql` — tạo toàn bộ tables, RLS policies, triggers, và RPC functions.

### Bước 5 — Setup Google OAuth

**Trên Google Cloud Console:**
1. Vào [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. **Create Credentials → OAuth 2.0 Client ID** → Web application
3. Thêm **Authorized redirect URI**:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
4. Lưu lại **Client ID** và **Client Secret**

**Trên Supabase Dashboard:**
1. Vào **Authentication → Providers → Google**
2. Enable, paste Client ID và Client Secret vào
3. Lưu

### Bước 6 — Cấu hình Auth URLs

Vào **Authentication → URL Configuration**:

| Field | Value (local) | Value (production) |
|-------|--------------|-------------------|
| Site URL | `http://localhost:3000` | `https://modolist.vercel.app` |
| Redirect URLs | `http://localhost:3000/**` | `https://modolist.vercel.app/**` |

> Supabase kiểm tra `redirectTo` URL phải nằm trong whitelist này. Nếu không match → redirect về Site URL (thường là localhost).

### Bước 7 — Tạo `.env.local`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx   # service_role key

# Google Gemini AI
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-preview-04-17

# Spotify (optional)
SPOTIFY_CLIENT_ID=xxx
SPOTIFY_CLIENT_SECRET=xxx
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Bước 8 — Chạy local

```bash
pnpm install
pnpm dev
```

---

## 3. Database Schema

File: `supabase/migrations/00001_initial_schema.sql`

### Tables

| Table | Mô tả |
|-------|-------|
| `users` | Profile người dùng, sync từ `auth.users` qua trigger |
| `tasks` | Công việc (BACKLOG/TODAY/DONE), có `embedding vector(3072)` cho RAG |
| `focus_sessions` | Phiên tập trung (IN_PROGRESS/PAUSED/COMPLETED/INTERRUPTED) |
| `daily_stats` | Thống kê hàng ngày (focus time, pomodoros, completed tasks) |
| `ai_interactions` | Log các lần gọi AI |
| `spotify_accounts` | OAuth tokens cho Spotify integration |

### RPC Functions (gọi qua `supabase.rpc()`)

| Function | Mục đích |
|----------|----------|
| `increment_task_order(p_user_id, p_status)` | Dịch order +1 để chèn task mới lên đầu |
| `increment_task_pomodoros(p_task_id)` | +1 pomodoro khi complete session |
| `increment_user_focus_time(p_user_id, p_duration)` | Cộng focus time vào user profile |
| `upsert_daily_stats_on_complete(p_user_id, p_date, p_duration)` | Upsert daily stats khi complete |
| `search_similar_tasks(query_embedding, match_threshold, match_count, p_user_id)` | Tìm tasks tương tự qua cosine similarity |

### Triggers

- `on_auth_user_created` / `on_auth_user_updated` — sync `auth.users` → `users` khi đăng ký/cập nhật
- `trg_*_updated_at` — tự set `updatedAt = now()` trên mỗi UPDATE

### Row Level Security (RLS)

Mọi table đều bật RLS. Policy mặc định:
```sql
-- User chỉ đọc/ghi được data của mình
USING (userId = auth.uid()::text)
```

---

## 4. lib/supabase — từng file

```
src/lib/supabase/
├── client.ts       ← Browser client
├── server.ts       ← Server client + service client
├── middleware.ts   ← Session refresh logic
├── auth-helper.ts  ← Auth guard cho API Routes
└── types.ts        ← TypeScript interfaces cho database rows
```

### `client.ts` — Browser Supabase client

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );
}
```

- Dùng `@supabase/ssr`'s `createBrowserClient` — tự đọc/ghi session từ browser cookies
- **Chỉ dùng trong `"use client"` components và custom hooks**
- Dùng publishable key (an toàn expose ra browser)

Ví dụ dùng:
```typescript
// Trong hook hoặc client component
const supabase = createClient();
const { data } = await supabase.from("tasks").select("*");
```

### `server.ts` — Server Supabase clients

Có 2 loại client:

**`createClient()` — cookie-based, respects RLS:**
```typescript
export async function createClient() {
  const cookieStore = await cookies(); // next/headers
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    },
  );
}
```
- `async` vì `cookies()` từ `next/headers` là async trong Next.js 15+
- Đọc JWT từ cookie → Supabase biết user là ai → RLS policy `auth.uid()` hoạt động đúng
- **Dùng trong: API Routes, Server Components, Server Actions**

**`createServiceClient()` — service role, bypass RLS:**
```typescript
export function createServiceClient() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,  // service_role key
  );
}
```
- Dùng `service_role` key → có quyền đọc/ghi mọi row bất kể RLS
- **Dùng cho: Spotify token storage, admin operations cần bypass RLS**
- KHÔNG BAO GIỜ dùng trên browser

### `middleware.ts` — Session refresh

```typescript
export async function updateSession(request: NextRequest) {
  // Tạo Supabase client đọc cookies từ request
  const supabase = createServerClient(..., { cookies: { ... } });

  // Refresh session — quan trọng để Server Components luôn có session mới nhất
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect logic
  if (/auth page/ && user)      → redirect /dashboard
  if (/dashboard/ && !user && !guest) → redirect /auth/signin

  return supabaseResponse; // response có updated cookies
}
```

- Được gọi bởi `src/proxy.ts` (Next.js middleware) cho MỌI request
- Nhiệm vụ: refresh JWT token trước khi request đến handler → Server Components luôn đọc được session fresh
- Nếu không có file này, Server Components đọc session sẽ bị stale sau khi token hết hạn

### `auth-helper.ts` — Auth guard cho API Routes

```typescript
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, supabase, error: null };
}
```

- Gọi `supabase.auth.getUser()` — verify JWT với Supabase server (không chỉ decode local)
- Trả về `{ user, supabase, error }` — pattern destructuring tiện dùng trong mọi API route
- Khi `error !== null` → return ngay, không cần if/else
- `supabase` trả về đã biết user → mọi query sau đó tự RLS đúng

### `types.ts` — TypeScript interfaces

Định nghĩa types tương ứng với database schema:

```typescript
export type TaskStatus = "BACKLOG" | "TODAY" | "DONE";
export type FocusSessionStatus = "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "INTERRUPTED";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  userId: string;
  order: number;
  // ... (khớp với columns trong Supabase table)
}

export interface CreateTaskInput {
  title: string;
  status?: TaskStatus;
  // ... (chỉ fields cần thiết khi tạo mới)
}
```

- Thay thế Prisma-generated types
- Phải tự cập nhật thủ công khi thay đổi schema (không auto-generate)

---

## 5. lib/services — từng file

```
src/lib/services/
├── tasks.service.ts          ← ~550 dòng, toàn bộ CRUD + recurrence logic
├── focus-sessions.service.ts ← ~500 dòng, session lifecycle
└── ai.service.ts             ← Gemini SDK, embeddings, RAG
```

**Design principle:** Mọi function nhận `supabase: SupabaseClient` làm tham số đầu tiên — không dùng global client, dễ test và tái sử dụng.

### `tasks.service.ts`

Các function chính:

| Function | Mô tả |
|----------|-------|
| `findAllTasks(supabase, userId, includeArchived?)` | SELECT tất cả tasks kèm focus sessions |
| `createTask(supabase, userId, input)` | INSERT task, tự increment order |
| `updateTask(supabase, id, userId, input)` | UPDATE task, xử lý recurrence khi DONE |
| `deleteTask(supabase, id, userId)` | DELETE task |
| `reorderTask(supabase, id, userId, newOrder)` | Reorder: cập nhật order toàn bộ task list |
| `archiveTask(supabase, id, userId)` | Set `isArchived = true` |
| `duplicateTask(supabase, id, userId)` | Tạo bản sao task |
| `createBatchTasks(supabase, userId, tasks[])` | INSERT nhiều tasks cùng lúc |

**Recurrence logic** — khi update task sang `DONE`:
```
1. Nếu task có recurrence !== "NONE":
   a. Tính nextDueDate dựa trên rule (DAILY/WEEKDAY/WEEKLY/MONTHLY)
   b. Tạo task mới với status = "TODAY", dueDate = nextDueDate
   c. Task gốc vẫn DONE (không xóa)
```

Dùng `supabase.rpc("increment_task_order", ...)` để dịch order của các tasks khác trước khi insert task mới vào đầu danh sách.

### `focus-sessions.service.ts`

| Function | Mô tả |
|----------|-------|
| `startSession(supabase, userId, taskId, plannedDuration)` | INSERT session IN_PROGRESS |
| `completeSession(supabase, sessionId, userId, actualDuration)` | UPDATE COMPLETED + side effects |
| `pauseSession(supabase, sessionId, userId, elapsedTime)` | UPDATE PAUSED |
| `resumeSession(supabase, sessionId, userId)` | UPDATE IN_PROGRESS |
| `getDashboardStats(supabase, userId)` | Tổng hợp stats: today/week/heatmap |

**`completeSession` side effects** (tất cả chạy song song sau khi UPDATE):
```typescript
await supabase.rpc("increment_task_pomodoros", { p_task_id });
await supabase.rpc("increment_user_focus_time", { p_user_id, p_duration });
await supabase.rpc("upsert_daily_stats_on_complete", { p_user_id, p_date, p_duration });
```

**`getDashboardStats`** — aggregate data cho trang stats:
- Today stats: `daily_stats` where date = today
- Last 7 days: `daily_stats` last 7 rows
- Weekly heatmap: `daily_stats` last 182 days
- Totals: COUNT focus_sessions, COUNT completed tasks

### `ai.service.ts`

| Function | Mô tả |
|----------|-------|
| `generateTasks(goal, context?)` | Gemini → sinh danh sách task từ goal text |
| `estimateTime(taskTitle, similarTasks[])` | Gemini → ước lượng pomodoros |
| `storeEmbedding(supabase, taskId, text)` | Gemini embedding → lưu vào `tasks.embedding` |
| `findSimilarTasks(supabase, userId, queryText)` | pgvector cosine search qua `search_similar_tasks` RPC |
| `blendEstimates(aiEstimate, ragEstimates[])` | Kết hợp AI estimate với historical data |

---

## 6. Flow gọi API — từng bước

Lấy ví dụ: **Frontend gọi `GET /api/tasks`** để lấy danh sách tasks.

### Bước 1 — Frontend gửi request (`lib/api-client.ts`)

```typescript
// src/lib/api-client.ts
async function getToken(): Promise<string | null> {
  const supabase = createClient();                         // browser client
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;                    // JWT token
}

async function request<T>(endpoint: string, method: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`/api${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },        // gắn JWT vào header
  });
  return res.json();
}

export const apiClient = {
  tasks: {
    getAll: () => request<Task[]>("/tasks", "GET"),
  }
};
```

Frontend không gửi cookie manually — JWT được lấy từ Supabase session và gắn vào `Authorization: Bearer`.

### Bước 2 — Request đi qua Middleware (`src/proxy.ts`)

```typescript
// src/proxy.ts
export default async function middleware(request: NextRequest) {
  return await updateSession(request);   // lib/supabase/middleware.ts
}
```

`updateSession` làm 3 việc:
1. Đọc session cookie từ request
2. Gọi `supabase.auth.getUser()` để refresh token nếu sắp hết hạn
3. Ghi updated cookies vào response
4. Kiểm tra redirect rules (auth pages, dashboard protection)

Sau bước này, cookies trong request đã được refresh.

### Bước 3 — Route Handler nhận request (`src/app/api/tasks/route.ts`)

```typescript
export async function GET(request: Request) {
  // 1. Authenticate
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;   // trả 401 nếu chưa đăng nhập

  // 2. Parse query params
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  // 3. Gọi service
  const tasks = await findAllTasks(supabase, user!.id, includeArchived);

  // 4. Trả về JSON
  return NextResponse.json(tasks);
}
```

### Bước 4 — `getAuthenticatedUser()` verify token (`lib/supabase/auth-helper.ts`)

```typescript
export async function getAuthenticatedUser() {
  const supabase = await createClient();               // server client (đọc cookies)
  const { data: { user }, error } = await supabase.auth.getUser();
  // getUser() verify JWT với Supabase Auth server — không chỉ decode local
  if (error || !user) return { user: null, error: NextResponse(401) };
  return { user, supabase, error: null };
}
```

> Tại sao dùng `getUser()` thay vì `getSession()`? `getSession()` chỉ decode JWT locally (không verify với server). `getUser()` gọi lên Supabase Auth để verify — đảm bảo token không bị revoke.

### Bước 5 — Service query database (`lib/services/tasks.service.ts`)

```typescript
export async function findAllTasks(
  supabase: SupabaseClient,
  userId: string,
  includeArchived = false,
) {
  let query = supabase
    .from("tasks")
    .select(`
      *,
      focusSessions:focus_sessions(
        id, status, duration, startedAt, endedAt, plannedDuration
      )
    `)
    .eq("userId", userId)
    .order("order", { ascending: true });

  if (!includeArchived) {
    query = query.eq("isArchived", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
```

- Query chỉ trả data của `userId` đã verify ở bước 4
- RLS cũng enforce lần nữa ở cấp PostgreSQL (`auth.uid()::text = userId`)
- Có nested select để join `focus_sessions` trong 1 query

### Bước 6 — Response trả về

```
Supabase PostgreSQL
  → tasks.service.ts (data[])
  → route handler (NextResponse.json)
  → browser (JSON array)
  → React component re-render
```

### Sơ đồ tổng quan

```
Browser
  └─ api-client.ts
       └─ fetch("/api/tasks", { Authorization: "Bearer <JWT>" })
            │
            ▼
       src/proxy.ts (middleware)
            └─ updateSession() — refresh cookies nếu cần
            │
            ▼
       src/app/api/tasks/route.ts (GET handler)
            └─ getAuthenticatedUser()
                 └─ createClient() từ server.ts — đọc cookies
                 └─ supabase.auth.getUser() — verify JWT
            └─ findAllTasks(supabase, user.id)
                 └─ supabase.from("tasks").select(...)
                      └─ Supabase PostgreSQL (+ RLS check)
            └─ NextResponse.json(tasks)
```

---

## 7. Authentication Flow

### Files liên quan

| File | Loại | Vai trò |
|------|------|---------|
| `src/lib/auth.ts` | Client-only | `signInWithGoogle()` dùng trong browser |
| `src/lib/auth-server.ts` | Server-only | `getServerSession()` dùng trong Server Components |
| `src/app/auth/signin/actions.ts` | Server Action | Form submit handler cho sign-in page |
| `src/app/auth/callback/route.ts` | API Route | Nhận OAuth code, exchange lấy session |
| `src/proxy.ts` | Middleware | Protect routes, refresh session |
| `src/hooks/useSupabaseSession.ts` | Client Hook | Reactive session state cho components |

### Flow Google OAuth

```
1. User click nút "Đăng nhập Google"
      ↓
2. actions.ts: authenticateWithGoogle()
   - Đọc host từ x-forwarded-host header (để có đúng domain production/local)
   - supabase.auth.signInWithOAuth({
       provider: "google",
       redirectTo: "https://modolist.vercel.app/auth/callback"
     })
   - Supabase trả về URL redirect đến Google
      ↓
3. redirect(data.url) → Browser nhảy sang Google OAuth
      ↓
4. User đồng ý cấp quyền trên Google
      ↓
5. Google redirect về:
   https://<project>.supabase.co/auth/v1/callback?code=xxx
      ↓
6. Supabase xử lý code, redirect tiếp về:
   https://modolist.vercel.app/auth/callback?code=xxx
      ↓
7. src/app/auth/callback/route.ts:
   supabase.auth.exchangeCodeForSession(code)
   → Supabase trả về JWT + refresh token
   → Lưu vào cookies
   → redirect("/dashboard")
      ↓
8. Database trigger on_auth_user_created chạy:
   INSERT INTO users (id, email, name, image)
   SELECT id, email, raw_user_meta_data->>'name', ...
   FROM auth.users WHERE id = NEW.id
      ↓
9. Mọi request về sau: proxy.ts gọi updateSession()
   → refresh JWT tự động khi gần hết hạn
```

### Flow Email/Password

```
1. Form submit → authenticate() Server Action
      ↓
2. supabase.auth.signInWithPassword({ email, password })
      ↓
3. Supabase verify password hash trong auth.users
      ↓
4. Trả JWT + refresh token → lưu vào cookies
      ↓
5. redirect("/dashboard")
```

### `getServerSession()` vs `getAuthenticatedUser()`

| | `getServerSession()` | `getAuthenticatedUser()` |
|--|---------------------|------------------------|
| File | `lib/auth-server.ts` | `lib/supabase/auth-helper.ts` |
| Dùng cho | Server Components, Server Actions | API Route Handlers |
| Trả về | `user \| null` | `{ user, supabase, error }` |
| Khi không có session | trả `null` | trả `{ error: NextResponse(401) }` |

```typescript
// Server Component
import { getServerSession } from "@/lib/auth-server";
const user = await getServerSession();
if (!user) redirect("/auth/signin");

// API Route
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
const { user, supabase, error } = await getAuthenticatedUser();
if (error) return error;
```

---

## 8. Realtime Flow (Focus World)

Focus World cho phép nhiều user thấy nhau đang focus trong cùng 1 "phòng" realtime.

### Files liên quan

| File | Vai trò |
|------|---------|
| `src/lib/focusWorldSocket.ts` | Singleton giữ reference đến `RealtimeChannel` |
| `src/hooks/useFocusWorld.ts` | Hook main — connect, track presence, receive broadcasts |
| `src/components/focus/SpotifyWidget.tsx` | Gửi Spotify broadcast events |

### Kiến trúc Realtime

Supabase Realtime có 2 tính năng dùng trong Focus World:

**1. Presence** — biết ai đang online và trạng thái của họ:
```
Client A track({ userId, isPaused: false, ... })
Client B track({ userId, isPaused: true, ... })

Khi bất kỳ ai track/untrack → "sync" event → mọi client nhận được presenceState() mới
```

**2. Broadcast** — gửi event tùy ý từ client này đến client khác (không qua database):
```
Client A (DJ): channel.send({ type: "broadcast", event: "spotify:dj_update", payload: { track } })
→ Tất cả client đang subscribe nhận được event ngay lập tức
```

### Flow connect

```
1. User bắt đầu focus session
      ↓
2. useFocusWorld({ userId, sessionId, enabled: true }) được mount
      ↓
3. connect() được gọi:
   a. createClient() — browser Supabase client
   b. supabase.channel("focus-world", { config: { presence: { key: userId } } })
   c. Đăng ký listeners:
      - channel.on("presence", { event: "sync" }, ...)    ← danh sách users thay đổi
      - channel.on("presence", { event: "join" }, ...)    ← user mới vào
      - channel.on("presence", { event: "leave" }, ...)   ← user rời
      - channel.on("broadcast", { event: "spotify:dj_update" }, ...)
      - channel.on("broadcast", { event: "spotify:dj_claim" }, ...)
      - ... các spotify broadcast events khác
   d. channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId, sessionId, taskId,
            name: userName, image: userImage,
            isPaused: false,
            isListeningToDj: false,
            focusProps: { startTime, duration }
          });
        }
      })
      ↓
4. focusWorldSocket.set(channel) — lưu singleton để SpotifyWidget access được
      ↓
5. isConnected = true → UI hiển thị focus users
```

### Flow Presence sync

```
User A vào focus:
  channel.track({ userId: "A", isPaused: false, ... })
        ↓
  Supabase Realtime server nhận, broadcast "sync" event đến mọi subscriber
        ↓
  User B nhận "sync" event:
    const state = channel.presenceState()
    // { "A": [{ userId: "A", isPaused: false, ... }], "B": [{ userId: "B", ... }] }
    setFocusUsers(Object.values(state).flatMap(...))
        ↓
  UI User B hiển thị avatar của User A

User A pause:
  channel.track({ userId: "A", isPaused: true })  ← update presence, không phải track mới
        ↓
  "sync" event → User B thấy User A đổi sang paused state
```

### Flow Spotify DJ broadcast

```
User A (là DJ) đổi bài:
  1. SpotifyWidget.tsx lấy channel từ focusWorldSocket.get()
  2. channel.send({
       type: "broadcast",
       event: "spotify:dj_update",
       payload: { trackUri, trackName, artistName, albumArt, positionMs, isPlaying }
     })
        ↓
  Supabase Realtime forward đến tất cả subscriber (không lưu DB)
        ↓
  User B (đang listen-along) nhận:
    channel.on("broadcast", { event: "spotify:dj_update" }, ({ payload }) => {
      useSpotifyStore.getState().setDjState(payload);
      // → SpotifyPlayer tự seek đến positionMs, play bài track mới
    })
```

### Disconnect

```
User kết thúc session hoặc unmount component:
  disconnect() được gọi:
    supabase.removeChannel(channelRef.current)  ← Supabase tự gửi "leave" presence event
    channelRef.current = null
    focusWorldSocket.set(null)
    setIsConnected(false)
```

### Sơ đồ tổng quan

```
Browser User A                Supabase Realtime              Browser User B
    │                              │                               │
    │ channel.track(stateA)        │                               │
    │──────────────────────────────▶                               │
    │                              │ sync event (A joined)         │
    │                              │──────────────────────────────▶│
    │                              │                               │ setFocusUsers([A,B])
    │                              │                               │
    │ channel.send(broadcast)      │                               │
    │──────────────────────────────▶                               │
    │                              │ broadcast event               │
    │                              │──────────────────────────────▶│
    │                              │                               │ handle event
```

---

## 9. AI Service (Gemini SDK)

File: `src/lib/services/ai.service.ts`

### RAG Flow (Retrieval-Augmented Generation)

```
1. User tạo task "Viết báo cáo tháng"
      ↓
2. POST /api/ai/store-embedding/[taskId]
   → storeEmbedding(supabase, taskId, "Viết báo cáo tháng")
   → Gemini Embeddings API → vector[3072]
   → UPDATE tasks SET embedding = vector WHERE id = taskId
      ↓
3. User nhờ AI estimate "Làm slide thuyết trình"
      ↓
4. POST /api/ai/estimate-time
   → findSimilarTasks(supabase, userId, "Làm slide thuyết trình")
   → Gemini Embeddings API → query_vector[3072]
   → supabase.rpc("search_similar_tasks", { query_embedding, threshold: 0.7 })
   → pgvector: SELECT * FROM tasks ORDER BY embedding <=> query_vector LIMIT 5
   → Trả về 5 tasks tương tự với số pomodoros thực tế
      ↓
5. estimateTime("Làm slide thuyết trình", similarTasks)
   → Gemini LLM với context = similar tasks + actual time spent
   → blendEstimates(llmEstimate, historicalAverage)
   → Trả về: { estimatedPomodoros: 3, suggestedSessions: 2 }
```

---

## 10. Cron Jobs (pg_cron)

SQL functions chạy theo schedule trong PostgreSQL (không cần server):

| Job | Schedule | Mô tả |
|-----|----------|-------|
| `midnight-reset` | `0 0 * * *` | TODAY chưa xong → BACKLOG; DONE >30 ngày → archive |
| `stale-sessions` | `*/10 * * * *` | IN_PROGRESS/PAUSED >2h → INTERRUPTED |
| `daily-stats-reconcile` | `5 0 * * *` | Tổng hợp completed tasks → daily_stats |
| `streak-update` | `10 0 * * *` | Tính currentStreak / longestStreak |

Setup trong `supabase/migrations/00001_initial_schema.sql`:
```sql
SELECT cron.schedule('midnight-reset', '0 0 * * *', $$
  UPDATE tasks SET status = 'BACKLOG'
  WHERE status = 'TODAY' AND ...
$$);
```

---

## 11. Deploy lên Vercel

### Setup lần đầu

1. Push code lên GitHub
2. [vercel.com](https://vercel.com) → **Import Repository**
3. Framework: **Next.js**, Root Directory: `.` (root vì đã flatten)
4. Thêm tất cả env vars (xem mục 12 bên dưới)
5. Deploy

### `vercel.json`

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs"
}
```

### Post-deploy checklist

- [ ] Supabase → Authentication → URL Config → thêm `https://modolist.vercel.app` vào Site URL và Redirect URLs
- [ ] Google Cloud Console → OAuth Client → thêm `https://<project>.supabase.co/auth/v1/callback` vào Authorized redirect URIs
- [ ] Spotify Dashboard → App Settings → Redirect URIs → thêm `https://modolist.vercel.app/api/spotify/callback`
- [ ] Vercel env vars: set `SPOTIFY_REDIRECT_URI=https://modolist.vercel.app/api/spotify/callback`

---

## 12. Environment Variables

### `.env.local` (local dev)

| Variable | Required | Mô tả |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | ✅ | `sb_publishable_...` — safe to expose |
| `SUPABASE_SECRET_KEY` | ✅ | `sb_secret_...` — service_role key, server only |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GEMINI_MODEL` | ✅ | Ví dụ: `gemini-2.5-flash-preview-04-17` |
| `SPOTIFY_CLIENT_ID` | ❌ | Spotify OAuth app client ID |
| `SPOTIFY_CLIENT_SECRET` | ❌ | Spotify OAuth app client secret |
| `SPOTIFY_REDIRECT_URI` | ❌ | `http://127.0.0.1:3000/api/spotify/callback` (local) |
| `NEXT_PUBLIC_SITE_URL` | ❌ | `http://localhost:3000` (local) |

### Vercel Production env vars

Cần set thêm (hoặc override) các giá trị production:

| Variable | Production Value |
|----------|-----------------|
| `SPOTIFY_REDIRECT_URI` | `https://modolist.vercel.app/api/spotify/callback` |
| `NEXT_PUBLIC_SITE_URL` | `https://modolist.vercel.app` |

> Vercel cho phép set env vars theo môi trường (Production / Preview / Development) — set `SPOTIFY_REDIRECT_URI` và `NEXT_PUBLIC_SITE_URL` chỉ cho **Production** để local dev không bị ảnh hưởng.


---

## 1. Tổng quan thay đổi

### Trước (Railway)

```
┌─────────────┐   ┌───────────┐   ┌──────────────┐
│   Next.js   │──▶│  NestJS   │──▶│   PostgreSQL  │
│  (frontend) │   │  (API)    │   │   + pgvector  │
│   :3000     │   │  :3001    │   └──────────────┘
└─────────────┘   └─────┬─────┘
                        │
                  ┌─────▼─────┐   ┌──────────────┐
                  │   Redis   │   │  Python gRPC  │
                  │  BullMQ   │   │  AI Service   │
                  │           │   │  :50051       │
                  └───────────┘   └──────────────┘
```

- **NextAuth** cho authentication
- **Prisma** cho ORM
- **Socket.io** cho Focus World realtime
- **BullMQ + Redis** cho cron/queue jobs
- **Python + gRPC** cho AI (task generation, estimation, RAG)

### Sau (Vercel + Supabase)

```
┌──────────────────────────────────────┐
│           Next.js on Vercel          │
│  ┌────────────┐  ┌────────────────┐  │
│  │  Frontend   │  │  API Routes    │  │
│  │  (React)    │  │  (serverless)  │  │
│  └──────┬─────┘  └───────┬────────┘  │
│         │                │           │
│  ┌──────▼────────────────▼────────┐  │
│  │      Supabase JS Client        │  │
│  └──────────────┬─────────────────┘  │
└─────────────────┼────────────────────┘
                  │
          ┌───────▼────────┐
          │    Supabase    │
          │  ┌───────────┐ │
          │  │ PostgreSQL │ │ ← DB + pgvector + RLS
          │  │ + pg_cron  │ │ ← Scheduled jobs
          │  ├───────────┤ │
          │  │   Auth     │ │ ← Google OAuth + Email/Password
          │  ├───────────┤ │
          │  │ Realtime   │ │ ← Focus World (Presence + Broadcast)
          │  └───────────┘ │
          └────────────────┘

  + Gemini SDK (direct, trong API Routes)
```

### Mapping thay đổi

| Cũ | Mới |
|---|---|
| NestJS (`apps/api/`) | Next.js API Routes (`apps/web/src/app/api/`) |
| Prisma ORM | Supabase JS Client (`@supabase/supabase-js`) |
| NextAuth | Supabase Auth |
| Socket.io | Supabase Realtime (Presence + Broadcast) |
| BullMQ + Redis | pg_cron (SQL functions chạy trực tiếp trong PostgreSQL) |
| Python gRPC AI | TypeScript + `@google/genai` SDK (gọi trực tiếp Gemini API) |
| Docker Compose | Không cần — tất cả đều managed |
| Railway | Vercel (frontend + API) + Supabase (backend services) |

---

## 2. Setup Supabase project

### 2.1 Cài Supabase CLI

```bash
brew install supabase/tap/supabase
```

### 2.2 Tạo project trên supabase.com

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Chọn region gần nhất (ví dụ: `ap-southeast-1`)
3. Lưu lại **Database password**

### 2.3 Init & link

```bash
cd /path/to/todolist

# Init (tạo supabase/config.toml)
supabase init

# Login vào Supabase CLI
supabase login

# Link với remote project
# Project ref lấy từ URL: https://supabase.com/dashboard/project/<ref>
supabase link --project-ref <your-project-ref>
```

### 2.4 Push migration lên cloud

```bash
supabase db push
```

Lệnh này sẽ chạy file `supabase/migrations/00001_initial_schema.sql` lên database cloud.

### 2.5 Enable extensions (nếu cần)

Vào **Supabase Dashboard → Database → Extensions**, enable:
- `pgcrypto` ✓ (default)
- `vector` (pgvector) — cho AI RAG
- `pg_cron` — cho scheduled jobs

### 2.6 Setup Auth providers

Vào **Authentication → Providers**:
- **Email** → Enable
- **Google** → Enable, nhập Google OAuth Client ID + Secret
  - Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

---

## 3. Database Schema & Migration

File: `supabase/migrations/00001_initial_schema.sql`

### 3.1 Tables

| Table | Mô tả |
|-------|-------|
| `users` | Profile người dùng, sync từ `auth.users` qua trigger |
| `tasks` | Công việc (BACKLOG/TODAY/DONE), có `embedding vector(3072)` cho RAG |
| `focus_sessions` | Phiên tập trung (IN_PROGRESS/PAUSED/COMPLETED/INTERRUPTED) |
| `daily_stats` | Thống kê hàng ngày (focus time, pomodoros, completed tasks) |
| `ai_interactions` | Log các lần gọi AI |
| `badges` / `user_badges` | Huy hiệu & unlock history |
| `posts` / `post_images` | Community posts |
| `spotify_accounts` | OAuth tokens cho Spotify integration |

### 3.2 RPC Functions (gọi qua `supabase.rpc()`)

| Function | Mục đích |
|----------|----------|
| `increment_task_order(p_user_id, p_status)` | Dịch order +1 để chèn task mới lên đầu |
| `increment_task_pomodoros(p_task_id)` | +1 pomodoro khi complete session |
| `increment_user_focus_time(p_user_id, p_duration)` | Cộng focus time vào user profile |
| `upsert_daily_stats_on_complete(p_user_id, p_date, p_duration)` | Upsert daily stats khi complete |
| `search_similar_tasks(query_embedding, match_threshold, match_count, p_user_id)` | Tìm tasks tương tự bằng cosine similarity (pgvector) |

### 3.3 Triggers

- **`on_auth_user_created`** / **`on_auth_user_updated`**: Tự động sync `auth.users` → `users` table khi đăng ký/cập nhật profile
- **`trg_*_updated_at`**: Tự động set `updatedAt = now()` trên mỗi UPDATE

### 3.4 Row Level Security (RLS)

Mọi table đều bật RLS. Policy chung: **user chỉ CRUD được data của mình** (`userId = auth.uid()::text`).

Exception: `posts` có thêm policy cho phép đọc posts public.

---

## 4. Supabase Client Architecture

```
src/lib/supabase/
├── client.ts          ← Browser client (dùng trong "use client" components)
├── server.ts          ← Server client (dùng trong API Routes, Server Components)
├── middleware.ts       ← Middleware: refresh session + redirect logic
├── auth-helper.ts     ← Helper cho API Routes: getAuthenticatedUser()
└── types.ts           ← TypeScript types (thay Prisma generated types)
```

### 4.1 Browser Client (`client.ts`)

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );
}
```

**Dùng ở đâu:** Client components, hooks (`useSupabaseSession`), `auth.ts`

### 4.2 Server Client (`server.ts`)

```typescript
// Cookie-based client (respects RLS — dùng cho user-authenticated requests)
export async function createClient() { ... }

// Service-role client (bypass RLS — dùng cho admin tasks)
export function createServiceClient() { ... }
```

**Dùng ở đâu:** API Routes, Server Components, `auth-server.ts`

### 4.3 Auth Helper (`auth-helper.ts`)

```typescript
// Dùng trong API Routes để authenticate request
export async function getAuthenticatedUser() {
  // → { user, supabase, error: null }    khi đã đăng nhập
  // → { user: null, supabase, error: NextResponse(401) }  khi chưa đăng nhập
}
```

**Pattern sử dụng trong API Route:**

```typescript
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  // user.id là authenticated user ID
  const { data } = await supabase.from("tasks").select("*").eq("userId", user.id);
  return NextResponse.json(data);
}
```

### 4.4 Middleware (`proxy.ts` → `middleware.ts`)

```
Request → proxy.ts → middleware.ts (updateSession)
                       ├── Refresh Supabase auth cookies
                       ├── /auth/* + đã login → redirect /dashboard
                       ├── /dashboard + chưa login + không phải guest → redirect /auth/signin
                       └── Mọi thứ khác → pass through
```

---

## 5. Authentication Flow

### 5.1 Files

| File | Type | Exports |
|------|------|---------|
| `src/lib/auth.ts` | Client-only | `signInWithGoogle()`, `signInWithPassword()`, `signUp()`, `signOut()` |
| `src/lib/auth-server.ts` | Server-only | `getServerSession()` |
| `src/hooks/useSupabaseSession.ts` | Client hook | `useSession()` → `{ data, status }` |
| `src/app/auth/callback/route.ts` | API Route | OAuth callback handler |
| `src/app/auth/signin/actions.ts` | Server Action | Form actions cho signin page |

### 5.2 Flow đăng nhập Google

```
1. User click "Đăng nhập Google"
2. signInWithGoogle() → supabase.auth.signInWithOAuth({ provider: "google" })
3. Redirect → Google OAuth → callback URL: /auth/callback
4. /auth/callback route: exchange code → set session cookies
5. Redirect → /dashboard
6. middleware refreshes session on every request

   Trigger: on_auth_user_created → tự tạo row trong `users` table
```

### 5.3 Flow đăng nhập Email/Password

```
1. Form submit → authenticate() server action
2. Server: supabase.auth.signInWithPassword({ email, password })
3. Set session cookies
4. Redirect → /dashboard
```

### 5.4 useSession() hook (client-side)

```typescript
// Drop-in replacement cho next-auth useSession
const { data, status } = useSession();
// data?.user → { id, email, name, image }
// status → "loading" | "authenticated" | "unauthenticated"
```

---

## 6. API Routes

Tất cả API routes nằm trong `src/app/api/`.

### 6.1 Tasks (15 routes)

| Route | Method | Mô tả |
|-------|--------|-------|
| `/api/tasks` | GET | Lấy tất cả tasks |
| `/api/tasks` | POST | Tạo task mới |
| `/api/tasks/[id]` | GET | Lấy 1 task |
| `/api/tasks/[id]` | PATCH | Cập nhật task |
| `/api/tasks/[id]` | DELETE | Xoá task |
| `/api/tasks/[id]/order` | PATCH | Đổi thứ tự task |
| `/api/tasks/[id]/archive` | PATCH | Archive task |
| `/api/tasks/[id]/duplicate` | POST | Nhân bản task |
| `/api/tasks/backlog` | GET | Tasks trong BACKLOG |
| `/api/tasks/backlog/count` | GET | Đếm BACKLOG |
| `/api/tasks/done-history` | GET | Tasks đã DONE |
| `/api/tasks/done-history/count` | GET | Đếm DONE |
| `/api/tasks/status/[status]` | GET | Tasks theo status |
| `/api/tasks/stats` | GET | Thống kê tasks |
| `/api/tasks/batch` | POST | Tạo batch tasks (guest migration) |

### 6.2 Focus Sessions (14 routes)

| Route | Method | Mô tả |
|-------|--------|-------|
| `/api/focus-sessions` | GET | Tất cả sessions |
| `/api/focus-sessions` | POST | Tạo session |
| `/api/focus-sessions/[id]` | GET/PATCH/DELETE | CRUD session |
| `/api/focus-sessions/[id]/complete` | PATCH | Hoàn thành session |
| `/api/focus-sessions/[id]/pause` | PATCH | Tạm dừng |
| `/api/focus-sessions/[id]/resume` | PATCH | Tiếp tục |
| `/api/focus-sessions/start` | POST | Bắt đầu session mới |
| `/api/focus-sessions/current` | GET | Session đang chạy |
| `/api/focus-sessions/incomplete` | GET | Session chưa xong |
| `/api/focus-sessions/by-task/[taskId]` | GET | Sessions của 1 task |
| `/api/focus-sessions/stats` | GET | Thống kê sessions |
| `/api/focus-sessions/stats/dashboard` | GET | Dashboard stats |

### 6.3 AI (4 routes)

| Route | Method | Mô tả |
|-------|--------|-------|
| `/api/ai/generate-tasks` | POST | AI tạo tasks từ goal |
| `/api/ai/estimate-time` | POST | AI ước lượng thời gian |
| `/api/ai/confirm-tasks` | POST | Lưu tasks AI đã tạo |
| `/api/ai/store-embedding/[taskId]` | POST | Tạo + lưu embedding |

### 6.4 Spotify (4 routes) & Auth (1 route)

| Route | Method | Mô tả |
|-------|--------|-------|
| `/api/spotify/connect` | GET | Bắt đầu Spotify OAuth |
| `/api/spotify/callback` | GET | Spotify OAuth callback |
| `/api/spotify/token` | GET | Lấy/refresh token |
| `/api/spotify/disconnect` | DELETE | Ngắt kết nối Spotify |
| `/api/auth/signup` | POST | Đăng ký email/password |

### 6.5 Pattern chung của API Route

```typescript
// apps/web/src/app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { findAllTasks, createTask } from "@/lib/services/tasks.service";

export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const tasks = await findAllTasks(supabase, user.id);
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const task = await createTask(supabase, user.id, body);
  return NextResponse.json(task, { status: 201 });
}
```

---

## 7. Services Layer

```
src/lib/services/
├── tasks.service.ts          ← CRUD + recurrence logic cho tasks
├── focus-sessions.service.ts ← CRUD + start/pause/resume/complete
└── ai.service.ts             ← Gemini SDK + RAG + estimation
```

Mọi service function nhận `supabase` client làm argument đầu tiên → dễ test, không phụ thuộc global state.

### Query pattern

```typescript
// SELECT
const { data, error } = await supabase
  .from("tasks")
  .select("*")
  .eq("userId", userId)
  .order("order", { ascending: true });

// INSERT
const { data, error } = await supabase
  .from("tasks")
  .insert({ userId, title, status: "TODAY" })
  .select()
  .single();

// UPDATE
const { data, error } = await supabase
  .from("tasks")
  .update({ status: "DONE", completedAt: new Date().toISOString() })
  .eq("id", id)
  .eq("userId", userId)
  .select()
  .single();

// DELETE
await supabase.from("tasks").delete().eq("id", id).eq("userId", userId);

// RPC
const { data } = await supabase.rpc("increment_task_pomodoros", { p_task_id: taskId });
```

---

## 8. AI Service (Gemini SDK)

File: `src/lib/services/ai.service.ts`

### Trước → Sau

| Trước | Sau |
|-------|-----|
| Python `google-genai` | TypeScript `@google/genai` |
| gRPC service (port 50051) | Direct function calls trong API Routes |
| ChromaDB | pgvector (trong Supabase PostgreSQL) |
| `gemini-1.5-flash` | `gemini-2.5-flash-preview-05-20` |
| `text-embedding-004` (768 dim) | `gemini-embedding-001` (3072 dim) |

### RAG Flow

```
1. User tạo task → storeEmbedding() → Gemini embedding API → lưu vector vào tasks.embedding
2. User hỏi estimate → findSimilarTasks() → supabase.rpc("search_similar_tasks") → pgvector cosine search
3. RAG results + LLM estimate → blendEstimates() → trả về kết quả cuối cùng
```

---

## 9. Focus World — Realtime

### Files

| File | Role |
|------|------|
| `src/lib/focusWorldSocket.ts` | Singleton `RealtimeChannel` instance |
| `src/hooks/useFocusWorld.ts` | Hook quản lý Presence + Broadcast |

### Trước → Sau

| Feature | Trước (Socket.io) | Sau (Supabase Realtime) |
|---------|-------------------|------------------------|
| User presence | `socket.emit("join")` | `channel.track({ userId, ... })` |
| User leave | `socket.emit("leave")` | `channel.untrack()` |
| Pause state | `socket.emit("pause")` | Update presence state |
| Spotify DJ | `socket.emit("spotify:*")` | `channel.send({ type: "broadcast", event: "spotify:*" })` |
| Online users | `socket.on("sync")` | `channel.presenceState()` |

### Channel structure

```
Channel: "focus-world"

Presence state per user:
{
  userId: string,
  sessionId: string,
  taskTitle: string,
  focusDuration: number,
  startedAt: string,
  isPaused: boolean,
  spotifyTrack?: { name, artist, albumArt },
  isListeningToDj: boolean,
}

Broadcast events:
- "spotify:dj-update"  → DJ broadcast track
- "spotify:dj-stopped" → DJ stopped
```

---

## 10. Cron Jobs (pg_cron)

Thay thế BullMQ + Redis bằng SQL functions chạy trong PostgreSQL:

| Job | Schedule | Mô tả |
|-----|----------|-------|
| `midnight-reset` | Mỗi ngày 0:00 | TODAY chưa xong → BACKLOG, archive DONE >30d |
| `stale-sessions` | Mỗi 10 phút | IN_PROGRESS/PAUSED >2h → INTERRUPTED |
| `daily-stats-reconcile` | Mỗi ngày 0:05 | Đếm completed tasks hôm qua → daily_stats |
| `streak-update` | Mỗi ngày 0:10 | Update currentStreak / longestStreak |

---

## 11. Deploy lên Vercel

### Không dùng Docker. Deploy bằng Vercel native build.

### 11.1 Setup

1. **Push code lên GitHub**

2. **Vào [vercel.com](https://vercel.com)** → Import Git Repository

3. **Configure project:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web`
   - **Build Command:** (sẽ tự dùng từ `vercel.json`)
   - **Install Command:** (sẽ tự dùng từ `vercel.json`)

4. **Thêm Environment Variables** (trong Vercel Dashboard → Settings → Environment Variables):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_xxx
   SUPABASE_SECRET_KEY=sb_secret_xxx
   GEMINI_API_KEY=AIza...
   SPOTIFY_CLIENT_ID=xxx
   SPOTIFY_CLIENT_SECRET=xxx
   SPOTIFY_REDIRECT_URI=https://your-domain.vercel.app/api/spotify/callback
   ```

5. **Deploy** — Vercel sẽ tự chạy build command từ `vercel.json`:
   ```json
   {
     "buildCommand": "cd ../.. && NODE_ENV=production pnpm turbo build --filter=web",
     "installCommand": "cd ../.. && NODE_ENV=development pnpm install --frozen-lockfile"
   }
   ```

### 11.2 Post-deploy

- Update **Supabase Auth redirect URL**: vào Authentication → URL Configuration → thêm `https://your-domain.vercel.app` vào Site URL và Redirect URLs
- Update **Google OAuth**: thêm `https://xxxx.supabase.co/auth/v1/callback` vào Authorized redirect URIs
- Update **Spotify redirect**: thêm production URL vào Spotify Dashboard

---

## 12. Environment Variables

### Apps/web `.env.local`

| Variable | Required | Mô tả |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | ✅ | Publishable key (safe to expose) |
| `SUPABASE_SECRET_KEY` | ✅ | Secret key (server-side only, bypass RLS) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `SPOTIFY_CLIENT_ID` | ❌ | Spotify OAuth client ID |
| `SPOTIFY_CLIENT_SECRET` | ❌ | Spotify OAuth client secret |
| `SPOTIFY_REDIRECT_URI` | ❌ | Spotify OAuth redirect URI |

---

## 13. Cấu trúc thư mục

```
todolist/
├── apps/
│   └── web/                          ← Next.js app (frontend + API)
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/              ← API Routes (thay NestJS)
│       │   │   │   ├── tasks/        ← 15 task endpoints
│       │   │   │   ├── focus-sessions/ ← 14 session endpoints
│       │   │   │   ├── ai/           ← 4 AI endpoints
│       │   │   │   ├── spotify/      ← 4 Spotify endpoints
│       │   │   │   └── auth/         ← signup
│       │   │   ├── auth/             ← Auth pages (signin, signup, callback)
│       │   │   └── dashboard/        ← Dashboard pages
│       │   ├── lib/
│       │   │   ├── supabase/         ← Supabase clients + helpers
│       │   │   │   ├── client.ts     ← Browser client
│       │   │   │   ├── server.ts     ← Server client + service client
│       │   │   │   ├── middleware.ts  ← Session refresh + redirects
│       │   │   │   ├── auth-helper.ts ← API Route auth guard
│       │   │   │   └── types.ts      ← Database types
│       │   │   ├── services/         ← Business logic (thay NestJS services)
│       │   │   │   ├── tasks.service.ts
│       │   │   │   ├── focus-sessions.service.ts
│       │   │   │   └── ai.service.ts
│       │   │   ├── auth.ts           ← Client-side auth helpers
│       │   │   ├── auth-server.ts    ← Server-side auth helpers
│       │   │   ├── api-client.ts     ← Frontend HTTP client
│       │   │   └── focusWorldSocket.ts ← Realtime channel singleton
│       │   ├── hooks/
│       │   │   ├── useSupabaseSession.ts ← useSession() hook
│       │   │   └── useFocusWorld.ts      ← Focus World Realtime hook
│       │   └── proxy.ts             ← Next.js middleware entry
│       ├── vercel.json               ← Vercel build config
│       └── .env.local                ← Environment variables
├── packages/
│   ├── eslint-config/                ← Shared ESLint config
│   └── typescript-config/            ← Shared TS config
├── supabase/
│   ├── config.toml                   ← Supabase CLI config
│   └── migrations/
│       └── 00001_initial_schema.sql  ← Full database schema
├── turbo.json                        ← Turborepo config
├── pnpm-workspace.yaml               ← pnpm workspace
└── .github/workflows/ci.yml          ← CI pipeline
```
