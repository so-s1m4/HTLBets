# HTLBets API Documentation

**Stand:** 11.05.2026

This document describes the current REST and websocket interface of **HTLBets** based on the implemented server routes and socket handlers.

## Base URLs

- REST API: `http://localhost:4201/api`
- Socket.io: `http://localhost:4201`

## Authentication

Protected REST endpoints require:

```http
Authorization: Bearer <accessToken>
```

Socket authentication accepts the same token either as:

```ts
auth: { token: "<accessToken>" }
```

or through the `Authorization` header.

## Error Format

Most errors use this shape:

```json
{
  "message": "Human-readable error message."
}
```

Typical status codes:

- `200` success
- `202` accepted
- `400` invalid input or invalid game action
- `401` missing or invalid token
- `403` banned user or admin-only access
- `404` route or resource not found
- `429` auth rate limit on code requests
- `500` unexpected server error

## Core REST Endpoints

### Health

`GET /api/health`

Response:

```json
{
  "status": "ok"
}
```

### Auth

`POST /api/auth/begin`

Request:

```json
{
  "email": "user@schule.at"
}
```

Response:

```json
{
  "mode": "code"
}
```

Possible modes:

- `code`
- `password`

`POST /api/auth/request-code`

Request:

```json
{
  "email": "user@schule.at"
}
```

Response:

```json
{
  "message": "If the email can receive mail, a verification code has been sent."
}
```

Notes:

- limited to `5` requests per `10` minutes per client
- if `DEBUG_AUTH=true`, the server skips actual mail sending

`POST /api/auth/verify-code`

Request:

```json
{
  "email": "user@schule.at",
  "code": "123456"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "user": {
    "id": "usr_123",
    "email": "user@schule.at",
    "username": null,
    "avatarUrl": null,
    "balance": 1000,
    "selectedCardDeckId": "classic-dark",
    "bannedAt": null,
    "isAdmin": false,
    "hasPassword": false,
    "createdAt": "2026-05-11T12:00:00.000Z",
    "updatedAt": "2026-05-11T12:00:00.000Z"
  },
  "requiresPasswordSetup": true
}
```

`POST /api/auth/login-password`

Request:

```json
{
  "email": "user@schule.at",
  "password": "secret123"
}
```

Response shape is the same as `verify-code`.

`POST /api/auth/set-password`

Protected.

Request:

```json
{
  "password": "secret123"
}
```

Response:

```json
{
  "user": {
    "id": "usr_123",
    "email": "user@schule.at",
    "username": null,
    "avatarUrl": null,
    "balance": 1000,
    "selectedCardDeckId": "classic-dark",
    "bannedAt": null,
    "isAdmin": false,
    "hasPassword": true,
    "createdAt": "2026-05-11T12:00:00.000Z",
    "updatedAt": "2026-05-11T12:05:00.000Z"
  }
}
```

### User

`GET /api/me`

Returns the current user:

```json
{
  "id": "usr_123",
  "email": "user@schule.at",
  "username": "Maksym",
  "avatarUrl": "/avatars/default.png",
  "balance": 1280,
  "selectedCardDeckId": "classic-dark",
  "bannedAt": null,
  "isAdmin": false,
  "hasPassword": true,
  "createdAt": "2026-05-11T12:00:00.000Z",
  "updatedAt": "2026-05-11T12:05:00.000Z"
}
```

`PATCH /api/me/profile`

Request:

```json
{
  "username": "Maksym",
  "avatarUrl": "/avatars/user-1.png"
}
```

Both fields are optional. `avatarUrl` may be `null`.

`GET /api/history`

Returns up to `50` latest game history entries:

```json
[
  {
    "id": "hist_1",
    "gameType": "ROULETTE",
    "betAmount": 100,
    "result": "WIN",
    "balanceChange": 200,
    "createdAt": "2026-05-11T15:00:00.000Z"
  }
]
```

`GET /api/me/dailies`

Response:

```json
[
  {
    "key": "play-roulette",
    "title": "Play Roulette",
    "description": "Finish one roulette round.",
    "reward": 50,
    "progress": 0,
    "target": 1,
    "completed": false,
    "claimed": false
  }
]
```

`POST /api/me/dailies/:taskKey/claim`

Claims one daily reward and returns:

