# Supabase Migration & Architecture Guide

> Migration từ **Railway (NestJS + Redis/BullMQ + Python gRPC AI)** sang **Vercel (Next.js) + Supabase (DB + Auth + Realtime + Cron)**

---

## Mục lục

1. [Tổng quan thay đổi](#1-tổng-quan-thay-đổi)
2. [Setup Supabase project](#2-setup-supabase-project)
3. [Database Schema & Migration](#3-database-schema--migration)
4. [Supabase Client Architecture](#4-supabase-client-architecture)
5. [Authentication Flow](#5-authentication-flow)
6. [API Routes](#6-api-routes)
7. [Services Layer](#7-services-layer)
8. [AI Service (Gemini SDK)](#8-ai-service-gemini-sdk)
9. [Focus World — Realtime](#9-focus-world--realtime)
10. [Cron Jobs (pg_cron)](#10-cron-jobs-pg_cron)
11. [Deploy lên Vercel](#11-deploy-lên-vercel)
12. [Environment Variables](#12-environment-variables)
13. [Cấu trúc thư mục](#13-cấu-trúc-thư-mục)

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
