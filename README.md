# Dash My Plugins

A very simple dashboard which displays information about defined WordPress plugins. Built with Next.js and doesn't require any database.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) package manager
- Docker (for containerized deployment)

## Installation

1. Install dependencies:
```sh
pnpm install
```

2. Configure plugins in `.env` file:
```sh
cp .env.example .env
# Edit .env and add your plugin slugs
```

3. Start development server:
```sh
pnpm dev
```

## Deployment with Coolify

This project is configured for deployment with Coolify:

1. **Push to GitHub** - Commit and push your changes
2. **Configure in Coolify:**
   - Build Pack: Docker
   - Port: 3000
   - Health Check Path: `/api/health`
3. **Set Environment Variables:**
   - Add `PLUGINS` variable with your plugin slugs
4. **Deploy** - Coolify will build and deploy automatically

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Docker Support

Build and run locally:
```sh
docker build -t dash-my-plugins .
docker run -p 3000:3000 --env-file .env dash-my-plugins
```

## Environment Variables

- `PLUGINS` - Comma-separated list of WordPress plugin slugs to track
- `PORT` - Server port (default: 3000)