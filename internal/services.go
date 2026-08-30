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
	ErrInvalidItemParams       = &ServiceError{StatusCode: http.StatusBadRequest, Message: "invalid item params"}
	ErrEmptyItemValue          = &ServiceError{StatusCode: http.StatusBadRequest, Message: "item value key and value are required"}
	ErrTopicNotFound           = &ServiceError{StatusCode: http.StatusNotFound, Message: "topic not found"}
	ErrForbidden               = &ServiceError{StatusCode: http.StatusForbidden, Message: "forbidden"}
	ErrMissingJWTSecret        = &ServiceError{StatusCode: http.StatusInternalServerError, Message: "jwt secret key is required"}
	ErrInvalidToken            = &ServiceError{StatusCode: http.StatusUnauthorized, Message: "invalid token"}
	ErrInvalidJSON             = &ServiceError{StatusCode: http.StatusBadRequest, Message: "invalid request body"}
	ErrUnauthenticated         = &ServiceError{StatusCode: http.StatusUnauthorized, Message: "unauthenticated"}
)

const jwtTTL = 24 * time.Hour

type contextKey string

const userIDKey contextKey = "user_id"

func userIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDKey).(string)
	return id, ok
}

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

type SignupResult struct {
	Message string `json:"message"`
}

func (s *Service) Signup(ctx context.Context, body io.Reader) (*SignupResult, error) {
	var result SignupResult

	var req credentialsRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return nil, ErrInvalidJSON
	}

	if req.UserName == "" || req.Password == "" {
		return nil, ErrUserNameOrPasswdIsEmpty
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, internalError(err.Error())
	}

	if _, err := sqlc.New(tx).Signup(ctx, sqlc.SignupParams{
		UserName:       req.UserName,
		HashedPassword: string(hashed),
	}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrUserExists
		}
		return nil, internalError(err.Error())
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, internalError(err.Error())
	}

	result.Message = "user created"
	return &result, nil
}

type LoginResult struct {
	Token string `json:"token"`
}

func (s *Service) Login(ctx context.Context, body io.Reader) (*LoginResult, error) {
	var result LoginResult

	var req credentialsRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return nil, ErrInvalidJSON
	}

	if req.UserName == "" || req.Password == "" {
		return nil, ErrUserNameOrPasswdIsEmpty
	}

	row, err := sqlc.New(s.pool).Login(ctx, req.UserName)
	if err != nil {
		switch err {
		case pgx.ErrNoRows:
			return nil, ErrInvalidCreds
		default:
			return nil, internalError(fmt.Sprintf("Login() failed, err: %s", err.Error()))
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(row.HashedPassword), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCreds
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, CustomClaims{
		ID: row.ID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtTTL)),
		},
	})

	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return nil, internalError(err.Error())
	}

	result.Token = signed
	return &result, nil
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
	StartAt    int32 `json:"start_at"`
	ExpiredAt  int32 `json:"expired_at"`
	VoterCount int32 `json:"voter_count"`
}

type CreateTopicResult struct {
	TopicID string   `json:"topic_id"`
	Voters  []string `json:"voters"`
}

func (s *Service) CreateTopic(ctx context.Context, body io.Reader) (*CreateTopicResult, error) {
	var result CreateTopicResult

	ownerID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	var req CreateTopicRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return nil, ErrInvalidJSON
	}

	if ownerID == "" || req.VoterCount <= 0 {
		return nil, ErrInvalidTopicParams
	}

	var owner pgtype.UUID
	if err := owner.Scan(ownerID); err != nil {
		return nil, ErrInvalidTopicParams
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	topicID, err := q.CreateTopic(ctx, sqlc.CreateTopicParams{
		OwnerID:   owner,
		StartAt:   req.StartAt,
		ExpiredAt: req.ExpiredAt,
	})
	if err != nil {
		return nil, internalError(fmt.Sprintf("CreateTopic() failed, err: %s", err.Error()))
	}

	result.TopicID = topicID.String()

	for i := int32(0); i < req.VoterCount; i++ {
		voterID, err := q.CreateVoter(ctx, topicID)
		if err != nil {
			return nil, internalError(fmt.Sprintf("CreateVoter() failed, err: %s", err.Error()))
		}
		result.Voters = append(result.Voters, voterID.String())
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, internalError(err.Error())
	}
	return &result, nil
}

type CreateItemRequest struct {
	TopicID     string            `json:"topic_id"`
	Description string            `json:"description"`
	Values      []CreateItemValue `json:"values"`
}

type CreateItemValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CreateItemResult struct {
	ItemID int32 `json:"item_id"`
}

func (s *Service) CreateItem(ctx context.Context, body io.Reader) (*CreateItemResult, error) {
	var result CreateItemResult

	userID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	var req CreateItemRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return nil, ErrInvalidJSON
	}

	if req.TopicID == "" || req.Description == "" {
		return nil, ErrInvalidItemParams
	}
	for _, value := range req.Values {
		if value.Key == "" || value.Value == "" {
			return nil, ErrEmptyItemValue
		}
	}

	var topicID pgtype.UUID
	if err := topicID.Scan(req.TopicID); err != nil {
		return nil, ErrInvalidItemParams
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	ownerID, err := q.GetTopicOwner(ctx, topicID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTopicNotFound
		}
		return nil, internalError(err.Error())
	}
	if ownerID.String() != userID {
		return nil, ErrForbidden
	}

	itemID, err := q.CreateItem(ctx, sqlc.CreateItemParams{
		TopicID:     topicID,
		Description: req.Description,
		PhotoUrl:    pgtype.Text{},
	})
	if err != nil {
		return nil, internalError(fmt.Sprintf("CreateItem() failed, err: %s", err.Error()))
	}

	for _, value := range req.Values {
		if _, err := q.CreateItemValue(ctx, sqlc.CreateItemValueParams{
			ItemID: itemID,
			Key:    value.Key,
			Value:  value.Value,
		}); err != nil {
			return nil, internalError(fmt.Sprintf("CreateItemValue() failed, err: %s", err.Error()))
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, internalError(err.Error())
	}

	result.ItemID = itemID
	return &result, nil
}
