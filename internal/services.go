package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
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

type ServiceError struct {
	StatusCode int
	Message    string
}

func (e *ServiceError) Error() string {
	return e.Message
}

func internalError(msg string) *ServiceError {
	return &ServiceError{StatusCode: http.StatusInternalServerError, Message: msg}
}

var (
	ErrUserExists              = &ServiceError{StatusCode: http.StatusConflict, Message: "user already exists"}
	ErrInvalidCreds            = &ServiceError{StatusCode: http.StatusUnauthorized, Message: "invalid credentials"}
	ErrUserNameOrPasswdIsEmpty = &ServiceError{StatusCode: http.StatusBadRequest, Message: "user_name and password are required"}
	ErrNilPool                 = &ServiceError{StatusCode: http.StatusInternalServerError, Message: "pool cannot be nil"}
	ErrInvalidTopicParams      = &ServiceError{StatusCode: http.StatusBadRequest, Message: "invalid topic params"}
	ErrEmptyItemValue          = &ServiceError{StatusCode: http.StatusBadRequest, Message: "item value key and value are required"}
	ErrMissingJWTSecret        = &ServiceError{StatusCode: http.StatusInternalServerError, Message: "jwt secret key is required"}
	ErrInvalidToken            = &ServiceError{StatusCode: http.StatusUnauthorized, Message: "invalid token"}
	ErrInvalidJSON             = &ServiceError{StatusCode: http.StatusBadRequest, Message: "invalid request body"}
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

func (s *Service) Signup(ctx context.Context, body io.Reader) error {
	var req credentialsRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return ErrInvalidJSON
	}

	if req.UserName == "" || req.Password == "" {
		return ErrUserNameOrPasswdIsEmpty
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return internalError(err.Error())
	}

	if _, err := sqlc.New(tx).Signup(ctx, sqlc.SignupParams{
		UserName:       req.UserName,
		HashedPassword: string(hashed),
	}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrUserExists
		}
		return internalError(err.Error())
	}

	if err := tx.Commit(ctx); err != nil {
		return internalError(err.Error())
	}
	return nil
}

func (s *Service) Login(ctx context.Context, body io.Reader) (string, error) {
	var req credentialsRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return "", ErrInvalidJSON
	}

	if req.UserName == "" || req.Password == "" {
		return "", ErrUserNameOrPasswdIsEmpty
	}

	row, err := sqlc.New(s.pool).Login(ctx, req.UserName)
	if err != nil {
		switch err {
		case pgx.ErrNoRows:
			return "", ErrInvalidCreds
		default:
			return "", internalError(fmt.Sprintf("Login() failed, err: %s", err.Error()))
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(row.HashedPassword), []byte(req.Password)); err != nil {
		return "", ErrInvalidCreds
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, CustomClaims{
		ID: row.ID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtTTL)),
		},
	})

	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", internalError(err.Error())
	}
	return signed, nil
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

type credentialsRequest struct {
	UserName string `json:"user_name"`
	Password string `json:"password"`
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

func (s *Service) CreateTopic(ctx context.Context, ownerID string, body io.Reader) (CreateTopicResult, error) {
	var result CreateTopicResult

	var req CreateTopicRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return result, ErrInvalidJSON
	}

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
		return result, internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	topicID, err := q.CreateTopic(ctx, sqlc.CreateTopicParams{
		OwnerID:   owner,
		StartAt:   req.StartAt,
		ExpiredAt: req.ExpiredAt,
	})
	if err != nil {
		return result, internalError(fmt.Sprintf("CreateTopic() failed, err: %s", err.Error()))
	}

	result.TopicID = topicID.String()

	for i := int32(0); i < req.VoterCount; i++ {
		voterID, err := q.CreateVoter(ctx, topicID)
		if err != nil {
			return result, internalError(fmt.Sprintf("CreateVoter() failed, err: %s", err.Error()))
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
			return result, internalError(fmt.Sprintf("CreateItem() failed, err: %s", err.Error()))
		}

		for _, value := range item.Values {
			if _, err := q.CreateItemValue(ctx, sqlc.CreateItemValueParams{
				ItemID: itemID,
				Key:    value.Key,
				Value:  value.Value,
			}); err != nil {
				return result, internalError(fmt.Sprintf("CreateItemValue() failed, err: %s", err.Error()))
			}
		}

		result.ItemIDs = append(result.ItemIDs, itemID)
	}

	if err := tx.Commit(ctx); err != nil {
		return result, internalError(err.Error())
	}
	return result, nil
}
