package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zukigit/zukivote/internal/httpserver"
	"github.com/zukigit/zukivote/internal/services"
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

	if err := pool.Ping(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "failed to ping database:", err)
		os.Exit(1)
	}

	users, err := services.NewUserService(pool)
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to create user service:", err)
		os.Exit(1)
	}

	if err := httpserver.Run(ctx, ":8080", users); err != nil {
		fmt.Fprintln(os.Stderr, "http server error:", err)
		os.Exit(1)
	}
}
