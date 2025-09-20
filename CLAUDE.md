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

- **Pages**: Static site generation using `getStaticProps`
  - `pages/index.js` - Main dashboard displaying all plugins
  - `pages/_app.js`, `pages/_document.js` - Next.js app configuration

- **Data Fetching**: `libs/requests.js`
  - Fetches plugin info, download stats, and active installations from WordPress.org API
  - Aggregates data by month for charts
  - All API calls go through `https://api.wordpress.org`

- **Components**:
  - `components/PluginCard.js` - Displays individual plugin statistics

- **Styling**: CSS Modules in `styles/` directory
  - `Card.module.css` - Plugin card styling
  - `globals.css` - Global styles

### Data Flow

1. Plugin slugs are read from `PLUGINS` environment variable in `.env.local`
2. At build time, `getStaticProps` fetches data for each plugin from WordPress.org API
3. Data includes: version info, ratings, download stats, active installs, support threads
4. Charts use Recharts library for data visualization
5. Dates are handled with DayJS library

### WordPress.org API Integration

The app fetches:
- Plugin metadata: `/plugins/info/1.2/`
- Download statistics: `/stats/plugin/1.0/downloads.php`
- Active installation history: `/stats/plugin/1.0/active-installs.php`
- Latest WordPress version: `/core/version-check/1.7/`