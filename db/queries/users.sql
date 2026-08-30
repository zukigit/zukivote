-- name: Signup :one
INSERT INTO users (user_name, hashed_password)
VALUES ($1, $2)
RETURNING id;

-- name: Login :one
SELECT id, hashed_password
FROM users
WHERE user_name = $1;

-- name: GetUserByID :one
SELECT id
FROM users
WHERE id = $1;
