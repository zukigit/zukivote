-- name: Signup :one
INSERT INTO users (user_name, hashed_password)
VALUES ($1, $2)
RETURNING id;

-- name: Login :one
SELECT user_name, hashed_password
FROM users
WHERE user_name = $1;
