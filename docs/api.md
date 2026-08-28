## Endpoints

### POST /signup

Create a new user account.

**Request body:**

```json
{
  "user_name": "alice",
  "password": "secret"
}
```

**Responses**

| Status | Body |
| ------ | ---- |
| 201 Created | `{ "message": "user created" }` |
| 400 Bad Request | `{ "error": "invalid request body" }` / `{ "error": "user_name and password are required" }` |
| 409 Conflict | `{ "error": "user already exists" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

---

### POST /login

Log in and receive a JWT token.

**Request body:**

```json
{
  "user_name": "alice",
  "password": "secret"
}
```

**Responses**

| Status | Body |
| ------ | ---- |
| 200 OK | `{ "token": "<jwt>" }` |
| 400 Bad Request | `{ "error": "invalid request body" }` / `{ "error": "user_name and password are required" }` |
| 401 Unauthorized | `{ "error": "invalid credentials" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

> The JWT embeds `id` (user id) and expires after 24 hours.

---

### POST /topics

Create a topic. Requires authentication.

**Headers**

```
Authorization: Bearer <jwt>
```

**Request body**

```json
{
  "start_at": 1700000000,
  "expired_at": 1700086400,
  "voter_count": 3,
  "items": [
    {
      "description": "Option A",
      "values": [
        { "key": "color", "value": "red" }
      ]
    }
  ]
}
```

**Responses**

| Status | Body |
| ------ | ---- |
| 201 Created | `{ "topic_id": "<uuid>", "voters": ["<uuid>", ...], "item_ids": [1, ...] }` |
| 400 Bad Request | `{ "error": "invalid request body" }` / `{ "error": "invalid topic params" }` / `{ "error": "item value key and value are required" }` |
| 401 Unauthorized | `{ "error": "invalid token" }` / `{ "error": "unauthenticated" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- `start_at` and `expired_at` are unix timestamps.
- The authenticated user becomes the topic owner (`owner_id`).
- `voter_count` voters are created along with the topic.
