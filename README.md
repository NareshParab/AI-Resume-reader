# Gcarbon Resume AI

AI-powered resume analysis platform — TypeScript monorepo.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| API | Express 4 + TypeScript |
| Worker | Node.js + TypeScript |
| Styling | Tailwind CSS v3 |
| Validation | Zod |
| Database | MongoDB Atlas / MongoDB Node.js Driver |
| Monorepo | npm Workspaces |

## Project Structure

```
apps/web/          React frontend
apps/api/          Express API
workers/           Background worker scaffold
packages/types/    Shared TypeScript types
packages/schemas/  Shared Zod schemas
packages/config/   Shared configuration
docs/              Project documentation
```

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 10
- A MongoDB Atlas free cluster

### Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set `MONGODB_URI` and `MONGODB_DB_NAME`.

### Run

```bash
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:4000
Health: http://localhost:4000/api/v1/health

No Docker or local PostgreSQL installation is required.
