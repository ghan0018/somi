# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files first for dependency resolution
COPY package.json package-lock.json tsconfig.base.json ./
COPY services/somi-connect/package.json ./services/somi-connect/

# Install all workspace dependencies (needed for TypeScript compilation)
RUN npm ci --workspace=services/somi-connect

# Copy backend source
COPY services/somi-connect/ ./services/somi-connect/

# Build (tsc compiles to services/somi-connect/dist/)
RUN npm run build --workspace=services/somi-connect

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S somi && adduser -S somi -u 1001 -G somi

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY services/somi-connect/package.json ./services/somi-connect/

# Install production dependencies only
RUN npm ci --workspace=services/somi-connect --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/services/somi-connect/dist ./services/somi-connect/dist

# Switch to non-root user
USER somi

# Health check for ECS/ALB
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

EXPOSE 3000

CMD ["node", "services/somi-connect/dist/index.js"]
