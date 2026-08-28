package internal

import (
	"context"
	"encoding/json"
	"errors"
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

func writeServiceError(w http.ResponseWriter, err error) bool {
	var svcErr *ServiceError
	if errors.As(err, &svcErr) {
		writeError(w, svcErr.StatusCode, svcErr.Message)
		return true
	}
	return false
}

func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	if err := h.users.Signup(r.Context(), r.Body); err != nil {
		if !writeServiceError(w, err) {
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}

	writeJSON(w, http.StatusCreated, signupResponse{Message: "user created"})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	token, err := h.users.Login(r.Context(), r.Body)
	if err != nil {
		if !writeServiceError(w, err) {
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{Token: token})
}

func (h *Handler) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, err := h.users.ValidateToken(r.Header.Get("Authorization"))
		if err != nil {
			if !writeServiceError(w, err) {
				writeError(w, http.StatusUnauthorized, "invalid token")
			}
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type createTopicResponse struct {
	TopicID string   `json:"topic_id"`
	Voters  []string `json:"voters"`
	ItemIDs []int32  `json:"item_ids"`
}

func (h *Handler) CreateTopic(w http.ResponseWriter, r *http.Request) {
	result, err := h.users.CreateTopic(r.Context(), r.Body)
	if err != nil {
		if !writeServiceError(w, err) {
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}

	writeJSON(w, http.StatusCreated, createTopicResponse{
		TopicID: result.TopicID,
		Voters:  result.Voters,
		ItemIDs: result.ItemIDs,
	})
}
