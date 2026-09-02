package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zukigit/zukivote/internal"
)

func main() {
	ctx := context.Background()

	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}

	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:5432/%s?sslmode=disable",
		os.Getenv("DB_USER"), os.Getenv("POSTGRES_PASSWORD"), host, os.Getenv("POSTGRES_DB"),
	)

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to create pool:", err)
		os.Exit(1)
	}
	defer pool.Close()

	svc, err := internal.NewService(pool, os.Getenv("JWT_SECRET"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to create service:", err)
		os.Exit(1)
	}

	r := mux.NewRouter()
	internal.NewHandler(svc, os.Getenv("FRONTEND_URL")).Register(r)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
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
		fmt.Fprintln(os.Stderr, "http server error:", err)
		os.Exit(1)
	}
}
