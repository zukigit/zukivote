# Database Schema

## ER Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar user_name
        varchar hashed_password
    }

    VOTES {
        uuid id PK
        uuid owner_id FK
        integer expired_at
    }

    USERS ||--o{ VOTES : owns
```

## Tables

### users

| Column           | Type     | Constraints |
| ---------------- | -------- | ----------- |
| id               | UUID     | PRIMARY KEY |
| user_name        | VARCHAR  | NOT NULL    |
| hashed_password  | VARCHAR  | NOT NULL    |

### votes

| Column     | Type     | Constraints                |
| ---------- | -------- | -------------------------- |
| id         | UUID     | PRIMARY KEY                |
| owner_id   | UUID     | FOREIGN KEY references users(id) |
| expired_at | INTEGER  | NOT NULL (unix time)       |
