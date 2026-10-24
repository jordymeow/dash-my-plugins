# Build stage
FROM node:20-alpine AS builder

# Pin the package manager used by both stages for repeatable deployments.
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Approve only the locked resolver's native-binding check used by ESLint.
RUN pnpm install --frozen-lockfile --allow-build=unrs-resolver@1.11.1

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

# Configure DNS to prefer IPv4 (fixes Node.js fetch timeouts)
RUN echo 'precedence ::ffff:0:0/96  100' >> /etc/gai.conf

# Install pnpm for runtime
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate

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

# The application keeps its last complete upstream snapshot across restarts.
RUN mkdir -p /app/.cache && chown nextjs:nodejs /app/.cache

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
