# somi-connect

Backend REST API for the SOMI treatment platform. Built with Express, TypeScript, and MongoDB.

## Prerequisites

- **Node.js** >= 20
- **MongoDB** running locally (or a remote URI)
- npm (ships with Node)

## Setup

From the **repo root** (`somi/`):

```bash
# Install all workspace dependencies
npm install

# Create your local env file
cp .env.example .env
```

Edit `.env` with real values. The required variables are:

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | yes | — | `development`, `staging`, or `production` |
| `PORT` | no | `3000` | HTTP listen port |
| `MONGODB_URI` | yes | — | MongoDB connection string (e.g. `mongodb://localhost:27017/somi_dev`) |
| `JWT_ACCESS_SECRET` | yes | — | Signing key for access tokens |
| `JWT_REFRESH_SECRET` | yes | — | Signing key for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | no | `3600` | Access token TTL in seconds |
| `JWT_REFRESH_EXPIRES_IN` | no | `604800` | Refresh token TTL in seconds |
| `AWS_REGION` | no | — | AWS region for S3 uploads |
| `AWS_S3_LIBRARY_BUCKET` | no | — | S3 bucket for exercise media |
| `AWS_S3_PATIENT_BUCKET` | no | — | S3 bucket for patient uploads (PHI) |

The app validates required env vars at startup and will crash immediately with a clear message if any are missing.

## Running

```bash
# From repo root
npm run dev -w services/somi-connect

# Or from this directory
npm run dev
```

This starts `ts-node-dev` with hot-reload on `http://localhost:3000`. Changes to any `.ts` file in `src/` will automatically restart the server.

## Available Scripts

| Script | Command | What it does |
|---|---|---|
| `dev` | `ts-node-dev --respawn --transpile-only src/index.ts` | Dev server with hot-reload |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run compiled JS (for production) |
| `test` | `jest` | Run test suite |
| `lint` | `eslint src --ext .ts` | Lint source files |
| `typecheck` | `tsc --noEmit` | Type-check without emitting |

## Project Structure

```
src/
├── index.ts              # Entry point — loads env, connects DB, starts server
├── app.ts                # Express app setup & middleware stack
├── config/
│   └── env.ts            # Env var validation & typed config export
├── lib/
│   ├── db.ts             # MongoDB connect/disconnect
│   ├── logger.ts         # Structured JSON logger (stdout/stderr)
│   └── errors.ts         # AppError class & error factories
├── middleware/            # Express middleware
│   ├── authenticate.ts   # JWT verification
│   ├── authorize.ts      # Role-based access control
│   ├── auditLog.ts       # Compliance audit trail
│   ├── correlationId.ts  # Request tracing IDs
│   ├── requestLogger.ts  # Structured request logging
│   ├── rateLimiter.ts    # Rate limiting
│   ├── errorHandler.ts   # Central error handler
│   └── notFound.ts       # 404 handler
├── models/               # Mongoose schemas & models
├── routes/               # Express route handlers (mounted at /v1)
├── services/             # Business logic layer
├── types/                # TypeScript type augmentations
└── __tests__/            # Integration tests
```

## API Overview

All authenticated routes are versioned under `/v1`. Key endpoint groups:

- `POST /v1/auth/login` — Authenticate (HTTP Basic -> JWT)
- `POST /v1/auth/refresh` — Refresh access token
- `/v1/exercises` — Exercise library CRUD
- `/v1/clinic/patients` — Patient management
- `/v1/clinic/patients/:id/treatment-plans` — Treatment plans
- `/v1/clinic/patients/:id/completions` — Completion events
- `/v1/clinic/patients/:id/adherence` — Adherence metrics
- `/v1/clinic/patients/:id/messages` — Messaging
- `/v1/clinic/patients/:id/feedback` — Feedback
- `/v1/clinic/patients/:id/notes` — Clinical notes
- `/v1/uploads` — S3 pre-signed URL generation
- `/v1/admin/*` — User management, taxonomy, audit logs

Health check is at `GET /` (no auth required).

## Testing

Tests use Jest with `mongodb-memory-server` (an in-memory MongoDB instance — no external DB needed).

```bash
npm test -w services/somi-connect
```

## Roles

Three user roles with hierarchical access:

- **client** — Patients; access to own data only
- **therapist** — Clinicians; access to assigned patients
- **admin** — Full system access
