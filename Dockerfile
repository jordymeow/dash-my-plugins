# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Accept build arguments and set as environment variables for build
ARG PLUGINS
ARG SITE_NAME
ENV PLUGINS=${PLUGINS}
ENV SITE_NAME=${SITE_NAME}

# Build the application
RUN pnpm build

# Runtime stage
FROM node:20-alpine AS runner

# Install ca-certificates for HTTPS requests
RUN apk add --no-cache ca-certificates

# Install pnpm for runtime
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set runtime environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["pnpm", "start"]