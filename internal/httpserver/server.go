package httpserver

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/zukigit/zukivote/internal/services"
)

func NewRouter(users *services.UserService) *mux.Router {
	r := mux.NewRouter()
	NewHandler(users).Register(r)
	return r
}

func Run(ctx context.Context, addr string, users *services.UserService) error {
	srv := &http.Server{
		Addr:    addr,
		Handler: NewRouter(users),
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			srv.Close()
		}
	}()

	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
