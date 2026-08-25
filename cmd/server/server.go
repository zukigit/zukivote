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

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/zukivote?sslmode=disable"
	}

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

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	if err := httpserver.Run(ctx, addr, users); err != nil {
		fmt.Fprintln(os.Stderr, "http server error:", err)
		os.Exit(1)
	}
}
