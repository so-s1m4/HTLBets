# HTLBets

HTLBets is a school project: a demo-only mini-game platform for HTL students built with Angular, Express, Socket.io, PostgreSQL, and Prisma.  
The platform uses virtual credits only. There are no real-money payments, deposits, withdrawals, or gambling features.

## Current Scope

Implemented modules:

- school-email based authentication
- first login by verification code, later password login
- profile with username and avatar support
- daily rewards and personal game history
- leaderboard views
- card deck ownership and deck selection
- realtime roulette
- blackjack
- multiplayer poker with public and private tables
- miner
- crash
- slots
- admin area with user search, balance changes, deck granting, deck management, banning, wipe, and deletion

## Tech Stack

- `client`: Angular 21
- `server`: Express + TypeScript
- realtime: Socket.io
- database: PostgreSQL
- ORM: Prisma
- local development orchestration: npm workspaces + Docker Compose

## Repository Structure

```text
.
├── client/               # Angular frontend
├── server/               # Express backend, Prisma schema, game engines
├── projektmanagement/    # project documents
├── scripts/              # shared dev bootstrap scripts
└── README.md
```

## Local Development

### Requirements

- Node.js
- npm
- Docker Desktop or Docker Engine for the default local PostgreSQL setup

### Start

```bash
npm install
npm run dev
```

`npm run dev` automatically:

- creates `.env.docker` from `.env.docker.example` if missing
- syncs shared local development values
- starts PostgreSQL through Docker Compose when needed
- runs Prisma generate and `migrate deploy`
- starts backend and frontend in parallel

Default local URLs:

- frontend: `http://localhost:4200`
- backend API: `http://localhost:4201/api`
- websocket endpoint: `http://localhost:4201/socket.io`

## Build and Test

```bash
npm run build
npm run test
```

Useful workspace commands:

```bash
npm run build --workspace server
npm run build --workspace client
npm run test --workspace server
npm run test --workspace client
npm run prisma:migrate
npm run prisma:studio
```

## Docker

```bash
cp .env.docker.example .env.docker
npm run docker:up
```

Other helper commands:

```bash
npm run docker:down
npm run docker:logs
```

## Environment

The project uses `.env.docker` as the shared environment file.

Important values:

- `DEV_CLIENT_PORT`
- `DEV_SERVER_PORT`
- `POSTGRES_PUBLISHED_PORT`
- `DATABASE_URL`
- `CLIENT_ORIGIN`
- `DEBUG_AUTH`

`DEBUG_AUTH=true` is useful for local demo flows where email delivery should be bypassed.

## Authentication Flow

1. User enters a valid school email address.
2. Backend decides whether the account uses code or password login.
3. On first login, the user verifies by email code.
4. After verification, the user can set a password.
5. Later logins can use password auth directly.

Admin routes are protected separately and require an account whose email is configured as admin.

## Main API Areas

### Auth

- `POST /api/auth/begin`
- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/login-password`
- `POST /api/auth/set-password`

### User

- `GET /api/me`
- `PATCH /api/me/profile`
- `GET /api/history`
- `GET /api/me/dailies`
- `POST /api/me/dailies/:taskKey/claim`
- `GET /api/me/card-decks`
- `POST /api/me/card-decks/:deckId/purchase`
- `POST /api/me/card-decks/:deckId/select`
- `GET /api/leaderboard`

### Admin

- `GET /api/admin/users`
- `GET /api/admin/users/:userId/history`
- `PATCH /api/admin/users/:userId/balance`
- `POST /api/admin/users/:userId/ban`
- `POST /api/admin/users/:userId/wipe`
- `DELETE /api/admin/users/:userId`
- `GET /api/admin/users/:userId/card-decks`
- `POST /api/admin/users/:userId/card-decks/:deckId/grant`
- `GET /api/admin/card-decks`
- `POST /api/admin/card-decks/import`
- `POST /api/admin/card-decks/:deckId/default`

## Notes

- all game results and balance changes are validated on the backend
- suspended users are blocked on both REST and websocket access
- this is a teaching/demo project, not a production betting platform

## Project Documents

Project-management files are in [projektmanagement/README.md](/Users/maksym/Documents/Programming/Projects/HTLBets/projektmanagement/README.md).

Technical API reference is available in [API.md](/Users/maksym/Documents/Programming/Projects/HTLBets/API.md).