```json
{
  "user": {
    "id": "usr_123",
    "email": "user@schule.at",
    "username": "Maksym",
    "avatarUrl": null,
    "balance": 1330,
    "selectedCardDeckId": "classic-dark",
    "bannedAt": null,
    "isAdmin": false,
    "hasPassword": true,
    "createdAt": "2026-05-11T12:00:00.000Z",
    "updatedAt": "2026-05-11T16:00:00.000Z"
  },
  "task": {
    "key": "play-roulette",
    "title": "Play Roulette",
    "description": "Finish one roulette round.",
    "reward": 50,
    "progress": 1,
    "target": 1,
    "completed": true,
    "claimed": true
  }
}
```

`GET /api/me/card-decks`

Response:

```json
[
  {
    "id": "classic-dark",
    "name": "Classic Dark",
    "price": 0,
    "backImageUrl": "/cards/classic-dark/back.png",
    "faceImageTemplate": "/cards/{suit}_{rank}.png",
    "isDefault": true,
    "enabled": true,
    "owned": true,
    "selected": true
  }
]
```

`POST /api/me/card-decks/:deckId/purchase`

Response:

```json
{
  "user": { "id": "usr_123", "balance": 900 },
  "decks": []
}
```

The real `user` object contains the full public user shape shown above.

`POST /api/me/card-decks/:deckId/select`

Response shape is the same as `purchase`.

`GET /api/leaderboard`

Response:

```json
{
  "richest": [
    {
      "userId": "usr_123",
      "email": "user@schule.at",
      "username": "Maksym",
      "avatarUrl": null,
      "metricValue": 1800
    }
  ],
  "mostLosses": [],
  "biggestWin": [],
  "refreshedAt": "2026-05-11T16:30:00.000Z"
}
```

### Admin

All admin routes are protected and additionally require an admin account.

`GET /api/admin/users`

Returns all users as `PublicUser[]`.

`GET /api/admin/users/:userId/history`

Returns the selected user's history as `PublicGameHistory[]`.

`PATCH /api/admin/users/:userId/balance`

Request:

```json
{
  "balance": 2500
}
```

Returns the updated `PublicUser`.

`POST /api/admin/users/:userId/ban`

Request:

```json
{
  "banned": true
}
```

`banned: false` removes the ban. Returns the updated `PublicUser`.

`POST /api/admin/users/:userId/wipe`

Resets:

- balance to the default demo value
- daily progress
- non-default owned card decks
- selected card deck to the default deck
- active game sessions
- user history

Response: updated `PublicUser`.

`DELETE /api/admin/users/:userId`

Response:

```json
{
  "deletedUserId": "usr_123"
}
```

`GET /api/admin/users/:userId/card-decks`

Response:

```json
[
  {
    "id": "classic-dark",
    "name": "Classic Dark",
    "price": 0,
    "backImageUrl": "/cards/classic-dark/back.png",
    "faceImageTemplate": "/cards/{suit}_{rank}.png",
    "isDefault": true,
    "enabled": true,
    "purchaseCount": 15,
    "createdAt": "2026-05-01T10:00:00.000Z",
    "updatedAt": "2026-05-01T10:00:00.000Z",
    "owned": true,
    "selected": true,
    "grantedAt": "2026-05-03T10:00:00.000Z"
  }
]
```

`POST /api/admin/users/:userId/card-decks/:deckId/grant`

Request:

```json
{
  "select": true
}
```

Response:

```json
{
  "user": {},
  "decks": []
}
```

The real payload contains the full updated `PublicUser` and `AdminUserCardDeck[]`.

`GET /api/admin/card-decks`

Returns `AdminCardDeck[]`.

`POST /api/admin/card-decks/import`

Request:

```json
{
  "id": "classic-dark",
  "name": "Classic Dark",
  "price": 0,
  "backImageUrl": "/cards/classic-dark/back.png",
  "faceImageTemplate": "/cards/{suit}_{rank}.png",
  "enabled": true
}
```

Rules:

- `id`: `3-40` chars, lowercase letters, numbers, dashes
- `name`: `2-48` chars
- `price`: non-negative integer
- `backImageUrl`: absolute `http(s)` URL or root-relative asset path
- `faceImageTemplate`: optional, defaults to `/cards/{suit}_{rank}.png`

Returns the imported or updated `AdminCardDeck`.

`POST /api/admin/card-decks/:deckId/default`

