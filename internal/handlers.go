package internal

import (
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
