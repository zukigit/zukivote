package internal

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

type Handler struct {
	users *Service
}

func NewHandler(users *Service) *Handler {
	return &Handler{users: users}
}

func (h *Handler) Register(r *mux.Router) {
	r.HandleFunc("/signup", h.Signup).Methods(http.MethodPost)
	r.HandleFunc("/login", h.Login).Methods(http.MethodPost)

	protected := r.PathPrefix("/topics").Subrouter()
	protected.Use(h.authMiddleware)
	protected.HandleFunc("", h.CreateTopic).Methods(http.MethodPost)
}

type credentialsRequest struct {
	UserName string `json:"user_name"`
	Password string `json:"password"`
}

type signupResponse struct {
	Message string `json:"message"`
}

type loginResponse struct {
	Token string `json:"token"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.users.Signup(r.Context(), req.UserName, req.Password); err != nil {
		switch err {
		case ErrUserExists:
			writeError(w, http.StatusConflict, "user_name already exists")
			return
		case ErrUserNameOrPasswdIsEmpty:
			writeError(w, http.StatusBadRequest, err.Error())
			return
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
	}

	writeJSON(w, http.StatusCreated, signupResponse{Message: "user created"})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	token, err := h.users.Login(r.Context(), req.UserName, req.Password)
	if err != nil {
		switch err {
		case ErrUserNameOrPasswdIsEmpty:
			writeError(w, http.StatusBadRequest, err.Error())
			return
		case ErrInvalidCreds:
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
	}

	writeJSON(w, http.StatusOK, loginResponse{Token: token})
}

type contextKey string

const userIDKey contextKey = "user_id"

func userIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDKey).(string)
	return id, ok
}

func (h *Handler) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, err := h.users.ValidateToken(r.Header.Get("Authorization"))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type itemValueInput struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type itemInput struct {
	Description string           `json:"description"`
	PhotoURL    string           `json:"photo_url"`
	Values      []itemValueInput `json:"values"`
}

type createTopicRequest struct {
	StartAt    int32       `json:"start_at"`
	ExpiredAt  int32       `json:"expired_at"`
	VoterCount int32       `json:"voter_count"`
	Items      []itemInput `json:"items"`
}

type createTopicResponse struct {
	TopicID string   `json:"topic_id"`
	Voters  []string `json:"voters"`
	ItemIDs []int32  `json:"item_ids"`
}

func (h *Handler) CreateTopic(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	var req createTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	items := make([]ItemInput, 0, len(req.Items))
	for _, item := range req.Items {
		values := make([]ItemValueInput, 0, len(item.Values))
		for _, value := range item.Values {
			values = append(values, ItemValueInput{Key: value.Key, Value: value.Value})
		}
		items = append(items, ItemInput{
			Description: item.Description,
			PhotoURL:    item.PhotoURL,
			Values:      values,
		})
	}

	result, err := h.users.CreateTopic(r.Context(), CreateTopicParams{
		OwnerID:    userID,
		StartAt:    req.StartAt,
		ExpiredAt:  req.ExpiredAt,
		VoterCount: req.VoterCount,
		Items:      items,
	})
	if err != nil {
		switch err {
		case ErrInvalidTopicParams, ErrEmptyItemValue:
			writeError(w, http.StatusBadRequest, err.Error())
			return
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
	}

	voters := make([]string, 0, len(result.Voters))
	for _, voter := range result.Voters {
		voters = append(voters, voter.VoterID)
	}

	writeJSON(w, http.StatusCreated, createTopicResponse{
		TopicID: result.TopicID,
		Voters:  voters,
		ItemIDs: result.ItemIDs,
	})
}
