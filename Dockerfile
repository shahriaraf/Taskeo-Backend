# Dockerfile — Taskeo Backend
# Multi-stage build: keeps the production image small and clean.

# ── Stage 1: Build ────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build


# ── Stage 2: Production image ─────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install PRODUCTION dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy Prisma schema (needed at runtime for migrations)
COPY prisma ./prisma

# Copy compiled output from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3000

# Run database migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
