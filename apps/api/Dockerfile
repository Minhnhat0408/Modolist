FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/database/src ./packages/database/src
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile
RUN cd packages/database && npx prisma generate
RUN pnpm turbo build --filter=api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy entire workspace — pnpm uses symlinks that break if copied piecemeal
COPY --from=builder /app .
EXPOSE 3001
CMD cd /app/packages/database && npx prisma migrate deploy && cd /app && node apps/api/dist/main.js
