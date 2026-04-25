# HTL Bets Mini Games

Demo-only mobile-first mini-game platform built as a monorepo with Angular, Express, Socket.io, PostgreSQL, and Prisma.

This project intentionally does **not** implement:

- Real-money gambling
- Payments
- Withdrawals
- Monetary betting

It uses demo credits only.

## Stack

- Frontend: Angular + SCSS
- Backend: Node.js + Express.js + TypeScript
- Realtime: Socket.io
- Database: PostgreSQL
- ORM: Prisma
- Email: Nodemailer via Mailcow SMTP
- Auth: email + 6-digit verification code + JWT

## Monorepo Layout

```text
.
├── client
│   ├── public
│   ├── scripts
│   └── src/app
│       ├── core
│       ├── features
│       ├── layout
│       └── shared
├── server
│   ├── prisma
│   └── src
│       ├── config
│       ├── middleware
│       ├── modules
│       │   ├── auth
│       │   ├── email
│       │   ├── games
│       │   ├── users
│       │   └── websocket
│       ├── prisma
│       └── utils
└── package.json
```

## Features

- Email login with 6-digit verification code
- Verification code hashing + expiry handling
- Mail delivery through Mailcow SMTP
- Login restricted to `@htlstp.at` addresses without `+tags`
- JWT-protected REST API and Socket.io auth
- Demo balance system starting at `1000` credits
- Server-authoritative roulette, blackjack, and poker placeholder logic
- Game history tracking in PostgreSQL
- Mobile-first dark UI with reusable Angular components

## Environment Setup

### Server

Copy [server/.env.example](/Users/maksym/Documents/Programming/Projects/HTLBets/server/.env.example) to `server/.env` and adjust values.

Important variables:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/htl_bets`
- `JWT_SECRET=...`
- `TRUST_PROXY=false`
- `MAIL_HOST=mail.your-domain.tld`
- `MAIL_PORT=587`
- `MAIL_SECURE=false`
- `MAIL_USER=...`
- `MAIL_PASS=...`
- `MAIL_FROM=no-reply@minigames.local`
- `MAIL_DEBUG_BCC=` optional mailbox for receiving a copy of every verification email during development

### Client

Copy [client/.env.example](/Users/maksym/Documents/Programming/Projects/HTLBets/client/.env.example) to `client/.env`.

Defaults are already set for local development:

- `CLIENT_API_URL=/api`
- `CLIENT_SOCKET_URL=` which falls back to the current origin

The client runtime config is generated into `client/public/app-config.js`.

## Local Services

You need these running locally before development:

1. PostgreSQL with a database matching `DATABASE_URL`
2. Mailcow SMTP configured in `server/.env`

## Install

```bash
npm install
```

## Unit Tests

Run the deterministic unit-test suite for both workspaces:

```bash
npm run test
```

Workspace-specific commands:

- `npm run test --workspace server`
- `npm run test --workspace client`

The repository also includes a GitHub Actions workflow in [.github/workflows/ci.yml](/Users/maksym/Documents/Programming/Projects/HTLBets/.github/workflows/ci.yml) that runs Prisma client generation, unit tests, both production builds, and a Docker image build on every push and pull request.

## Portainer Deploy Hook

If you deploy the stack through Portainer GitOps, the repository also includes [deploy-portainer.yml](/Users/maksym/Documents/Programming/Projects/HTLBets/.github/workflows/deploy-portainer.yml).

It triggers the Portainer stack webhook:

- automatically after the `CI` workflow finishes successfully for `main`
- manually from GitHub Actions via `workflow_dispatch`

Do not hardcode the webhook URL into the repository. Store it as a GitHub Actions secret:

- secret name: `PORTAINER_WEBHOOK_URL`

Using your provided Portainer endpoint, the secret value should be:

```text
https://portainer.s1m4.me/api/stacks/webhooks/77085793-7180-42d3-9726-d464b259bd6a
```

In GitHub:

1. Open the repository.
2. Go to `Settings -> Secrets and variables -> Actions`.
3. Create a new repository secret named `PORTAINER_WEBHOOK_URL`.
4. Paste the webhook URL as the secret value.

After that, every green `CI` run for `main` will trigger Portainer to refresh the stack from Git.

## Database

Prisma 7 reads the database URL from [server/prisma.config.ts](/Users/maksym/Documents/Programming/Projects/HTLBets/server/prisma.config.ts), not from `schema.prisma`.

Run migrations:

```bash
npm run prisma:migrate
```

Open Prisma Studio:

```bash
npm run prisma:studio
```

Generate the Prisma client manually if needed:

```bash
npm run prisma:generate --workspace server
```

## Development

Start both frontend and backend:

```bash
npm run dev
```

Default local URLs:

- Angular app: `http://localhost:4200`
- Express API: `http://localhost:3000`

