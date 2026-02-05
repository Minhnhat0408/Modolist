# TodoList - Co-Focus Space

> **Ứng dụng Năng suất Xã hội**: Kết hợp Todo List + Pomodoro Timer + Theo dõi Focus Real-time + AI Coach

## 🛠️ Công nghệ sử dụng

**Frontend:**
- Next.js 16 (App Router), TypeScript, TailwindCSS, Shadcn UI
- React Query (quản lý state server), Zustand (quản lý state client)
- @dnd-kit (drag & drop), Socket.io-client (real-time)

**Backend:**
- NestJS 11, Prisma ORM, NeonDB (PostgreSQL)
- Socket.io (WebSocket), Redis (adapter + cache)
- gRPC client (kết nối AI service)

**AI Service:**
- Python 3.12+, gRPC server
- Google Gemini API (AI model)
- NumPy (vector similarity)

## ⏱️ Kế hoạch Thực hiện

**Tổng thời gian:** 14 giờ (2h/ngày × 7 ngày)

| Giai đoạn | Công việc | Thời gian | Trạng thái |
|-----------|-----------|-----------|------------|
| **Phase 1: Setup** | Cài đặt hạ tầng & Dependencies | 2h | 🔲 |
| **Phase 2: Backend Core** | Code API + Database + WebSocket | 4h | 🔲 |
| **Phase 3: AI Service** | Code AI service với Gemini + gRPC | 2h | 🔲 |
| **Phase 4: Frontend** | Hoàn thiện giao diện chính | 4h | 🔲 |
| **Phase 5: Polish** | Testing và tài liệu | 2h | 🔲 |

---

## 📋 Yêu cầu Hệ thống

- **Node.js** 18+ & **pnpm** 9.0.0
- **Python** 3.12+
- **Docker** (khuyên dùng OrbStack)
- **NeonDB** account (free tier)

## 🚀 Hướng dẫn Cài đặt

### Cách 1: Chạy bằng Docker (Đơn giản nhất)

```bash
git clone https://github.com/Sun-EP8/vn25_fs_check_minhnn-3609.git
cd vn25_fs_check_minhnn-3609

pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/ai-service/.env.example apps/ai-service/.env

docker-compose up -d
```

**URLs Services:**
- Web Frontend: http://localhost:3000
- API Backend: http://localhost:3001
- Redis Commander: http://localhost:8081

### Cách 2: Chạy Development (Local)

```bash
pnpm install

cd apps/ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..

cd apps/api
npx prisma generate
npx prisma migrate dev
cd ../..

docker-compose up -d redis

pnpm dev
```

---

## 🐳 Cài đặt Docker (OrbStack)

### Cài đặt

```bash
brew install orbstack
open -a OrbStack

docker --version
docker-compose --version
```

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

### Phase 2: Backend Core (4h) ⏱️

#### Ngày 2 - Phần 1: Task API (2h)
- [ ] Tạo TasksModule với Prisma integration
- [ ] Implement CRUD endpoints (GET, POST, PATCH, DELETE)
- [ ] Thêm task status transitions (BACKLOG → TODAY → DONE)
- [ ] Viết unit tests cho TasksService
- [ ] Test với Thunder Client/Postman

**Kết quả:** Task management API hoạt động

#### Ngày 3 - Phần 2: Real-time WebSocket (2h)
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
