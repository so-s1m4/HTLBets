# ER-Diagramm: HTLBets

**Stand:** 09.06.2026

Das Diagramm entspricht dem aktuellen Prisma-Schema. Mafia-Raumzustände werden in-memory verwaltet; Balatro besitzt derzeit keinen persistenten Datenbankzustand.

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string username
        string avatarUrl
        string selectedCardDeckId
        datetime bannedAt
        string passwordHash
        string lastDailyLoginAt
        bigint balance
        datetime createdAt
        datetime updatedAt
    }

    CardDeck {
        string id PK
        string name
        int price
        string backImageUrl
        string faceImageTemplate
        boolean isDefault
        boolean enabled
        datetime createdAt
        datetime updatedAt
    }

    UserCardDeck {
        string id PK
        string userId FK
        string deckId FK
        datetime createdAt
    }

    EmailVerificationCode {
        string id PK
        string email
        string codeHash
        datetime expiresAt
        boolean used
        datetime createdAt
    }

    GameSession {
        string id PK
        string userId FK
        enum gameType
        enum status
        bigint currentBet
        json state
        datetime createdAt
        datetime updatedAt
    }

    GameHistory {
        string id PK
        string userId FK
        enum gameType
        bigint betAmount
        string result
        bigint balanceChange
        datetime createdAt
    }

    DailyTaskClaim {
        string id PK
        string userId FK
        string taskKey
        string claimDate
        datetime createdAt
    }

    GameCatalogEntry {
        string id PK
        string name
        boolean enabled
        int sortOrder
        datetime createdAt
        datetime updatedAt
    }

    User ||--o{ GameSession : "has"
    User ||--o{ GameHistory : "has"
    User ||--o{ DailyTaskClaim : "claims"
    User ||--o{ UserCardDeck : "owns"
    CardDeck ||--o{ UserCardDeck : "assigned via"

    CardDeck o|..|| User : "selected by selectedCardDeckId"
```
