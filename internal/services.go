package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
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
	ErrTopicNameTaken          = &ServiceError{StatusCode: http.StatusConflict, Message: "topic name is already taken"}
	ErrInvalidItemParams       = &ServiceError{StatusCode: http.StatusBadRequest, Message: "invalid item params"}
	ErrEmptyItemValue          = &ServiceError{StatusCode: http.StatusBadRequest, Message: "item value key and value are required"}
	ErrTopicNotFound           = &ServiceError{StatusCode: http.StatusNotFound, Message: "topic not found"}
	ErrTopicOwnerNotFound      = &ServiceError{StatusCode: http.StatusNotFound, Message: "topic owner not found"}
	ErrForbidden               = &ServiceError{StatusCode: http.StatusForbidden, Message: "forbidden"}
	ErrInvalidForm             = &ServiceError{StatusCode: http.StatusBadRequest, Message: "invalid form data"}
	ErrPhotoTooLarge           = &ServiceError{StatusCode: http.StatusBadRequest, Message: "photo too large"}
	ErrMissingJWTSecret        = &ServiceError{StatusCode: http.StatusInternalServerError, Message: "jwt secret key is required"}
	ErrInvalidToken            = &ServiceError{StatusCode: http.StatusUnauthorized, Message: "invalid token"}
	ErrInvalidJSON             = &ServiceError{StatusCode: http.StatusBadRequest, Message: "invalid request body"}
	ErrUnauthenticated         = &ServiceError{StatusCode: http.StatusUnauthorized, Message: "unauthenticated"}
	ErrInvalidUser             = &ServiceError{StatusCode: http.StatusUnauthorized, Message: "invalid user"}
	ErrPhotoNotFound           = &ServiceError{StatusCode: http.StatusNotFound, Message: "photo not found"}
	ErrExpiredAtInvalid        = &ServiceError{StatusCode: http.StatusBadRequest, Message: "End Time must be at least 15 minutes from now"}
	ErrStartAtInvalid          = &ServiceError{StatusCode: http.StatusBadRequest, Message: "Start Time must be greater than now"}
	ErrStartAfterEnd           = &ServiceError{StatusCode: http.StatusBadRequest, Message: "Start Time must be before End Time"}
	ErrTopicAlreadyStarted     = &ServiceError{StatusCode: http.StatusBadRequest, Message: "cannot modify a topic that has already started"}
	ErrNewStartLessThanCurrent = &ServiceError{StatusCode: http.StatusBadRequest, Message: "new start time cannot be earlier than current start time"}
	ErrTopicActive             = &ServiceError{StatusCode: http.StatusBadRequest, Message: "cannot delete a topic that has started and not yet ended"}
)

const jwtTTL = 24 * time.Hour

const (
	maxPhotoSize = 8 << 20
	photosDir    = "/app/photos"
)

type contextKey string

const userIDKey contextKey = "user_id"

func userIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDKey).(string)
	return id, ok
}

func checkTopicOwnership(ctx context.Context, q *sqlc.Queries, topicID pgtype.UUID, userID string) error {
	currentOwner, err := q.GetTopicOwner(ctx, topicID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrTopicNotFound
		}
		return internalError(err.Error())
	}

	if currentOwner.String() != userID {
		return ErrForbidden
	}

	return nil
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
	Name       string `json:"name"`
	StartAt    int32  `json:"start_at"`
	ExpiredAt  int32  `json:"expired_at"`
	VoterCount int32  `json:"voter_count"`
}

type EditTopicRequest struct {
	Name      string `json:"name"`
	StartAt   int32  `json:"start_at"`
	ExpiredAt int32  `json:"expired_at"`
}

