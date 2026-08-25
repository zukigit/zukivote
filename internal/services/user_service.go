package services

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zukigit/zukivote/db/sqlc"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserExists              = errors.New("user already exists")
	ErrInvalidCreds            = errors.New("invalid credentials")
	ErrUserNameOrPasswdIsEmpty = errors.New("user_name and password are required")
	ErrNilPool                 = errors.New("pool cannot be nil")
)

type UserService struct {
	pool *pgxpool.Pool
}

func NewUserService(pool *pgxpool.Pool) (*UserService, error) {
	if pool == nil {
		return nil, ErrNilPool
	}
	return &UserService{pool: pool}, nil
}

func (s *UserService) Signup(ctx context.Context, userName, password string) (pgtype.UUID, error) {
	if userName == "" || password == "" {
		return pgtype.UUID{}, ErrUserNameOrPasswdIsEmpty
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return pgtype.UUID{}, err
	}
	defer tx.Rollback(ctx)

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return pgtype.UUID{}, err
	}

	id, err := sqlc.New(tx).Signup(ctx, sqlc.SignupParams{
		UserName:       userName,
		HashedPassword: string(hashed),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return pgtype.UUID{}, ErrUserExists
		}
		return pgtype.UUID{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return pgtype.UUID{}, err
	}
	return id, nil
}

func (s *UserService) Login(ctx context.Context, userName, password string) (string, error) {
	if userName == "" || password == "" {
		return "", ErrUserNameOrPasswdIsEmpty
	}

	row, err := sqlc.New(s.pool).Login(ctx, userName)
	if err != nil {
		return "", ErrInvalidCreds
	}

	if err := bcrypt.CompareHashAndPassword([]byte(row.HashedPassword), []byte(password)); err != nil {
		return "", ErrInvalidCreds
	}
	return row.UserName, nil
}