The Angular dev server proxies `/api` and `/socket.io` to the Express backend.

## Build

```bash
npm run build
```

## Docker

The repository ships with a three-container setup:

- `client`: Angular build served by Nginx
- `server`: Express + Socket.io + Prisma API
- `postgres`: PostgreSQL 16

Copy the Docker environment template:

```bash
cp .env.docker.example .env.docker
```

Adjust at least these values before the first run:

- `JWT_SECRET`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_SECURE`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`

Optional published-port overrides:

- `CLIENT_PUBLISHED_PORT=4200`
- `SERVER_PUBLISHED_PORT=127.0.0.1:3000`
- `POSTGRES_PUBLISHED_PORT=5432`

Start the full stack:

```bash
npm run docker:up
```

Stop it:

```bash
npm run docker:down
```

Read container logs:

```bash
npm run docker:logs
```

Default container URLs:

- Client: `http://localhost:4200`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

For VPS or reverse-proxy deployments, the safest default is to keep the API bound to loopback only:

- `SERVER_PUBLISHED_PORT=127.0.0.1:3000`

If port `3000` is already occupied on the host, change it to another value, for example:

```bash
SERVER_PUBLISHED_PORT=127.0.0.1:3001
```

If Nginx Proxy Manager or another reverse proxy only talks to the `client` container, the `server` port does not need to be publicly reachable at all.

The API container runs `prisma migrate deploy` on startup, so the committed migration in [server/prisma/migrations/20260425120000_init/migration.sql](/Users/maksym/Documents/Programming/Projects/HTLBets/server/prisma/migrations/20260425120000_init/migration.sql) is applied automatically inside Docker.

If the backend is behind reverse proxies, set `TRUST_PROXY` to the correct hop count:

- `1` when the server is only behind the bundled client Nginx container
- `2` when you also place Nginx Proxy Manager or another reverse proxy in front of the client container

Email delivery debugging:

- application-level SMTP handoff logs are visible via `docker compose --env-file .env.docker logs -f server`
- successful remote delivery from Mailcow is visible in `docker logs -f mailcowdockerized-postfix-mailcow-1`
- set `MAIL_DEBUG_BCC=yourmailbox@example.com` if you want to receive a copy of every verification email for debugging

## Start Backend Build

```bash
npm run start
```

## Main API Endpoints

- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `GET /api/me`
- `GET /api/history`

## Socket Events

- `game:join`
- `game:leave`
- `game:bet`
- `game:action`
- `game:state`
- `game:error`

## Notes

- Roulette resolves immediately on bet.
- Blackjack supports `hit`, `stand`, and `double`.
- Poker is intentionally a placeholder flow with staged table state and simplified hand evaluation.
- All outcomes are calculated on the backend.
- The structure is prepared so more games can be added by implementing the shared game engine interface in [server/src/modules/games/core/game-engine.interface.ts](/Users/maksym/Documents/Programming/Projects/HTLBets/server/src/modules/games/core/game-engine.interface.ts).
# HTLBets
