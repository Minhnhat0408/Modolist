FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile
WORKDIR /app/apps/api
RUN rm -f prisma.config.ts
RUN npx prisma generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=development
COPY --from=builder /app .
WORKDIR /app/apps/api
EXPOSE 3001
CMD npx prisma migrate deploy && cd /app && pnpm dev --filter=api
