# Initial Setup - Push to GitHub

Checklist trước khi tạo Pull Request đầu tiên.

---

## ✅ Step 1: Install Dependencies (5 min)

```bash
# From project root
cd /Users/nguyen.nhat.minhb/Code/todolist

# Install Node dependencies
pnpm install

# Install Python dependencies
cd apps/ai-service
pip3 install -r requirements.txt
cd ../..
```

**Expected output:**
```
✓ Installing dependencies...
✓ Packages: +XXX
✓ Done in XXs
```

---

## ✅ Step 2: Setup NeonDB (10 min)

### 2.1. Create NeonDB Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign in with GitHub (recommended)
3. Click **"New Project"**
   - Name: `todolist` or `co-focus-space`
   - Region: Choose closest to you
   - Postgres version: 16 (default)
4. Wait for project creation (~30 seconds)

### 2.2. Enable pgvector Extension

```sql
-- In NeonDB SQL Editor (dashboard → SQL Editor)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Expected:** Should show 1 row with `vector` extension.

### 2.3. Get Connection String

1. In NeonDB dashboard, go to **"Connection Details"**
2. Copy the connection string (format: `postgresql://user:pass@ep-xxx.neon.tech/...`)
3. **Important:** Keep this private! Don't commit to Git.

---

## ✅ Step 3: Configure Environment Variables (5 min)

### 3.1. API Environment

```bash
cd apps/api
cp .env.example .env
```

Edit `apps/api/.env`:
```env
DATABASE_URL="postgresql://[YOUR_NEON_CONNECTION_STRING]"
REDIS_URL="redis://localhost:6379"
GEMINI_API_KEY="[Get from https://aistudio.google.com/apikey]"
NEXTAUTH_SECRET="[Generate with: openssl rand -base64 32]"
NEXTAUTH_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"
```

### 3.2. Web Environment

```bash
cd ../web
cp .env.example .env.local
```

Edit `apps/web/.env.local`:
```env
DATABASE_URL="[Same as API]"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[Same as API]"
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# Google OAuth (optional for now - can add later)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

### 3.3. AI Service Environment

```bash
cd ../ai-service
cp .env.example .env
```

Edit `apps/ai-service/.env`:
```env
GEMINI_API_KEY="[Same as API]"
PORT=50051
GEMINI_MODEL="gemini-1.5-flash"
```

---

## ✅ Step 4: Initialize Prisma (5 min)

```bash
cd /Users/nguyen.nhat.minhb/Code/todolist/apps/api

# Generate Prisma Client (TypeScript types)
pnpm db:generate

# Push schema to NeonDB
pnpm db:push

# Verify with Prisma Studio
pnpm db:studio
```

**Open browser:** http://localhost:5555

**You should see:**
- ✅ All 9 tables created
- ✅ Empty data (no users yet)

**Test query in Studio:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should return: `users`, `tasks`, `posts`, `post_images`, etc.

---

## ✅ Step 5: Verify Build (5 min)

```bash
cd /Users/nguyen.nhat.minhb/Code/todolist

# Lint all code
pnpm lint

# Type check
pnpm check-types

# Build all apps
pnpm build
```

**Expected:**
```
✓ api:build: Successfully compiled
✓ web:build: Compiled successfully
✓ ai-service:build: echo 'Python app - no build needed'
```

---

## ✅ Step 6: Create GitHub Repository (10 min)

### 6.1. Create Private Repo

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `todolist` or `co-focus-space`
3. **Visibility:** ✅ **Private**
4. **DON'T** initialize with README (you already have one)
5. Click **"Create repository"**

### 6.2. Add Collaborator (bs90)

1. Go to repo **Settings → Collaborators**
2. Click **"Add people"**
3. Enter username: `bs90`
4. Send invitation

### 6.3. Push Code

```bash
cd /Users/nguyen.nhat.minhb/Code/todolist

# Initialize git (if not done)
git init

# Add remote
git remote add origin git@github.com:YOUR_USERNAME/todolist.git

# Create main branch
git branch -M main

# Stage all files
git add .

# First commit
git commit -m "chore: initial setup with Prisma schema and dependencies"

# Push to GitHub
git push -u origin main
```

---

## ✅ Step 7: Verify CI/CD (5 min)

### 7.1. Check GitHub Actions

1. Go to your repo on GitHub
2. Click **"Actions"** tab
3. You should see workflow running

**Wait 2-3 minutes for completion.**

### 7.2. If CI Fails

**Common issues:**

**Issue 1: Prisma generate fails**
```bash
# Locally, run:
cd apps/api
pnpm db:generate
git add -A
git commit -m "fix: add generated Prisma client"
git push
```

**Issue 2: Type errors**
```bash
# Check errors:
pnpm check-types

