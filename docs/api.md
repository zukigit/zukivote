# API Document

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
  "name": "my-topic",
  "start_at": 1700000000,
  "expired_at": 1700086400,
  "voter_count": 3
}
```

**Responses**

| Status | Body |
| ------ | ---- |
| 201 Created | `{ "topic_id": "<uuid>", "voters": ["<uuid>", ...] }` |
| 400 Bad Request | `{ "error": "invalid request body" }` / `{ "error": "invalid topic params" }` |
| 401 Unauthorized | `{ "error": "invalid token" }` / `{ "error": "unauthenticated" }` |
| 409 Conflict | `{ "error": "topic name is already taken" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- `start_at` and `expired_at` are unix timestamps.
- The authenticated user becomes the topic owner (`owner_id`).
- `voter_count` voters are created along with the topic.

---

### GET /topics

List topics owned by the authenticated user. Requires authentication.

**Headers**

```
Authorization: Bearer <jwt>
```

**Responses**

| Status | Body |
| ------ | ---- |
| 200 OK | `{ "topics": [{ "id": "<uuid>", "name": "my-topic", "start_at": 1700000000, "expired_at": 1700086400, "created_at": 1700000000, "voter_count": 3, "item_count": 5 }, ...] }` |
| 401 Unauthorized | `{ "error": "invalid token" }` / `{ "error": "unauthenticated" }` / `{ "error": "invalid user" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- Returns an empty `topics` array when the user has no topics.

---

### PUT /topics/{id}

Update an existing topic. Requires authentication.

**Headers**

```
Authorization: Bearer <jwt>
```

**Request body**

```json
{
  "name": "my-topic",
  "start_at": 1700000000,
  "expired_at": 1700086400
}
```

**Responses**

| Status | Body |
| ------ | ---- |
| 200 OK | `{ "message": "topic updated" }` |
| 400 Bad Request | `{ "error": "invalid request body" }` / `{ "error": "invalid topic params" }` / `{ "error": "Start Time must be greater than now" }` / `{ "error": "End Time must be at least 15 minutes from now" }` / `{ "error": "Start Time must be before End Time" }` / `{ "error": "cannot modify a topic that has already started" }` |
| 401 Unauthorized | `{ "error": "invalid token" }` / `{ "error": "unauthenticated" }` |
| 403 Forbidden | `{ "error": "forbidden" }` |
| 404 Not Found | `{ "error": "topic not found" }` |
| 409 Conflict | `{ "error": "topic name is already taken" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- `start_at` and `expired_at` are unix timestamps.
- Only the owner of the topic can update it.
- Cannot update a topic that has already started.
- `voter_count` cannot be changed after creation.

---

### DELETE /topics/{id}

Delete an existing topic. Requires authentication.

**Headers**

```
Authorization: Bearer <jwt>
```

**Responses**

| Status | Body |
| ------ | ---- |
| 200 OK | `{ "message": "topic deleted" }` |
| 400 Bad Request | `{ "error": "invalid topic params" }` / `{ "error": "cannot delete a topic that has started and not yet ended" }` |
| 401 Unauthorized | `{ "error": "invalid token" }` / `{ "error": "unauthenticated" }` |
| 403 Forbidden | `{ "error": "forbidden" }` |
| 404 Not Found | `{ "error": "topic not found" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- Only the owner of the topic can delete it.
- Deleting a topic also deletes all associated voters, items, item_values, and records (cascade delete).
- Cannot delete a topic that has started and not yet ended.

---

### POST /items

Add an item to an existing topic. Requires authentication.

**Headers**

```
Authorization: Bearer <jwt>
```

**Content-Type**: `multipart/form-data`

**Form fields**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `topic_id` | string | UUID of the topic to add the item to |
| `description` | string | item description |
| `values` | string | optional JSON array of key/value pairs, e.g. `[{"key": "color", "value": "red"}]` |
| `photo` | file | item photo, max 8MB |

**Responses**

| Status | Body |
| ------ | ---- |
| 201 Created | `{ "item_id": 1, "photo_url": "/app/photos/1.jpg" }` |
| 400 Bad Request | `{ "error": "invalid form data" }` / `{ "error": "invalid item params" }` / `{ "error": "item value key and value are required" }` / `{ "error": "photo too large" }` |
| 401 Unauthorized | `{ "error": "invalid token" }` / `{ "error": "unauthenticated" }` |
| 403 Forbidden | `{ "error": "forbidden" }` |
| 404 Not Found | `{ "error": "topic not found" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- Only the owner of the topic can add items.
- The photo is required and saved under `/app/photos/`; its path is returned as `photo_url`.

---

### GET /items

List items of a topic. Requires authentication.

**Headers**

```
Authorization: Bearer <jwt>
```

**Query parameters**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `topic_id` | string | UUID of the topic to list items from |

**Responses**

| Status | Body |
| ------ | ---- |
| 200 OK | `{ "items": [{ "id": 1, "description": "...", "values": [{ "id": 1, "key": "color", "value": "red" }] }, ...] }` |
| 400 Bad Request | `{ "error": "invalid item params" }` |
| 401 Unauthorized | `{ "error": "invalid token" }` / `{ "error": "unauthenticated" }` |
| 403 Forbidden | `{ "error": "forbidden" }` |
| 404 Not Found | `{ "error": "topic not found" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- Only the owner of the topic can list its items.
- Returns an empty `items` array when the topic has no items.

---

### GET /photo

Serve an item's photo as an image.

**Query parameters**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `item_id` | integer | Item id |

**Responses**

| Status | Body |
| ------ | ---- |
| 200 OK | image content of the item photo |
| 404 Not Found | `{ "error": "photo not found" }` |
| 500 Internal Server Error | `{ "error": "internal error" }` |

**Notes**

- The photo path is looked up from the `items` table by `id`, then served from `/app/photos/`.
- No authentication is required so voters can view item photos.
