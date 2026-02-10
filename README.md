# TodoList - Co-Focus Space

> **Ứng dụng Năng suất Xã hội**: Kết hợp Todo List + Pomodoro Timer + Theo dõi Focus Real-time + AI Coach

## 🛠️ Công nghệ sử dụng

**Frontend:**
- Next.js 16 (App Router), TypeScript, TailwindCSS, Shadcn UI  
- React Hook Form + Zod (form validation)
- @dnd-kit (drag & drop Kanban board)
- NextAuth.js (authentication với Google OAuth)
- Socket.io-client (real-time - coming soon)

**Backend:**
- NestJS 11 với SWC compiler
- Prisma ORM + NeonDB (PostgreSQL)
- JWT Authentication với Passport
- Cache Manager (in-memory caching)
- Socket.io (WebSocket - coming soon)

**AI Service:**
- Python 3.12+, gRPC server
- Google Gemini API (AI model)
- NumPy (vector similarity)

---

## 🎯 Feature-First Development Progress

**Current Status:** 📊 **Kanban Board - 100% Complete**

### ✅ **Phase 1: Authentication & Security** (100%)
- [x] NextAuth.js integration
- [x] Google OAuth provider
- [x] Credentials provider (email/password)
- [x] Session management
- [x] Protected routes
- [x] JWT token generation for API

### ✅ **Phase 2: Kanban Board with Drag & Drop** (100%)
- [x] **Backend API:**
  - [x] JWT Authentication Guard
  - [x] Task CRUD endpoints (8 routes)
  - [x] User-scoped data access
  - [x] Cache layer implementation
  - [x] Input validation with DTOs
  - [x] TaskStatus enum with IN_PROGRESS state

- [x] **Frontend UI:**
  - [x] Kanban board layout (4 columns)
  - [x] Drag & drop functionality (@dnd-kit)
  - [x] Task cards with metadata
  - [x] Create/Edit/Delete modals
  - [x] Form validation (React Hook Form + Zod)
  - [x] Optimistic UI updates
  - [x] Loading states & error handling

### 🔄 **Next Up: Real-time Features**
- [ ] WebSocket connection
- [ ] Live focus session tracking
- [ ] Multi-user co-focus rooms
- [ ] Real-time task updates

### 📅 **Future Phases**
- [ ] **Phase 3:** Pomodoro Timer Integration
- [ ] **Phase 4:** AI Coach with Gemini
- [ ] **Phase 5:** Social Features (Posts, Badges)
- [ ] **Phase 6:** Analytics Dashboard

---

## 📊 Tech Stack Details

**Architecture Pattern:** Feature-First Monorepo

```
todolist/
├── apps/
│   ├── web/          # Next.js 16 (Frontend)
│   ├── api/          # NestJS 11 (Backend)
│   └── ai-service/   # Python gRPC (AI)
├── packages/
│   ├── database/     # Prisma schema & types
│   ├── ui/           # Shared React components
│   └── typescript-config/
```

**Key Technologies:**
- **Turborepo:** Monorepo build system
- **pnpm workspaces:** Package management
- **SWC:** Fast TypeScript compilation
- **Prisma:** Type-safe database ORM
- **Zod:** Runtime type validation

---

## 📋 Yêu cầu Hệ thống

- **Node.js** 18+ & **pnpm** 9.0.0
- **Python** 3.12+ (for AI service)
- **Docker** (optional, recommended OrbStack)
- **NeonDB** account (free tier)

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Sun-EP8/vn25_fs_check_minhnn-3609.git
cd vn25_fs_check_minhnn-3609
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Update with your credentials:
# - DATABASE_URL (Neon PostgreSQL)
# - AUTH_SECRET (generate with: openssl rand -base64 32)
# - AUTH_GOOGLE_ID & AUTH_GOOGLE_SECRET (Google Console)
```

### 3. Database Setup

```bash
cd packages/database
pnpm prisma migrate dev
pnpm prisma generate
```

### 4. Run Development

```bash
# Terminal 1: API Server (http://localhost:3001)
cd apps/api
pnpm dev

# Terminal 2: Web App (http://localhost:3000)
cd apps/web
pnpm dev
```

**Access:** Open http://localhost:3000 and sign in with Google

---

## 🐳 Docker Deployment (Optional)

```bash
docker-compose up -d
```

**Services:**
- Web: http://localhost:3000
- API: http://localhost:3001
- Redis: localhost:6379

---

### Quản lý Services

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
docker-compose down -v
```

