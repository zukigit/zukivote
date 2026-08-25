package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/zukigit/zukivote/internal/services"
)

type Handler struct {
	users *services.UserService
}

func NewHandler(users *services.UserService) *Handler {
	return &Handler{users: users}
}

func (h *Handler) Register(r *mux.Router) {
	r.HandleFunc("/signup", h.Signup).Methods(http.MethodPost)
	r.HandleFunc("/login", h.Login).Methods(http.MethodPost)
}

type credentialsRequest struct {
	UserName string `json:"user_name"`
	Password string `json:"password"`
}

type signupResponse struct {
	ID string `json:"id"`
}

type loginResponse struct {
	UserName string `json:"user_name"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserName == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "user_name and password are required")
		return
	}

	id, err := h.users.Signup(r.Context(), req.UserName, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrUserExists) {
			writeError(w, http.StatusConflict, "user_name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusCreated, signupResponse{ID: id.String()})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserName == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "user_name and password are required")
		return
	}

	userName, err := h.users.Login(r.Context(), req.UserName, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCreds) {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{UserName: userName})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}
