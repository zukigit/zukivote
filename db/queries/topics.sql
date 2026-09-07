-- name: CreateTopic :one
INSERT INTO topics (owner_id, name, start_at, expired_at, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- name: CreateVoter :one
INSERT INTO voters (topic_id)
VALUES ($1)
RETURNING id;

-- name: GetTopicsByOwner :many
SELECT id, name, start_at, expired_at, created_at
FROM topics
WHERE owner_id = $1;

-- name: CountVotersByTopic :one
SELECT COUNT(*) AS voter_count
FROM voters
WHERE topic_id = $1;

-- name: CountItemsByTopic :one
SELECT COUNT(*) AS item_count
FROM items
WHERE topic_id = $1;

-- name: GetTopicOwner :one
SELECT owner_id
FROM topics
WHERE id = $1;

-- name: GetTopicById :one
SELECT id, name, start_at, expired_at, created_at
FROM topics
WHERE id = $1;

-- name: UpdateTopic :exec
UPDATE topics
SET name = $2, start_at = $3, expired_at = $4
WHERE id = $1;

-- name: DeleteTopic :exec
DELETE FROM topics
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

-- name: GetItemsByTopic :many
SELECT id, description
FROM items
WHERE topic_id = $1;

-- name: GetItemPhotoUrl :one
SELECT photo_url
FROM items
WHERE id = $1;

-- name: GetItemValuesByTopic :many
SELECT item_values.id, item_values.item_id, item_values.key, item_values.value
FROM item_values
JOIN items ON items.id = item_values.item_id
WHERE items.topic_id = $1;
