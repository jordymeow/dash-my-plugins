# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start the Next.js development server
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server (uses PORT env variable, defaults to 3000)
- `pnpm lint` - Run ESLint for code linting

### Setup
1. Install dependencies: `pnpm install`
2. Configure `.env` file with plugin slugs: `PLUGINS = "plugin-slug-1, plugin-slug-2"`
3. Start development server: `pnpm dev`

### Deployment (Coolify)
- Build Docker image: `docker build -t dash-my-plugins .`
- Run locally: `docker run -p 3000:3000 --env-file .env dash-my-plugins`
- Health check endpoint: `/api/health`

## Architecture

This is a **Next.js 13 static site** that displays WordPress plugin statistics without a database. The application fetches plugin data from the WordPress.org API.

### Key Components

- `pages/index.js`: compact desktop card board and browser-local release policy; no filters or CSV.
- `components/HealthCard.js`: release age, prominent open-thread count, priority action, and change vs. last year.
- `components/BaselineChart.js`: quiet floor per 4-week block, last year (solid) over the year before (dashed).
- `components/PluginDetail.js`: full assessment and uncapped raw download history.
- `libs/dashboard.js`: bounded API loading, caching, and serializable dashboard snapshots.
- `libs/snapshot-cache.mjs`: 15-minute memory/disk cache, deduplication, and stale recovery.
- `libs/requests.js`: native HTTPS requests with timeout cleanup and one retry.
- `libs/health.mjs`: release policy, and the year-over-year quiet-floor trend with its portfolio median.
- `libs/metrics.mjs`: date parsing, download windows, chart aggregation, and formatting.
- `pages/api/dashboard.js`: refresh endpoint; failed refreshes preserve the previous UI snapshot.
- `styles/globals.css`: responsive board and dialog styling.

### Data accuracy

Downloads include updates, not just new installs. Active installs are rounded lower
bounds and can overlap across plugins. Support is unresolved topics within the API's
reporting window, not necessarily unanswered requests. Missing data must remain
unknown, never zero. Do not invent historical active-install data or release dates.

See README.md for the trend method and its limits. Run
`node --test tests/*.test.mjs` when changing calculations.
