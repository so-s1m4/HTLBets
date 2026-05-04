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

- creates `server/.env` from [server/.env.example](/Users/maksym/Documents/Programming/Projects/HTLBets/server/.env.example) if missing
- creates `client/.env` from [client/.env.example](/Users/maksym/Documents/Programming/Projects/HTLBets/client/.env.example) if missing
- starts local PostgreSQL through Docker Compose
- runs Prisma generate + migrate deploy
- starts backend and frontend

Default local URLs:

- client: `http://localhost:4200`
- server: `http://localhost:3000`

Requirement: Docker must be running locally.

## Env Files

Local development:

- [server/.env.example](/Users/maksym/Documents/Programming/Projects/HTLBets/server/.env.example)
- [client/.env.example](/Users/maksym/Documents/Programming/Projects/HTLBets/client/.env.example)

Docker stack:

- [.env.docker.example](/Users/maksym/Documents/Programming/Projects/HTLBets/.env.docker.example)

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
