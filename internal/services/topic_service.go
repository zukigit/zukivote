package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zukigit/zukivote/db/sqlc"
)

var (
	ErrInvalidTopicParams = errors.New("invalid topic params")
	ErrEmptyItemValue     = errors.New("item value key and value are required")
	ErrNilTopicPool       = errors.New("pool cannot be nil")
)

type ItemValueInput struct {
	Key   string
	Value string
}

type ItemInput struct {
	Description string
	PhotoURL    string
	Values      []ItemValueInput
}

type CreateTopicParams struct {
	OwnerID    string
	StartAt    int32
	ExpiredAt  int32
	VoterCount int32
	Items      []ItemInput
}

type VoterOutput struct {
	VoterID    int32
	PrivateKey string
}

type CreateTopicResult struct {
	TopicID string
	Voters  []VoterOutput
	ItemIDs []int32
}

type TopicService struct {
	pool *pgxpool.Pool
}

func NewTopicService(pool *pgxpool.Pool) (*TopicService, error) {
	if pool == nil {
		return nil, ErrNilTopicPool
	}
	return &TopicService{pool: pool}, nil
}

func (s *TopicService) CreateTopic(ctx context.Context, params CreateTopicParams) (CreateTopicResult, error) {
	var result CreateTopicResult

	if params.OwnerID == "" || params.VoterCount <= 0 || len(params.Items) == 0 {
		return result, ErrInvalidTopicParams
	}
	for _, item := range params.Items {
		if item.Description == "" {
			return result, ErrInvalidTopicParams
		}
		for _, value := range item.Values {
			if value.Key == "" || value.Value == "" {
				return result, ErrEmptyItemValue
			}
		}
	}

	var ownerID pgtype.UUID
	if err := ownerID.Scan(params.OwnerID); err != nil {
		return result, ErrInvalidTopicParams
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	topicID, err := q.CreateTopic(ctx, sqlc.CreateTopicParams{
		OwnerID:   ownerID,
		StartAt:   params.StartAt,
		ExpiredAt: params.ExpiredAt,
	})
	if err != nil {
		return result, fmt.Errorf("CreateTopic() failed, err: %s", err.Error())
	}

	result.TopicID = topicID.String()

	for i := int32(0); i < params.VoterCount; i++ {
		privateKey, err := newPrivateKey()
		if err != nil {
			return result, fmt.Errorf("newPrivateKey() failed, err: %s", err.Error())
		}

		voterID, err := q.CreateVoter(ctx, sqlc.CreateVoterParams{
			TopicID:    topicID,
			PrivateKey: privateKey,
		})
		if err != nil {
			return result, fmt.Errorf("CreateVoter() failed, err: %s", err.Error())
		}

		result.Voters = append(result.Voters, VoterOutput{
			VoterID:    voterID,
			PrivateKey: privateKey,
		})
	}

	for _, item := range params.Items {
		itemID, err := q.CreateItem(ctx, sqlc.CreateItemParams{
			TopicID:     topicID,
			Description: item.Description,
			PhotoUrl: pgtype.Text{
				String: item.PhotoURL,
				Valid:  item.PhotoURL != "",
			},
		})
		if err != nil {
			return result, fmt.Errorf("CreateItem() failed, err: %s", err.Error())
		}

		for _, value := range item.Values {
			if _, err := q.CreateItemValue(ctx, sqlc.CreateItemValueParams{
				ItemID: itemID,
				Key:    value.Key,
				Value:  value.Value,
			}); err != nil {
				return result, fmt.Errorf("CreateItemValue() failed, err: %s", err.Error())
			}
		}

		result.ItemIDs = append(result.ItemIDs, itemID)
	}

	return result, tx.Commit(ctx)
}

func newPrivateKey() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