# Fix and commit
git add -A
git commit -m "fix: resolve type errors"
git push
```

**Issue 3: Linting errors**
```bash
# Auto-fix:
pnpm lint --fix

# Commit:
git add -A
git commit -m "fix: lint errors"
git push
```

---

## ✅ Step 8: Create GitHub Issues (15 min)

### 8.1. Enable Issues

1. Go to repo **Settings → Features**
2. Ensure **"Issues"** is checked ✅

### 8.2. Create Issue Template

Create `.github/ISSUE_TEMPLATE/task.md`:

```markdown
---
name: Development Task
about: Track development work (<6h per issue)
labels: task
---

## Task: [Title]

**Type:** Infrastructure | Backend | Frontend | Testing | Documentation
**Estimated Time:** Xh (max 6h)
**Priority:** P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)
**Day:** [Day 1-7]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Implementation Notes
(Add technical details as you work)

### Related PR
#XX (link when PR created)

### Time Tracking
- Estimated: Xh
- Actual: Xh
```

### 8.3. Create Initial Issues

**Issue #1: Day 1 - Infrastructure Setup**
```markdown
## Task: Setup Infrastructure & Dependencies

**Type:** Infrastructure
**Estimated Time:** 2h
**Priority:** P0
**Day:** Day 1

### Acceptance Criteria
- [x] NeonDB connected with pgvector
- [x] Prisma schema pushed
- [x] All dependencies installed
- [x] Environment variables configured
- [x] CI/CD passing

### Deliverable
- Initial codebase ready for development
- Database schema deployed
```

**Issue #2: Day 2 - Task Management API**
```markdown
## Task: Implement Task CRUD API

**Type:** Backend
**Estimated Time:** 2h
**Priority:** P0
**Day:** Day 2

### Acceptance Criteria
- [ ] TasksModule created (NestJS)
- [ ] CRUD endpoints implemented
- [ ] Prisma integration working
- [ ] Status transitions (BACKLOG → TODAY → DONE)
- [ ] Manual testing with Thunder Client

### Deliverable
- Working Task API
```

**Continue creating issues for Days 3-7** (see [PLANNING.md](../PLANNING.md))

---

## ✅ Step 9: Final Checklist

Before inviting `bs90` to review:

- [ ] ✅ Private repo created
- [ ] ✅ `bs90` invited as collaborator
- [ ] ✅ Initial commit pushed
- [ ] ✅ CI/CD passing (green checkmark)
- [ ] ✅ README.md updated with project info
- [ ] ✅ Issues created for all 7 days
- [ ] ✅ `.env` files in `.gitignore` (NOT committed)
- [ ] ✅ Prisma schema documented
- [ ] ✅ No sensitive data in repo

---

## 🚀 Next Steps

**Day 1 starts now!**

1. Create branch for Day 1:
   ```bash
   git checkout -b feat/day-1-infrastructure
   ```

2. Start working on Issue #1

3. When done, create Pull Request:
   ```bash
   git add .
   git commit -m "feat: complete Day 1 - infrastructure setup"
   git push origin feat/day-1-infrastructure
   ```

4. On GitHub: Create PR → Link to Issue #1 → Request review from `bs90`

---

## 📝 Git Workflow

**Branch naming:**
- `feat/day-X-feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/update-readme` - Documentation
- `chore/update-deps` - Maintenance

**Commit messages:**
```bash
# Format: type(scope): message

feat(api): add task CRUD endpoints
fix(web): resolve Kanban drag & drop bug
docs(readme): update setup instructions
chore(deps): upgrade Prisma to v6.2.1
test(api): add task service unit tests
```

**Pull Request template:**

```markdown
## Description
Brief description of changes

## Related Issue
Closes #XX

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Reviewed own code

## Screenshots (if UI changes)
[Add screenshots]
```

---

## 🆘 Troubleshooting

### Git push rejected

```bash
# If you see "remote contains work that you do not have locally"
git pull origin main --rebase
git push origin main
```

### Can't connect to NeonDB

1. Check connection string format
2. Ensure `?sslmode=require` is in URL
3. Test with Prisma Studio: `pnpm db:studio`

### CI failing on Prisma

```bash
# Regenerate client
cd apps/api
pnpm db:generate

# Commit generated files
git add prisma/
git add node_modules/.prisma/  # Only if needed
git commit -m "chore: update Prisma client"
git push
```

### OrbStack not running

```bash
orbstack status
open -a OrbStack
docker ps
```

---

## ✅ You're Ready!

Repo structure is complete. Time to start coding! 🚀

See [PLANNING.md](../PLANNING.md) for Day 1 tasks.
