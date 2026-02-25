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

## 🎯 Lộ trình Phát triển

**Trạng thái hiện tại:** 📊 **Phase 2 hoàn thành - Chuẩn bị Phase 3**

### ✅ **Phase 1: Xác thực & Bảo mật** (100%)

- [x] Tích hợp NextAuth.js
- [x] Google OAuth provider
- [x] Credentials provider (email/password)
- [x] Quản lý session
- [x] Bảo vệ routes
- [x] Tạo JWT token cho API

### ✅ **Phase 2: Kanban Board với Drag & Drop** (100%)

- [x] **Backend API:**
  - [x] JWT Authentication Guard
  - [x] Task CRUD endpoints (8 routes)
  - [x] Phân quyền dữ liệu theo user
  - [x] Caching layer
  - [x] Validation với DTOs
  - [x] TaskStatus enum với IN_PROGRESS state

- [x] **Frontend UI:**
  - [x] Giao diện Kanban board (4 cột)
  - [x] Tính năng drag & drop (@dnd-kit)
  - [x] Task cards với metadata
  - [x] Modal tạo/sửa/xóa task
  - [x] Form validation (React Hook Form + Zod)
  - [x] Optimistic UI updates
  - [x] Xử lý loading & error states

### 🚧 **Phase 3: Pomodoro Timer & Real-time Service** (0%)

- [ ] **Pomodoro Timer:**
  - [ ] Component đếm ngược Pomodoro
  - [ ] Cài đặt thời gian work/break
  - [ ] Theo dõi session history
  - [ ] Thống kê phiên làm việc
  - [ ] Tích hợp với tasks

- [ ] **Real-time WebSocket:**
  - [ ] Setup Socket.io Gateway (NestJS)
  - [ ] Kết nối WebSocket
  - [ ] Live focus session tracking
  - [ ] Multi-user co-focus rooms
  - [ ] Real-time task updates
  - [ ] Online/offline presence
  - [ ] Redis adapter cho Socket.io

### 📅 **Phase 4: AI Service** (0%)

- [ ] Setup gRPC server (Python)
  - [ ] Tạo proto file definition
  - [ ] Tích hợp Google Gemini API
  - [ ] Implement embedding endpoint
  - [ ] Implement suggestion endpoint (RAG)
  - [ ] gRPC client trong NestJS
- [ ] AI-powered task suggestions
- [ ] Smart task prioritization
- [ ] Natural language task creation
- [ ] Productivity insights
- [ ] Intelligent scheduling

### 📚 **Phase 5: Testing & Tài liệu** (0%)

- [ ] **Testing:**
  - [ ] Unit tests (Jest)
  - [ ] Integration tests
  - [ ] E2E tests
  - [ ] Test coverage report
- [ ] **Tài liệu:**
  - [ ] API documentation (Swagger)
  - [ ] User guide
  - [ ] Developer documentation
  - [ ] Deployment guide
  - [ ] Demo video/screenshots

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

## ✅ Checklist Chi tiết Phát triển

### ✅ Phase 1: Xác thực & Bảo mật (Hoàn thành)

- [x] Cài đặt tất cả dependencies
- [x] Setup Prisma schema (User, Task models)
- [x] Kết nối NeonDB
- [x] Tích hợp NextAuth.js
- [x] Google OAuth provider
- [x] Credentials authentication
- [x] JWT token generation
- [x] Cấu hình environment variables

---

### ✅ Phase 2: Kanban Board (Hoàn thành)

**Backend API:**

- [x] JWT Authentication Guard
- [x] Task CRUD endpoints (8 routes):
  - `GET /tasks?userId=xxx` - Lấy tất cả tasks
  - `GET /tasks/stats?userId=xxx` - Thống kê tasks
  - `GET /tasks/status/:status?userId=xxx` - Lấy tasks theo status
  - `GET /tasks/:id?userId=xxx` - Lấy 1 task
  - `POST /tasks?userId=xxx` - Tạo task mới
  - `PATCH /tasks/:id?userId=xxx` - Cập nhật task
  - `PATCH /tasks/:id/archive?userId=xxx` - Archive task
  - `DELETE /tasks/:id?userId=xxx` - Xóa task
- [x] User-scoped data access
- [x] Cache layer implementation
- [x] Input validation với DTOs

**Frontend UI:**

- [x] Setup TailwindCSS + Shadcn UI
- [x] Cài đặt @dnd-kit cho drag & drop
- [x] Kanban board layout (4 columns)
- [x] Task cards với drag & drop
- [x] Create/Edit/Delete modals
- [x] Form validation (React Hook Form + Zod)
- [x] Kết nối API với React Query
- [x] Optimistic UI updates
- [x] Loading & error handling

---

### 🚧 Phase 3: Pomodoro Timer & Real-time Service

**Pomodoro Timer (Frontend):**

- [x] Tạo Pomodoro Timer component
- [x] Cài đặt thời gian work/break tùy chỉnh
- [x] Timer controls (start/pause/stop/reset)
- [ ] Audio notifications
- [x] Tích hợp với tasks
- [x] Lưu session history
- [x] Thống kê phiên làm việc

**Real-time WebSocket (Backend + Frontend):**

- [x] Setup Socket.io Gateway trong NestJS
- [x] Cấu hình Redis adapter cho Socket.io
- [x] Implement focus session events
- [x] Thêm FocusSession model vào Prisma
- [x] Setup Socket.io client (Frontend)
- [x] Live focus session tracking
- [x] Multi-user co-focus rooms
- [x] Real-time task updates
- [x] User presence (online/offline)
- [x] Test real-time sync giữa nhiều tabs/users

---

### 📅 Phase 4: AI Service

**gRPC AI Service (Python):**

- [x] Setup Python project structure
- [x] Tạo proto file definition
- [x] Setup gRPC server
- [x] Tích hợp Google Gemini API
- [x] Implement embedding endpoint
- [x] Implement suggestion endpoint (RAG)
- [x] Vector similarity với NumPy

**Kết nối Backend:**

- [x] Thêm gRPC client trong NestJS
- [x] API endpoint cho AI suggestions
- [x] Error handling & fallback

**Frontend Integration:**

- [x] Tạo AI suggestion UI panel
- [x] Smart task creation với NLP
- [x] Productivity insights dashboard
- [x] Intelligent scheduling suggestions
- [x] Test end-to-end AI flow

---

### 📚 Phase 5: Testing & Tài liệu

**Testing:**

- [x] Unit tests cho backend (Jest)
- [x] Unit tests cho frontend (Jest + React Testing Library)
- [x] Integration tests cho API flows
- [ ] E2E tests (Playwright/Cypress)
- [x] Test coverage report (>80%)
- [x] Performance testing

**Tài liệu:**

- [ ] API documentation (Swagger/OpenAPI)
- [ ] README cập nhật đầy đủ
- [ ] User guide (Tiếng Việt)
- [ ] Developer documentation
- [ ] Architecture diagram
- [ ] Deployment guide
- [ ] Demo video hoặc screenshots
- [ ] Code review & cleanup cuối cùng

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

## 🔗 Links hữu ích

Tìm hiểu thêm về Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