---

## 📝 Quy trình Làm việc

### Lệnh thường dùng

```bash
pnpm dev

pnpm dev --filter=web
pnpm dev --filter=api
pnpm dev --filter=ai-service

pnpm build

pnpm lint
pnpm check-types

cd apps/api
npx prisma studio
npx prisma migrate dev
npx prisma db push
```

---

## ✅ Checklist Phát triển

### Phase 1: Hạ tầng (2h) ⏱️

- [ ] Cài đặt tất cả dependencies (Prisma, Socket.io, React Query, etc.)
- [ ] Setup Prisma schema (User, Task, FocusSession models)
- [ ] Kết nối NeonDB và test connection
- [ ] Cập nhật docker-compose.yml với Redis
- [ ] Cấu hình environment variables cho tất cả apps

**Kết quả:** `docker-compose up` hoạt động, Prisma kết nối NeonDB thành công

---

### Phase 2: Task Management API (2h) ✅

#### ✅ Hoàn thành - Task CRUD API

**Endpoints:**
- `GET /tasks?userId=xxx` - Lấy tất cả tasks
- `GET /tasks/stats?userId=xxx` - Thống kê tasks
- `GET /tasks/status/:status?userId=xxx` - Lấy tasks theo status (BACKLOG/TODAY/DONE)
- `GET /tasks/:id?userId=xxx` - Lấy 1 task
- `POST /tasks?userId=xxx` - Tạo task mới
- `PATCH /tasks/:id?userId=xxx` - Cập nhật task
- `PATCH /tasks/:id/archive?userId=xxx` - Archive task
- `DELETE /tasks/:id?userId=xxx` - Xóa task

**Ví dụ sử dụng:**

```bash
# Tạo task mới
curl -X POST http://localhost:3001/tasks?userId=user123 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hoàn thành Project X",
    "description": "Làm backend API",
    "status": "TODAY",
    "priority": "HIGH",
    "estimatedPomodoros": 4,
    "tags": ["work", "urgent"],
    "dueDate": "2026-02-15T10:00:00Z"
  }'

# Lấy tất cả tasks
curl http://localhost:3001/tasks?userId=user123

# Cập nhật status task
curl -X PATCH http://localhost:3001/tasks/task_id?userId=user123 \
  -H "Content-Type: application/json" \
  -d '{"status": "DONE"}'

# Lấy thống kê
curl http://localhost:3001/tasks/stats?userId=user123
# Response: {"total": 10, "backlog": 3, "today": 5, "done": 2, "archived": 0}
```

**Kết quả:** Task management API hoạt động ✅

---

### Phase 3: Real-time WebSocket (2h) 🔲

#### Ngày 3 - WebSocket & Focus Tracking (2h)
- [ ] Setup Socket.io Gateway trong NestJS
- [ ] Implement "Start Focus" event handling
- [ ] Thêm Redis adapter cho Socket.io
- [ ] Test real-time sync giữa 2 browser tabs
- [ ] Xử lý user online/offline states

**Kết quả:** Real-time focus tracking hoạt động

---

### Phase 3: AI Service (2h) ⏱️

#### Ngày 4: gRPC AI Coach (2h)
- [ ] Setup gRPC server (Python)
- [ ] Tạo proto file definition
- [ ] Implement embedding endpoint (Gemini)
- [ ] Implement suggestion endpoint (RAG)
- [ ] Thêm gRPC client trong NestJS
- [ ] Test end-to-end AI suggestion flow

**Kết quả:** AI suggestions hoạt động qua gRPC

---

### Phase 4: Frontend (4h) ⏱️

#### Ngày 5 - Phần 1: Kanban Board (2h)
- [ ] Setup TailwindCSS + Shadcn UI components
- [ ] Cài đặt @dnd-kit cho drag & drop
- [ ] Tạo Kanban columns (Backlog, Today, Done)
- [ ] Implement task cards với drag & drop
- [ ] Kết nối Task API với React Query
- [ ] Thêm optimistic updates

**Kết quả:** Kanban board hoạt động

#### Ngày 6 - Phần 2: Tính năng Real-time (2h)
- [ ] Tạo Pomodoro Timer component
- [ ] Setup Socket.io client
- [ ] Hiển thị trạng thái focus của users khác
- [ ] Thêm "Start Focus" button integration
- [ ] Tạo AI suggestion UI panel
- [ ] Test real-time sync

