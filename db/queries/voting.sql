-- name: GetVoterById :one
SELECT id, topic_id
FROM voters
WHERE id = $1;

-- name: CreateRecord :one
INSERT INTO records (voter_id, item_id, created_at)
VALUES ($1, $2, $3)
RETURNING id;

-- name: CountVotesByItem :one
SELECT COUNT(*) AS vote_count
FROM records
WHERE item_id = $1;

-- name: CheckVoterHasVoted :one
SELECT COUNT(*) AS has_voted
FROM records
WHERE voter_id = $1;