func validateTopicRequest(name string, startAt, expiredAt int32) error {
	if name == "" {
		return ErrInvalidTopicParams
	}

	if startAt <= int32(time.Now().Unix()) {
		return ErrStartAtInvalid
	}

	if expiredAt <= int32(time.Now().Add(15*time.Minute).Unix()) {
		return ErrExpiredAtInvalid
	}

	if startAt >= expiredAt {
		return ErrStartAfterEnd
	}

	return nil
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

	if err := validateTopicRequest(req.Name, req.StartAt, req.ExpiredAt); err != nil {
		return nil, err
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

	if _, err := q.GetUserByID(ctx, owner); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidUser
		}
		return nil, internalError(err.Error())
	}

	topicID, err := q.CreateTopic(ctx, sqlc.CreateTopicParams{
		OwnerID:   owner,
		Name:      req.Name,
		StartAt:   req.StartAt,
		ExpiredAt: req.ExpiredAt,
		CreatedAt: int32(time.Now().Unix()),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrTopicNameTaken
		}
		return nil, internalError(fmt.Sprintf("CreateTopic() failed, %s", err.Error()))
	}

	result.TopicID = topicID.String()

	for i := int32(0); i < req.VoterCount; i++ {
		voterID, err := q.CreateVoter(ctx, topicID)
		if err != nil {
			return nil, internalError(fmt.Sprintf("CreateVoter() failed, %s", err.Error()))
		}
		result.Voters = append(result.Voters, voterID.String())
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, internalError(err.Error())
	}
	return &result, nil
}

type EditTopicResult struct {
	Message string `json:"message"`
}

func (s *Service) EditTopic(ctx context.Context, topicIDStr string, body io.Reader) (*EditTopicResult, error) {
	var result EditTopicResult

	ownerID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	var topicID pgtype.UUID
	if err := topicID.Scan(topicIDStr); err != nil {
		return nil, ErrInvalidTopicParams
	}

	var req EditTopicRequest
	if err := json.NewDecoder(body).Decode(&req); err != nil {
		return nil, ErrInvalidJSON
	}

	if req.StartAt >= req.ExpiredAt {
		return nil, ErrStartAfterEnd
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	if err := checkTopicOwnership(ctx, q, topicID, ownerID); err != nil {
		return nil, err
	}

	// Check if topic has already started
	currentTopic, err := q.GetTopicById(ctx, topicID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTopicNotFound
		}
		return nil, internalError(fmt.Sprintf("GetTopicById() failed, err: %s", err.Error()))
	}

	if currentTopic.StartAt <= int32(time.Now().Unix()) {
		return nil, ErrTopicAlreadyStarted
	}

	if currentTopic.StartAt > req.StartAt {
		return nil, ErrNewStartLessThanCurrent
	}

	if err := q.UpdateTopic(ctx, sqlc.UpdateTopicParams{
		ID:        topicID,
		Name:      req.Name,
		StartAt:   req.StartAt,
		ExpiredAt: req.ExpiredAt,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTopicNotFound
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrTopicNameTaken
		}
		return nil, internalError(fmt.Sprintf("UpdateTopic() failed, %s", err.Error()))
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, internalError(err.Error())
	}

	result.Message = "topic updated"
	return &result, nil
}

type DeleteTopicResult struct {
	Message string `json:"message"`
}

func (s *Service) DeleteTopic(ctx context.Context, topicIDStr string) (*DeleteTopicResult, error) {
	var result DeleteTopicResult

	ownerID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	var topicID pgtype.UUID
	if err := topicID.Scan(topicIDStr); err != nil {
		return nil, ErrInvalidTopicParams
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	if err := checkTopicOwnership(ctx, q, topicID, ownerID); err != nil {
		return nil, err
	}

	topic, err := q.GetTopicById(ctx, topicID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTopicNotFound
		}
		return nil, internalError(fmt.Sprintf("GetTopicById() failed, err: %s", err.Error()))
	}

	now := int32(time.Now().Unix())
	if topic.StartAt <= now && now < topic.ExpiredAt {
		return nil, ErrTopicActive
	}

	if err := q.DeleteTopic(ctx, topicID); err != nil {
		return nil, internalError(fmt.Sprintf("DeleteTopic() failed, %s", err.Error()))
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, internalError(err.Error())
	}

	result.Message = "topic deleted"
	return &result, nil
}

