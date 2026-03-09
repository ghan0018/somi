# somi-clinic-web

Therapist/admin web application for the SOMI treatment platform. Built with React, TypeScript, and Vite.

## Prerequisites

- **Node.js** >= 20
- npm (ships with Node)
- **somi-connect** running locally (the backend API, default `http://localhost:3000`)

## Setup

From the **repo root** (`somi/`):

```bash
# Install all workspace dependencies (if you haven't already)
npm install
```

No `.env` file is needed for the frontend at this point. When API integration is added, a `VITE_API_URL` variable will likely be introduced.

## Running

```bash
# From repo root
npm run dev -w apps/somi-clinic-web

# Or from this directory
npm run dev
```

This starts the Vite dev server on `http://localhost:5173` with hot module replacement (HMR). Edits to source files are reflected instantly in the browser without a full reload.

## Running the Full Stack

To work on the full app locally you need both services running. Open two terminals:

```bash
# Terminal 1 — backend API
npm run dev -w services/somi-connect

# Terminal 2 — frontend
npm run dev -w apps/somi-clinic-web
```

The backend runs on port 3000 and the frontend on port 5173.

## Available Scripts

| Script | Command | What it does |
|---|---|---|
| `dev` | `vite` | Dev server with HMR on port 5173 |
| `build` | `tsc && vite build` | Type-check then build for production |
| `preview` | `vite preview` | Serve the production build locally |
| `test` | `vitest` | Run tests (watch mode by default) |
| `lint` | `eslint src --ext .ts,.tsx` | Lint source files |
| `typecheck` | `tsc --noEmit` | Type-check without emitting |

## Project Structure

```
src/
├── main.tsx    # React entry point (renders into #root)
└── App.tsx     # Root component
```

The frontend is in early development. As features are built out, expect the typical structure:

```
src/
├── main.tsx
├── App.tsx
├── api/          # API client & hooks
├── components/   # Shared UI components
├── pages/        # Route-level page components
├── context/      # React context providers
├── types/        # TypeScript interfaces
└── utils/        # Helpers
```

## Tech Stack

- **React 18** with `react-router-dom` v6 for routing
- **Vite** for dev server and production builds
- **TypeScript** (strict mode via shared `tsconfig.base.json`)
- **Vitest** + **Testing Library** for unit/component tests
