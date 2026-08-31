-- name: CreateTopic :one
INSERT INTO topics (owner_id, start_at, expired_at)
VALUES ($1, $2, $3)
RETURNING id;

-- name: CreateVoter :one
INSERT INTO voters (topic_id)
VALUES ($1)
RETURNING id;

-- name: GetTopicsByOwner :many
SELECT id, start_at, expired_at
FROM topics
WHERE owner_id = $1;

-- name: GetTopicOwner :one
SELECT owner_id
FROM topics
WHERE id = $1;

-- name: CreateItem :one
INSERT INTO items (topic_id, description)
VALUES ($1, $2)
RETURNING id;

-- name: CreateItemValue :one
INSERT INTO item_values (item_id, key, value)
VALUES ($1, $2, $3)
RETURNING id;

-- name: UpdateItemPhotoUrl :exec
UPDATE items
SET photo_url = $2
WHERE id = $1;