type TopicResult struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	StartAt    int32  `json:"start_at"`
	ExpiredAt  int32  `json:"expired_at"`
	CreatedAt  int32  `json:"created_at"`
	VoterCount int64  `json:"voter_count"`
}

type GetTopicsResult struct {
	Topics []TopicResult `json:"topics"`
}

func (s *Service) GetTopics(ctx context.Context) (*GetTopicsResult, error) {
	ownerID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	var owner pgtype.UUID
	if err := owner.Scan(ownerID); err != nil {
		return nil, ErrInvalidUser
	}

	q := sqlc.New(s.pool)

	if _, err := q.GetUserByID(ctx, owner); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidUser
		}
		return nil, internalError(err.Error())
	}

	rows, err := q.GetTopicsByOwner(ctx, owner)
	if err != nil {
		return nil, internalError(fmt.Sprintf("GetTopicsByOwner() failed, err: %s", err.Error()))
	}

	result := &GetTopicsResult{Topics: make([]TopicResult, 0, len(rows))}
	for _, row := range rows {
		voterCount, err := q.CountVotersByTopic(ctx, row.ID)
		if err != nil {
			return nil, internalError(fmt.Sprintf("CountVotersByTopic() failed, err: %s", err.Error()))
		}
		result.Topics = append(result.Topics, TopicResult{
			ID:         row.ID.String(),
			Name:       row.Name,
			StartAt:    row.StartAt,
			ExpiredAt:  row.ExpiredAt,
			CreatedAt:  row.CreatedAt,
			VoterCount: voterCount,
		})
	}
	return result, nil
}

