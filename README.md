# HTLBets

Demo-only mini-game platform built with Angular, Express, Socket.io, PostgreSQL, and Prisma.

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
- syncs `PORT`, `CLIENT_ORIGIN`, `DATABASE_URL`, and `TRUST_PROXY` from the local dev entries in `.env.docker`
- starts local PostgreSQL through Docker Compose
- runs Prisma generate + migrate deploy
- starts backend and frontend

Default local URLs:

- client: `http://localhost:4200`
- server: `http://localhost:4201`

Requirement: Docker must be running locally.

## Env File

Everything reads from `.env.docker`.

- `.env.docker.example` is the template
- `.env.docker` is used by both `npm run dev` and `docker compose`
- `DEV_CLIENT_PORT` is client dev only
- `DEV_SERVER_PORT` and `DEV_TRUST_PROXY` are server dev only
- `POSTGRES_PUBLISHED_PORT` is the shared local Postgres host port and is also used to build `DATABASE_URL`
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
- `GET /api/me`
- `GET /api/history`

## Notes

- Demo credits only
- No real-money gambling, payments, or withdrawals
- Game results are calculated on the backend
