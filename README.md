# HTLBets

Mini-game platform for HTL students, built with Angular, Express, Socket.io, PostgreSQL, and Prisma.

## Links
- [Live Demo](https://htlbets.s1m4.me)
- [Source Code](https://github.com/so-s1m4/HTLBets)

## Features

- school-email based authentication
- first login via code, then password-based login
- demo credits only, no real money
- realtime roulette with shared table state
- blackjack
- multiplayer poker with public and private tables
- profile, session history, daily rewards, and nickname support
- admin area for user lookup and balance management

## Stack

- `client`: Angular
- `server`: Node.js + Express + TypeScript
- realtime: Socket.io
- database: PostgreSQL
- ORM: Prisma

## Quick Start

```bash
npm install
npm run dev
```

`npm run dev` automatically:

- creates `.env.docker` from `.env.docker.example` if missing
- syncs local dev values into `.env.docker`
- starts PostgreSQL through Docker Compose
- runs Prisma generate + migrate deploy
- starts backend and frontend

Default local URLs:

- client: `http://localhost:4200`
- server: `http://localhost:4201`

Requirement: Docker must be running locally.

## Environment

Everything reads from `.env.docker`.

- `.env.docker.example` is the template
- `.env.docker` is used by both `npm run dev` and `docker compose`
- `DEV_CLIENT_PORT` is client dev only
- `DEV_SERVER_PORT` and `DEV_TRUST_PROXY` are server dev only
- `POSTGRES_PUBLISHED_PORT` is the shared local Postgres host port
- `SERVER_PUBLISHED_PORT`, `CLIENT_PUBLISHED_PORT`, and `DEPLOY_TRUST_PROXY` are deployment-only

## Commands

```bash
npm run dev
npm run test
npm run build
npm run prisma:migrate
npm run prisma:studio
```

## Docker

```bash
cp .env.docker.example .env.docker
npm run docker:up
```

Useful commands:

```bash
npm run docker:down
npm run docker:logs
```

## API

- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/login`
- `POST /api/auth/set-password`
- `GET /api/me`
- `GET /api/history`

## Notes

- demo credits only
- no payments, deposits, withdrawals, or real-money betting
- game results and balance updates are calculated on the backend
- production deploys should keep PostgreSQL private to the Docker network
