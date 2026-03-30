# PROJECT SPECIFICATION:TODOLIST

## 1. Tổng quan
**TODOLIST** là một ứng dụng productivy kết hợp giữa quản lý công việc và kỹ thuật Pomodoro thời gian thực.
Mục tiêu: Tăng tính cộng đồng và hăng hái làm việc. Đồng thời là project show off nên sẽ có over engineering

**Tính năng chính:**
1.  **Board:** Quản lý tác vụ trực quan.
2.  **Real-time Focus:** Nhìn thấy đồng hồ Pomodoro của người khác đang chạy.
3.  **AI Coach:** Sử dụng AI để gợi ý task dựa trên thói quen lịch sử (RAG).

---

## 2. Tech Stack & Architecture

### 2.1. Monorepo Structure
* **Root:** `todolist/`
* `apps/web`: Frontend (Next.js App Router).
* `apps/api`: Main Backend (NestJS Monolith).
* `apps/ai-coach`: AI Worker Service (Python).

### 2.2. Frontend (`apps/web`)
* **Framework:** Next.js (TypeScript).
* **Styling:** TailwindCSS, Shadcn UI, Lucide Icons.
* **State Management:** React Query (Server state), Zustand (Client state).
* **Drag & Drop:** `@dnd-kit/core` (cho Kanban Board).
* **Real-time:** `socket.io-client`.

### 2.3. Main Backend (`apps/api`)
* **Framework:** NestJS.
* **Database ORM:** Prisma.
* **Database:** PostgreSQL (với extension `pgvector` cho AI).
* **Cache & PubSub:** Redis (dùng cho Socket.io adapter và BullMQ).
* **Communication:**
    * Expose REST API cho Frontend.
    * Expose WebSocket (Gateway) cho Frontend.
    * Gọi gRPC Client tới `apps/ai-coach`.

### 2.4. AI Service (`apps/ai-service`)
* **Language:** Python 3.11+.
* **Framework:** gRPC Server (dùng `grpcio`).
* **Libraries:** `openai` (hoặc `langchain`), `numpy` (xử lý vector).
* **Role:** Nhận text -> Trả về Vector Embedding hoặc Text Suggestion.

### 2.5. Infrastructure
* **Docker Compose:** Orchestration local (Postgres, Redis, 3 Apps).
* **Deployment Target:** AWS EC2 (Dockerized).

---

## 3. Functional Requirements (Yêu cầu chức năng)

### Module 1: Task Management (Kanban)
* **FR-01:** User có thể tạo, sửa, xóa Task.
* **FR-02:** Task có 3 trạng thái (Columns): `BACKLOG` (Nợ), `TODAY` (Hôm nay), `DONE` (Xong).
* **FR-03:** User có thể kéo thả (Drag & Drop) task giữa các cột.
* **FR-04:** Task có thuộc tính `estimated_pomodoros` (Số phiên dự kiến).

### Module 2: Focus Timer (Real-time Core)
* **FR-05:** User chọn 1 task và bấm "Start Focus".
* **FR-06:** Hệ thống đếm ngược (Pomodoro 25p hoặc Custom).
* **FR-07:** Khi User A bắt đầu, **tất cả** User khác đang online phải nhận được event qua Socket để hiển thị trạng thái của A (Avatar sáng lên, đồng hồ chạy).
* **FR-08:** Logic đồng bộ: Server chỉ gửi `startTime` và `duration`. Client tự tính toán thời gian còn lại để giảm tải băng thông.

### Module 3: AI Coach (gRPC + RAG)
* **FR-09:** Tính năng "AI Suggestion": User bấm nút, AI gợi ý 3 task nên làm.
* **FR-10:** **Embedding Flow:** Khi user tạo/hoàn thành task -> Backend gọi AI Service để vector hóa title task -> Lưu vào cột `embedding` trong Postgres.
* **FR-11:** **Retrieval Flow:** Khi gợi ý, Backend tìm 5 task cũ có vector tương đồng (Cosine Similarity) -> Gửi cho AI Service làm context để sinh lời khuyên.

### Module 4: Gamification (Redis)
* **FR-12:** Leaderboard: Xếp hạng User dựa trên tổng thời gian Focus trong ngày.
* **FR-13:** Dữ liệu Leaderboard được lưu và sort trong Redis (`Sorted Set`).

---

## 4. Non-Functional Requirements (Yêu cầu phi chức năng)

* **NFR-01 (Performance):** Socket latency < 200ms. UI cập nhật trạng thái Optimistic (phản hồi ngay lập tức trước khi server trả về).
* **NFR-02 (Scalability):** Backend phải stateless để có thể scale horizontal (sử dụng Redis Adapter cho Socket.io).
* **NFR-03 (Reliability):** Nếu AI Service chết, Main App vẫn hoạt động bình thường (chỉ mất tính năng gợi ý).
* **NFR-04 (Code Quality):** Tuân thủ Strict TypeScript. Code NestJS chia module rõ ràng (`TasksModule`, `GatewayModule`, `AiModule`).
## 2. Tech Stack & Architecture
### 2.1. Monorepo
* **Root:** `todolist/`
* `apps/web`: Frontend (Next.js App Router).
* `apps/api`: Main Backend (NestJS Monolith).
* `apps/ai-service`: AI Worker Service (Python).

### 2.2. Frontend (`apps/web`)
* **Framework:** Next.js (TypeScript).
* **Styling:** TailwindCSS, Shadcn UI
* **Real-time:** `socket.io-client`.

### 2.3. Main Backend (`apps/api`)
* **Framework:** NestJS.
* **Database ORM:** Prisma.
* **Database:** PostgreSQL
* **Cache & PubSub:** Redis

### 2.4. AI Service (`apps/ai-service`)
* **Language:** Python
* **Framework:** gRPC Server
* **Role:** Nhận text -> Trả về Vector Embedding hoặc Text Suggestion.

### 2.5. Infrastructure
* **Docker Compose:** Postgres, Redis, 3 Apps.
* **Deployment:** Có thể xin EC2 ECS cân nhắc sau

## 3. Possibility and Time
* Mỗi ngày 2 tiếng trong 2 tuần: 14h
* Làm có thể sẽ bị không hoàn thiện vì overengineering