Sets the default deck and returns the updated `AdminCardDeck`.

## Websocket API

Events are defined through Socket.io.

### Event Names

- client -> server: `game:join`
- client -> server: `game:leave`
- client -> server: `game:bet`
- client -> server: `game:action`
- server -> client: `game:state`
- server -> client: `game:error`

### Generic State Envelope

Most game states are wrapped like this:

```json
{
  "sessionId": "session_123",
  "gameType": "BLACKJACK",
  "status": "WAITING_ACTION",
  "balance": 1000,
  "currentBet": 100,
  "state": {},
  "outcome": null
}
```

Fields:

- `sessionId`: current game or table session
- `gameType`: `ROULETTE`, `BLACKJACK`, `POKER`, `MINER`, `CRASH`, `SLOTS`
- `status`: Prisma game session status
- `balance`: current user balance
- `currentBet`: committed amount for the active round
- `state`: game-specific payload
- `outcome`: final resolution or `null`

### `game:join`

Request:

```json
{
  "gameType": "BLACKJACK",
  "sessionId": "optional-existing-session"
}
```

Notes:

- `sessionId` is optional for most single-player games
- for poker it selects the table or lobby to watch
- roulette always joins the shared main table

### `game:leave`

Request:

```json
{
  "gameType": "BLACKJACK",
  "sessionId": "session_123"
}
```

### `game:bet`

Request:

```json
{
  "gameType": "MINER",
  "sessionId": "session_123",
  "amount": 100,
  "payload": {}
}
```

Game-specific bet payloads:

- `ROULETTE`: `{ "selectionType": "color", "value": "red" }`
- `BLACKJACK`: no extra payload required
- `MINER`: optional mine setup payload if supported by the client flow
- `CRASH`: no extra payload required
- `SLOTS`: `{ "machineId": "classic-fruit" }`
- `POKER`: regular buy-ins do not use `game:bet`; poker uses `game:action`

Supported roulette selections:

- `color`: `red`, `black`
- `number`: `0` to `36`, or `"00"`
- `parity`: `odd`, `even`
- `dozen`: `1st12`, `2nd12`, `3rd12`
- `range`: `1-18`, `19-36`
- `column`: `top`, `middle`, `bottom`

### `game:action`

Request:

```json
{
  "gameType": "BLACKJACK",
  "sessionId": "session_123",
  "action": "hit",
  "payload": {}
}
```

Supported actions by game:

- `BLACKJACK`: `hit`, `stand`, `double`, `split`, `insurance`, `take-insurance`, `skip-insurance`, `no-insurance`
- `MINER`: `reveal-cell` with `{ "index": 0 }`, `cash-out`
- `CRASH`: `cash-out`
- `SLOTS`: no follow-up action required after a spin
- `POKER`: `create-table`, `spectate-table`, `join-table`, `ready-table`, `leave-table`, `return-lobby`, `check`, `call`, `raise`, `all-in`, `fold`, `emote`

Poker action payload examples:

`create-table`

```json
{
  "gameType": "POKER",
  "sessionId": "poker-lobby",
  "action": "create-table",
  "payload": {
    "tableName": "Late Table",
    "visibility": "private",
    "password": "12345",
    "minBuyIn": 100,
    "maxPlayers": 6,
    "buyIn": 500
  }
}
```

`join-table`

```json
{
  "gameType": "POKER",
  "sessionId": "poker-lobby",
  "action": "join-table",
  "payload": {
    "sessionId": "table_123",
    "buyIn": 500
  }
}
```

`raise`

```json
{
  "gameType": "POKER",
  "sessionId": "table_123",
  "action": "raise",
  "payload": {
    "amount": 800
  }
}
```

`emote`

```json
{
  "gameType": "POKER",
  "sessionId": "table_123",
  "action": "emote",
  "payload": {
    "text": "gg"
  }
}
```

### `game:state`

Sent after join, bet, action, and whenever the server pushes an updated shared state.

Special cases:

- roulette broadcasts the table state to all joined clients
- poker updates all sockets that currently watch the lobby or a table
- crash can push a server-side state change when the round crashes

### `game:error`

Sent when a socket request fails.

Typical payload:

```json
{
  "message": "Human-readable error message."
}
```

## Notes

- All balances and results are validated server-side.
- Suspended users are blocked on both REST and websocket level.
- The client should treat `game:state` as the source of truth.