type ItemValueResult struct {
	ID    int32  `json:"id"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

type ItemResult struct {
	ID          int32             `json:"id"`
	Description string            `json:"description"`
	Values      []ItemValueResult `json:"values"`
}

type GetItemsResult struct {
	Items []ItemResult `json:"items"`
}

func (s *Service) GetItems(ctx context.Context, topicIDStr string) (*GetItemsResult, error) {
	userID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	if topicIDStr == "" {
		return nil, ErrInvalidItemParams
	}

	var topicID pgtype.UUID
	if err := topicID.Scan(topicIDStr); err != nil {
		return nil, ErrInvalidItemParams
	}

	q := sqlc.New(s.pool)
	if err := checkTopicOwnership(ctx, q, topicID, userID); err != nil {
		return nil, err
	}

	rows, err := q.GetItemsByTopic(ctx, topicID)
	if err != nil {
		return nil, internalError(fmt.Sprintf("GetItemsByTopic() failed, err: %s", err.Error()))
	}

	valuesByItem, err := s.valuesByItem(ctx, topicID)
	if err != nil {
		return nil, err
	}

	result := &GetItemsResult{Items: make([]ItemResult, 0, len(rows))}
	for _, row := range rows {
		values := valuesByItem[row.ID]
		if values == nil {
			values = []ItemValueResult{}
		}
		result.Items = append(result.Items, ItemResult{
			ID:          row.ID,
			Description: row.Description,
			Values:      values,
		})
	}
	return result, nil
}

func (s *Service) valuesByItem(ctx context.Context, topicID pgtype.UUID) (map[int32][]ItemValueResult, error) {
	rows, err := sqlc.New(s.pool).GetItemValuesByTopic(ctx, topicID)
	if err != nil {
		return nil, internalError(fmt.Sprintf("GetItemValuesByTopic() failed, err: %s", err.Error()))
	}

	valuesByItem := make(map[int32][]ItemValueResult)
	for _, row := range rows {
		valuesByItem[row.ItemID] = append(valuesByItem[row.ItemID], ItemValueResult{
			ID:    row.ID,
			Key:   row.Key,
			Value: row.Value,
		})
	}
	return valuesByItem, nil
}

func (s *Service) GetItemPhotoURL(ctx context.Context, itemIDStr string) (string, error) {
	itemID, err := strconv.ParseInt(itemIDStr, 10, 32)
	if err != nil {
		return "", internalError(fmt.Sprintf("GetItemPhotoUrl() failed, err: %s", err.Error()))
	}

	row, err := sqlc.New(s.pool).GetItemPhotoUrl(ctx, int32(itemID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrPhotoNotFound
		}
		return "", internalError(fmt.Sprintf("GetItemPhotoUrl() failed, err: %s", err.Error()))
	}
	if !row.Valid || row.String == "" {
		return "", ErrPhotoNotFound
	}

	return row.String, nil
}

type MeResult struct {
	ID       string `json:"id"`
	UserName string `json:"user_name"`
}

func (s *Service) GetMe(ctx context.Context) (*MeResult, error) {
	userID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	var id pgtype.UUID
	if err := id.Scan(userID); err != nil {
		return nil, ErrInvalidUser
	}

	row, err := sqlc.New(s.pool).GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidUser
		}
		return nil, internalError(err.Error())
	}

	return &MeResult{ID: row.ID.String(), UserName: row.UserName}, nil
}

type CreateItemValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CreateItemResult struct {
	ItemID   int32  `json:"item_id"`
	PhotoURL string `json:"photo_url"`
}

func (s *Service) CreateItem(ctx context.Context, r *http.Request) (*CreateItemResult, error) {
	userID, ok := userIDFromContext(ctx)
	if !ok {
		return nil, ErrUnauthenticated
	}

	if err := r.ParseMultipartForm(maxPhotoSize); err != nil {
		return nil, ErrInvalidForm
	}

	topicIDStr := r.FormValue("topic_id")
	description := r.FormValue("description")

	var values []CreateItemValue
	if v := r.FormValue("values"); v != "" {
		if err := json.Unmarshal([]byte(v), &values); err != nil {
			return nil, ErrInvalidItemParams
		}
	}

	if topicIDStr == "" || description == "" {
		return nil, ErrInvalidItemParams
	}
	for _, value := range values {
		if value.Key == "" || value.Value == "" {
			return nil, ErrEmptyItemValue
		}
	}

	var topicID pgtype.UUID
	if err := topicID.Scan(topicIDStr); err != nil {
		return nil, ErrInvalidItemParams
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		return nil, ErrInvalidForm
	}
	defer file.Close()

	if header.Size > maxPhotoSize {
		return nil, ErrPhotoTooLarge
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, internalError(err.Error())
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)

	if err := checkTopicOwnership(ctx, q, topicID, userID); err != nil {
		return nil, err
	}

	itemID, err := q.CreateItem(ctx, sqlc.CreateItemParams{
		TopicID:     topicID,
		Description: description,
	})
	if err != nil {
		return nil, internalError(fmt.Sprintf("CreateItem() failed, err: %s", err.Error()))
	}

	if err := os.MkdirAll(photosDir, 0o755); err != nil {
		return nil, internalError(err.Error())
	}

	photoURL := fmt.Sprintf("%s/%d%s", photosDir, itemID, filepath.Ext(header.Filename))
	out, err := os.Create(photoURL)
	if err != nil {
		return nil, internalError(err.Error())
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		os.Remove(photoURL)
		return nil, internalError(err.Error())
	}

	if err := q.UpdateItemPhotoUrl(ctx, sqlc.UpdateItemPhotoUrlParams{
		ID:       itemID,
		PhotoUrl: pgtype.Text{String: photoURL, Valid: true},
	}); err != nil {
		os.Remove(photoURL)
		return nil, internalError(fmt.Sprintf("UpdateItemPhotoUrl() failed, err: %s", err.Error()))
	}

	for _, value := range values {
		if _, err := q.CreateItemValue(ctx, sqlc.CreateItemValueParams{
			ItemID: itemID,
			Key:    value.Key,
			Value:  value.Value,
		}); err != nil {
			os.Remove(photoURL)
			return nil, internalError(fmt.Sprintf("CreateItemValue() failed, err: %s", err.Error()))
		}
	}

	if err := tx.Commit(ctx); err != nil {
		os.Remove(photoURL)
		return nil, internalError(err.Error())
	}

	return &CreateItemResult{ItemID: itemID, PhotoURL: photoURL}, nil
}
