# Database Schema

## ER Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar user_name
        varchar hashed_password
    }

    TOPICS {
        uuid id PK
        uuid owner_id FK
        integer start_at
        integer expired_at
    }

    VOTERS {
        integer id PK
        varchar user_name
        uuid topic_id FK
        varchar private_key
    }

    ITEMS {
        integer id PK
        uuid topic_id FK
        integer voted_count
        varchar description
        varchar photo_url
    }

    ITEM_VALUES {
        integer id PK
        integer item_id FK
        varchar key
        varchar value
    }

    RECORDS {
        integer id PK
        integer voter_id FK
        integer item_id FK
    }

    USERS ||--o{ TOPICS : owns
    TOPICS ||--o{ VOTERS : has
    TOPICS ||--o{ ITEMS : contains
    ITEMS ||--o{ ITEM_VALUES : has
    VOTERS ||--o{ RECORDS : casts
    ITEMS ||--o{ RECORDS : voted
```

## Tables

### users

| Column           | Type     | Constraints                |
| ---------------- | -------- | -------------------------- |
| id               | UUID     | PRIMARY KEY                |
| user_name        | VARCHAR  | NOT NULL, UNIQUE           |
| hashed_password  | VARCHAR  | NOT NULL                   |

### topics

| Column     | Type     | Constraints                |
| ---------- | -------- | -------------------------- |
| id         | UUID     | PRIMARY KEY                |
| owner_id   | UUID     | FOREIGN KEY references users(id) |
| start_at   | INTEGER  | NOT NULL (unix time)       |
| expired_at | INTEGER  | NOT NULL (unix time)       |

### voters

| Column      | Type     | Constraints                |
| ----------- | -------- | -------------------------- |
| id          | INTEGER  | PRIMARY KEY, AUTO INCREMENT |
| user_name   | VARCHAR  | NOT NULL, UNIQUE           |
| topic_id    | UUID     | FOREIGN KEY references topics(id) |
| private_key | VARCHAR  | NOT NULL                   |

### items

| Column      | Type     | Constraints                |
| ----------- | -------- | -------------------------- |
| id          | INTEGER  | PRIMARY KEY, AUTO INCREMENT |
| topic_id    | UUID     | FOREIGN KEY references topics(id) |
| voted_count | INTEGER  | NOT NULL                   |
| description | VARCHAR  | NOT NULL                   |
| photo_url   | VARCHAR  |                            |

### item_values

| Column  | Type     | Constraints                |
| ------- | -------- | -------------------------- |
| id      | INTEGER  | PRIMARY KEY, AUTO INCREMENT |
| item_id | INTEGER  | FOREIGN KEY references items(id) |
| key     | VARCHAR  | NOT NULL, UNIQUE           |
| value   | VARCHAR  | NOT NULL                   |

### records

| Column   | Type     | Constraints                |
| -------- | -------- | -------------------------- |
| id       | INTEGER  | PRIMARY KEY, AUTO INCREMENT |
| voter_id | INTEGER  | FOREIGN KEY references voters(id) |
| item_id  | INTEGER  | FOREIGN KEY references items(id) |