**Kết quả:** Các tính năng chính hoàn thành

---

### Phase 5: Hoàn thiện & Deploy (2h) ⏱️

#### Ngày 7: Testing & Tài liệu (2h)
- [ ] Viết integration tests cho các flows quan trọng
- [ ] Cập nhật GitHub Issues với tiến độ
- [ ] Thêm tài liệu API (Swagger tùy chọn)
- [ ] Tạo hướng dẫn deployment
- [ ] Ghi hình demo/screenshots
- [ ] Code review & cleanup cuối cùng

**Kết quả:** MVP sẵn sàng production

---

## 🧪 Chiến lược Testing

```bash
cd apps/api
pnpm test
pnpm test:e2e
pnpm test:cov

cd apps/web
pnpm test
```

**Tests bắt buộc:**
- ✅ Task CRUD operations
- ✅ WebSocket connection & events
- ✅ AI service health check

---

## 📝 CI/CD

GitHub Actions workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

**Tự động chạy mỗi khi push/PR:**
- ✅ Cài đặt Node.js & Python dependencies
- ✅ Lint tất cả code (ESLint, Prettier)
- ✅ Type checking (TypeScript)
- ✅ Chạy tests (Jest, pytest)
- ✅ Build tất cả apps
- 🚀 Deploy (cấu hình riêng)

---

## 🌐 Hướng dẫn Deploy

### Nền tảng đề xuất

| Service | Platform | Ghi chú |
|---------|----------|---------|
| **Database** | NeonDB | Serverless PostgreSQL (đã setup) |
| **Redis** | Upstash | Serverless Redis (free tier) |
| **API** | Railway/Render | NestJS backend |
| **Web** | Vercel | Next.js frontend |
| **AI Service** | Railway/Render | Python gRPC service |

### Biến môi trường

**apps/api/.env:**
```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
GEMINI_API_KEY="..."
JWT_SECRET="..."
```

**apps/web/.env.local:**
```env
NEXT_PUBLIC_API_URL="https://api.yourapp.com"
NEXT_PUBLIC_WS_URL="wss://api.yourapp.com"
```

---

## 🎯 Quản lý Dự án

### Quy tắc GitHub Issues

Mỗi issue PHẢI:
- ✅ Hoàn thành trong ≤6 giờ
- ✅ Có acceptance criteria rõ ràng
- ✅ Link đến PR tương ứng (khi implement)
- ✅ Ghi chép tất cả quyết định trong comments

**Mẫu Issue:**
```markdown
## Task: Setup Prisma Schema

**Loại:** Infrastructure
**Thời gian dự kiến:** 2h
**Ưu tiên:** P0

### Acceptance Criteria
- [ ] Tạo User, Task, FocusSession models
- [ ] Generate Prisma Client
- [ ] Kết nối NeonDB thành công
- [ ] Push schema lên database

### Ghi chú Implementation
(Thêm chi tiết khi làm)

### PR liên quan
#XX (thêm khi tạo PR)
```

---

## 🐛 Xử lý Lỗi

### Lỗi OrbStack

```bash
orbstack status
orbstack restart
orbstack reset
```

### Lỗi Prisma

```bash
npx prisma generate
npx prisma migrate reset
npx prisma format
```

### Lỗi Redis Connection

```bash
docker exec -it todolist-redis-1 redis-cli
> PING
PONG
> exit
```

### Port đã được sử dụng

```bash
lsof -ti:3000 | xargs kill -9

PORT=3002 pnpm dev --filter=api
```

---

## 📚 Tài liệu Tham khảo

- [Turborepo Docs](https://turbo.build/repo/docs)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [NestJS Docs](https://docs.nestjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [Socket.io Docs](https://socket.io/docs/v4)
- [gRPC Python](https://grpc.io/docs/languages/python/)
- [OrbStack Docs](https://docs.orbstack.dev)

---

## 👤 Thông tin Dự án

**Developer:** Nguyễn Nhật Minh
**Reviewer:** bs90
**Timeline:** 2 tuần (14 giờ total)
**Ngày bắt đầu:** 5/2/2026
**Dự kiến hoàn thành:** 19/2/2026

---

## 📄 License

Dự án riêng tư cho mục đích đánh giá.

---

## 🔗 Links hữu ích

Tìm hiểu thêm về Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
