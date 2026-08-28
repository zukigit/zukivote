package internal

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zukigit/zukivote/db/sqlc"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserExists              = errors.New("user already exists")
	ErrInvalidCreds            = errors.New("invalid credentials")
	ErrUserNameOrPasswdIsEmpty = errors.New("user_name and password are required")
	ErrNilPool                 = errors.New("pool cannot be nil")
	ErrInvalidTopicParams      = errors.New("invalid topic params")
	ErrEmptyItemValue          = errors.New("item value key and value are required")
	ErrMissingJWTSecret        = errors.New("jwt secret key is required")
	ErrInvalidToken            = errors.New("invalid token")
)

const jwtTTL = 24 * time.Hour

type CustomClaims struct {
	ID string `json:"id"`
	jwt.RegisteredClaims
}

type Service struct {
	pool      *pgxpool.Pool
	jwtSecret []byte
}

func NewService(pool *pgxpool.Pool, jwtSecret string) (*Service, error) {
	if pool == nil {
		return nil, ErrNilPool
	}
	if jwtSecret == "" {
		return nil, ErrMissingJWTSecret
	}
	return &Service{pool: pool, jwtSecret: []byte(jwtSecret)}, nil
}

func (s *Service) Signup(ctx context.Context, userName, password string) error {
	if userName == "" || password == "" {
		return ErrUserNameOrPasswdIsEmpty
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if _, err := sqlc.New(tx).Signup(ctx, sqlc.SignupParams{
		UserName:       userName,
		HashedPassword: string(hashed),
	}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrUserExists
		}
		return err
	}

	return tx.Commit(ctx)
}

func (s *Service) Login(ctx context.Context, userName, password string) (string, error) {
	if userName == "" || password == "" {
		return "", ErrUserNameOrPasswdIsEmpty
	}

	row, err := sqlc.New(s.pool).Login(ctx, userName)
	if err != nil {
		switch err {
		case pgx.ErrNoRows:
			return "", ErrInvalidCreds
		default:
			return "", fmt.Errorf("Login() failed, err: %s", err.Error())
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(row.HashedPassword), []byte(password)); err != nil {
		return "", ErrInvalidCreds
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, CustomClaims{
		ID: row.ID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtTTL)),
		},
	})

	return token.SignedString(s.jwtSecret)
}

func (s *Service) ValidateToken(authHeader string) (string, error) {
	const prefix = "Bearer "
	if !strings.HasPrefix(authHeader, prefix) {
		return "", ErrInvalidToken
	}
	tokenString := strings.TrimPrefix(authHeader, prefix)

	claims := &CustomClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", ErrInvalidToken
	}
	return claims.ID, nil
}

type CreateTopicRequest struct {
	StartAt    int32             `json:"start_at"`
	ExpiredAt  int32             `json:"expired_at"`
	VoterCount int32             `json:"voter_count"`
	Items      []CreateTopicItem `json:"items"`
}

type CreateTopicItem struct {
	Description string             `json:"description"`
	PhotoURL    string             `json:"photo_url"`
	Values      []CreateTopicValue `json:"values"`
}

type CreateTopicValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CreateTopicResult struct {
	TopicID string
	Voters  []string
	ItemIDs []int32
}

func (s *Service) CreateTopic(ctx context.Context, ownerID string, req CreateTopicRequest) (CreateTopicResult, error) {
	var result CreateTopicResult

	if ownerID == "" || req.VoterCount <= 0 || len(req.Items) == 0 {
		return result, ErrInvalidTopicParams
	}
	for _, item := range req.Items {
		if item.Description == "" {
			return result, ErrInvalidTopicParams
		}
		for _, value := range item.Values {
			if value.Key == "" || value.Value == "" {
				return result, ErrEmptyItemValue
			}
		}
	}

	var owner pgtype.UUID
	if err := owner.Scan(ownerID); err != nil {
		return result, ErrInvalidTopicParams
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	topicID, err := q.CreateTopic(ctx, sqlc.CreateTopicParams{
		OwnerID:   owner,
		StartAt:   req.StartAt,
		ExpiredAt: req.ExpiredAt,
	})
	if err != nil {
		return result, fmt.Errorf("CreateTopic() failed, err: %s", err.Error())
	}

	result.TopicID = topicID.String()

	for i := int32(0); i < req.VoterCount; i++ {
		voterID, err := q.CreateVoter(ctx, topicID)
		if err != nil {
			return result, fmt.Errorf("CreateVoter() failed, err: %s", err.Error())
		}
		result.Voters = append(result.Voters, voterID.String())
	}

	for _, item := range req.Items {
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
