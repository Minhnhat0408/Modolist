# Auth Flow — Giải thích cho Junior Developer

> Tài liệu này giải thích **toàn bộ flow đăng ký / đăng nhập** trong app, bao gồm lỗi thường gặp và nguyên nhân gốc rễ.

---

## Mục lục

1. [Khái niệm cần biết trước](#1-khái-niệm-cần-biết-trước)
2. [Flow đăng ký (Email/Password)](#2-flow-đăng-ký-emailpassword)
3. [Flow đăng nhập (Email/Password)](#3-flow-đăng-nhập-emailpassword)
4. [Flow đăng nhập Google OAuth](#4-flow-đăng-nhập-google-oauth)
5. [Middleware bảo vệ route](#5-middleware-bảo-vệ-route)
6. [Lỗi "An unexpected response was received"](#6-lỗi-an-unexpected-response-was-received)
7. [Session hoạt động như thế nào](#7-session-hoạt-động-như-thế-nào)
8. [Sơ đồ tổng hợp](#8-sơ-đồ-tổng-hợp)

---

## 1. Khái niệm cần biết trước

### Server Action là gì?

Trong Next.js 14+, **Server Action** là một function chạy **trên server** nhưng được gọi từ **form trên browser**.

```tsx
// actions.ts — "use server" → chạy trên server
"use server";
export async function authenticate(formData: FormData) {
  // code này chạy trên server, không phải browser
}

// signin/page.tsx — dùng trong form
<form action={dispatch}>  {/* dispatch = authenticate */}
  <input name="email" />
  <button type="submit">Đăng nhập</button>
</form>
```

Khi user click Submit:
1. Browser **POST** đến `/auth/signin` (URL của trang đó)
2. Next.js nhận POST → gọi Server Action `authenticate()`
3. Server Action chạy, trả về kết quả cho browser

> **Điểm quan trọng:** Server Action dùng **POST request** đến chính trang đó (`/auth/signin`), không phải đến một API route riêng.

### Cookie và Session

Supabase lưu thông tin đăng nhập vào **cookie** trong browser. Cookie này được gửi kèm trong mỗi request, server đọc cookie để biết user là ai.

```
Browser → [request + cookie] → Server → kiểm tra cookie → biết user là ai
```

### JWT Token

Sau khi đăng nhập, Supabase tạo ra một **JWT token** (chuỗi mã hóa chứa thông tin user). Token này được lưu trong cookie và có thời hạn (~1 giờ). Khi hết hạn, Supabase tự refresh bằng refresh token.

---

## 2. Flow đăng ký (Email/Password)

### Các file liên quan

```
src/app/auth/signup/page.tsx        ← UI form đăng ký (client component)
src/app/api/auth/signup/route.ts    ← API Route xử lý signup
```

### Flow từng bước

```
1. User điền form (tên, email, mật khẩu) → click "Đăng ký"
      ↓
2. signup/page.tsx gọi:
   fetch("/api/auth/signup", { method: "POST", body: JSON.stringify({email, password, name}) })
      ↓
3. /api/auth/signup/route.ts nhận request:
   supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      ↓
4. Supabase tạo user trong auth.users
   Database trigger tự chạy: INSERT INTO users (id, email, name, ...) ← sync sang bảng users
      ↓
5. *** QUAN TRỌNG *** Supabase TỰ ĐĂNG NHẬP user sau khi signUp()
   → Trả về session (JWT token + refresh token)
   → Session được ghi vào cookie của browser
      ↓
6. API route trả về { success: true }
      ↓
7. signup/page.tsx nhận response thành công:
   setSuccess(true)
   router.push("/dashboard")  ← đi thẳng vào dashboard (đã đăng nhập rồi)
```

### Tại sao redirect thẳng vào `/dashboard` chứ không về `/auth/signin`?

Vì ở bước 5, **Supabase tự đăng nhập user** ngay sau khi đăng ký thành công. Cookie đã có session. Nếu redirect về `/auth/signin`, middleware sẽ thấy user đã đăng nhập và **redirect ngay sang `/dashboard`** anyway — thừa một bước, dễ gây lỗi.

---

## 3. Flow đăng nhập (Email/Password)

### Các file liên quan

```
src/app/auth/signin/page.tsx        ← UI form đăng nhập (client component)
src/app/auth/signin/actions.ts      ← Server Actions (chạy trên server)
```

### Flow từng bước

```
1. User điền email + mật khẩu → click "Đăng nhập"
      ↓
2. Browser POST đến /auth/signin (Next.js Server Action protocol)
      ↓
3. Middleware (src/proxy.ts → lib/supabase/middleware.ts) chặn request:
   - Kiểm tra: isAuthPage = true (url bắt đầu bằng /auth)
   - Kiểm tra: user = null (chưa đăng nhập)
   - → Cho qua (pass through)
      ↓
4. Next.js gọi Server Action authenticate(formData):
   supabase.auth.signInWithPassword({ email, password })
      ↓
5. Supabase verify mật khẩu:
   ┌─ Sai → return "Email hoặc mật khẩu không đúng."
   └─ Đúng → tạo session, ghi vào cookie
      ↓
6. redirect("/dashboard") ← Next.js redirect, browser nhảy sang dashboard
```

### Tại sao form dùng Server Action thay vì fetch thông thường?

- **An toàn hơn:** Mật khẩu không bao giờ được xử lý ở client
- **Tích hợp tốt hơn với Next.js:** `useFormStatus()` hook tự biết khi nào form đang submit
- **Không cần thêm API route:** Server Action IS the backend logic

---

## 4. Flow đăng nhập Google OAuth

### Các file liên quan

```
src/app/auth/signin/page.tsx         ← Nút "Đăng nhập với Google"
src/app/auth/signin/actions.ts       ← authenticateWithGoogle() Server Action
src/app/auth/callback/route.ts       ← Xử lý khi Google redirect về
lib/supabase/middleware.ts           ← Refresh session
```

### Flow từng bước

```
1. User click "Đăng nhập với Google"
      ↓
2. Browser POST đến /auth/signin (Server Action)
      ↓
3. authenticateWithGoogle() chạy trên server:
   a. Đọc host từ header (x-forwarded-host) để biết đang ở domain nào
      - Local: http://localhost:3000
      - Production: https://modolist.vercel.app
   b. supabase.auth.signInWithOAuth({
        provider: "google",
        redirectTo: "https://modolist.vercel.app/auth/callback"
      })
   c. Supabase trả về URL của Google (ví dụ: https://accounts.google.com/o/oauth2/auth?...)
   d. redirect(googleUrl) → browser nhảy sang Google
      ↓
4. User thấy trang Google "Chọn tài khoản" / "Đồng ý cấp quyền"
      ↓
5. User đồng ý → Google redirect về:
   https://<project>.supabase.co/auth/v1/callback?code=xxx
      ↓
6. Supabase xử lý code từ Google:
   - Tạo/cập nhật user trong auth.users
   - Tạo session (JWT + refresh token)
   - Redirect tiếp về: https://modolist.vercel.app/auth/callback?code=xxx
      ↓
7. src/app/auth/callback/route.ts nhận request:
   supabase.auth.exchangeCodeForSession(code)
   → Lưu session vào cookie
   → redirect("/dashboard")
      ↓
8. Database trigger tự chạy nếu user mới:
   INSERT INTO users (id, email, name, image) ← sync thông tin Google profile
```

### Tại sao phải đọc host từ header thay vì dùng env var?

Server Action chạy trên Vercel serverless function. Nếu hardcode `NEXT_PUBLIC_SITE_URL`, sẽ bị sai trong các trường hợp:
- Preview deployments có URL khác nhau
- Local dev và production khác nhau

Đọc từ `x-forwarded-host` header → luôn đúng với domain đang chạy.

---

## 5. Middleware bảo vệ route

### File: `src/lib/supabase/middleware.ts`

Middleware chạy **trước tất cả các request**. Nhiệm vụ:

1. **Refresh session** — đọc cookie, gọi Supabase để verify + refresh JWT nếu sắp hết hạn
2. **Bảo vệ `/dashboard`** — nếu chưa đăng nhập và không phải guest → redirect về `/auth/signin`
3. **Redirect auth pages** — nếu đã đăng nhập mà vào `/auth/*` → redirect về `/dashboard`

### Quy tắc quan trọng: CHỈ redirect GET requests

```typescript
// ✅ ĐÚNG — chỉ redirect GET
if (isAuthPage && user && request.method === "GET") {
  return NextResponse.redirect("/dashboard");
}

// ❌ SAI — redirect mọi method
if (isAuthPage && user) {
  return NextResponse.redirect("/dashboard");  // sẽ phá Server Actions!
}
```

**Lý do:** Server Actions dùng POST request đến chính trang đó. Nếu middleware redirect POST → Server Action không nhận được response đúng → crash.

---

## 6. Lỗi "An unexpected response was received"

### Triệu chứng

```
Error: An unexpected response was received from the server.
Request URL: https://modolist.vercel.app/auth/signin
Request Method: POST
Status Code: 307 Temporary Redirect
```

### Nguyên nhân gốc rễ

Đây là lỗi **conflict giữa Server Action và Middleware redirect**.

```
Scenario: User vừa đăng ký xong → redirect về /auth/signin → nhập lại email/pass → submit

1. Sau khi signUp(), Supabase TỰ ĐĂNG NHẬP → cookie có session
2. User được redirect về /auth/signin (code cũ, bug)
3. User thấy form signin, nhập email/pass → click submit
4. Browser POST đến /auth/signin
5. Middleware chạy:
   - isAuthPage = true (/auth/signin)
   - user = đã có session (từ bước 1)
   → redirect đến /dashboard (307)
6. Browser nhận 307 từ một POST request
7. Server Action nhận được redirect thay vì kết quả → "An unexpected response"
```

### Timeline đầy đủ

```
signUp() → [Supabase tự đăng nhập] → cookie có session
    ↓
router.push("/auth/signin")   ← BUG: user đã đăng nhập rồi!
    ↓
Middleware nhìn thấy: user có session + đang ở /auth/*
    ↓
User submit form → POST /auth/signin
    ↓
Middleware: "user đã đăng nhập + ở /auth/* → redirect 307"
    ↓
Server Action nhận 307 thay vì kết quả → CRASH
```

### Cách fix

**Fix 1 — Middleware:** Chỉ redirect GET, không redirect POST:
```typescript
// Thêm && request.method === "GET"
if (isAuthPage && user && request.method === "GET") {
  return redirect("/dashboard");
}
```

**Fix 2 — Signup page:** Đừng redirect về signin sau khi đăng ký — redirect thẳng vào dashboard:
```typescript
// Trước (sai)
router.push("/auth/signin");

// Sau (đúng)
router.push("/dashboard");  // user đã đăng nhập rồi, đi thẳng vào
```

Cần **cả hai fix** — Fix 1 là safety net cho mọi tình huống tương tự, Fix 2 là UX đúng đắn.

---

## 7. Session hoạt động như thế nào

### JWT Cookie lifecycle

```
Đăng nhập thành công
    ↓
Supabase tạo 2 tokens:
  - access_token (JWT): hết hạn sau ~1 giờ
  - refresh_token: dùng để lấy access_token mới, hết hạn sau nhiều ngày
    ↓
Cả hai được lưu vào cookie của browser
    ↓
Mỗi request:
  Middleware đọc cookie → gọi supabase.auth.getUser()
  Nếu access_token sắp hết hạn → Supabase tự dùng refresh_token lấy token mới
  → Ghi token mới vào cookie response
    ↓
Sau vài ngày không dùng → refresh_token hết hạn → bị đăng xuất
```

### Tại sao Server Components đọc được session?

Server Components chạy trên server → có thể đọc cookie từ request headers → `createClient()` đọc cookie → biết user là ai.

```typescript
// Server Component hoặc API Route
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
// user là user đang đăng nhập, hoặc null nếu chưa đăng nhập
```

### Tại sao Client Components đọc được session?

Client Components dùng `createBrowserClient` → tự đọc cookie từ browser → reactive (tự update khi session thay đổi).

```typescript
// Client Component
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();
```

---

## 8. Sơ đồ tổng hợp

### Đăng ký Email

```
[signup/page.tsx]
User điền form → click Đăng ký
    ↓ fetch POST /api/auth/signup
[api/auth/signup/route.ts]
supabase.auth.signUp()
    ↓ thành công
Supabase tự đăng nhập → cookie có session
    ↓ trả về { success: true }
[signup/page.tsx]
router.push("/dashboard")  ← thẳng vào dashboard
    ↓ GET /dashboard
[middleware]
user có session → cho qua
    ↓
[dashboard/page.tsx] hiển thị
```

### Đăng nhập Email

```
[signin/page.tsx]
User điền form → click Đăng nhập
    ↓ POST /auth/signin (Server Action)
[middleware]
method = POST → KHÔNG redirect → cho qua ✓
    ↓
[signin/actions.ts] authenticate()
supabase.auth.signInWithPassword()
    ↓ thành công
cookie được set với session
    ↓
redirect("/dashboard")
    ↓ GET /dashboard
[middleware]
user có session + GET request → cho qua
    ↓
[dashboard/page.tsx] hiển thị
```

### Đăng nhập Google

```
[signin/page.tsx]
User click "Google" → POST /auth/signin (Server Action)
    ↓
[middleware] method=POST → cho qua
    ↓
[signin/actions.ts] authenticateWithGoogle()
supabase.auth.signInWithOAuth() → lấy URL Google
    ↓
redirect(googleUrl)
    ↓ Browser sang Google
User đồng ý cấp quyền
    ↓ Google redirect về Supabase
    ↓ Supabase redirect về /auth/callback?code=xxx
[auth/callback/route.ts]
exchangeCodeForSession(code) → cookie được set
    ↓
redirect("/dashboard")
    ↓
[dashboard/page.tsx] hiển thị
```

### Lỗi 307 (đã fix)

```
[TRƯỚC KHI FIX — BUG]

signUp() → Supabase tự đăng nhập → cookie CÓ session
    ↓
router.push("/auth/signin")  ← BUG: nên đi dashboard
    ↓ GET /auth/signin
[middleware] user có session + GET → redirect /dashboard ✓
    ↓
User vào dashboard nhưng thỉnh thoảng session chưa kịp set
    ↓
User thấy form signin → nhập lại → click submit
    ↓ POST /auth/signin
[middleware] user có session + isAuthPage → redirect 307 ← BUG
    ↓
Server Action nhận 307 thay vì kết quả → CRASH 💥

[SAU KHI FIX]

signUp() → router.push("/dashboard") → không bao giờ quay lại /auth/signin
Middleware chỉ redirect GET → POST Server Actions không bao giờ bị chặn
```
