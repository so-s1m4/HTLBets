# HTLBets Client

Angular 21 frontend for the HTLBets demo platform.

## Start

The recommended development command is run from the repository root:

```bash
npm run dev
```

To run only the client:

```bash
npm run dev --workspace client
```

The client generates `public/runtime-config.js` before starting and uses the shared values from the root `.env.docker` file. The default URL is `http://localhost:4200`.

## Main Areas

- authentication pages and route guards
- responsive mobile shell, lobby, profile, leaderboard, and admin UI
- Socket.io clients for server-backed games
- WebRTC media signaling for poker and Mafia
- card-deck selection and rendering
- Balatro-inspired client-side single-player mode

## Routes

- `/auth/email`, `/auth/password`, `/auth/verify`, `/auth/set-password`
- `/lobby`
- `/games/roulette`, `/games/blackjack`, `/games/poker`
- `/games/miner`, `/games/crash`, `/games/slots`
- `/games/ochko`, `/games/mafia`, `/games/balatro`
- `/games/leaderboard`, `/profile`, `/admin`

Game routes use the public game catalog and redirect to the lobby when an admin disables a game.

## Build and Test

```bash
npm run build --workspace client
npm run test --workspace client
```

Tests run with Vitest. The production build is served by Nginx in the client Docker image.

For full setup, backend, database, and Docker instructions, see the repository [README](../README.md).
