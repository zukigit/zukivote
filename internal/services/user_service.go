package services

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/zukigit/zukivote/db/sqlc"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserExists   = errors.New("user already exists")
	ErrInvalidCreds = errors.New("invalid credentials")
)

type UserService struct {
	q *sqlc.Queries
}

func NewUserService(q *sqlc.Queries) *UserService {
	return &UserService{q: q}
}

func (s *UserService) Signup(ctx context.Context, userName, password string) (pgtype.UUID, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return pgtype.UUID{}, err
	}

	id, err := s.q.Signup(ctx, sqlc.SignupParams{
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
	return id, nil
}

func (s *UserService) Login(ctx context.Context, userName, password string) (string, error) {
	row, err := s.q.Login(ctx, userName)
	if err != nil {
		return "", ErrInvalidCreds
	}

	if err := bcrypt.CompareHashAndPassword([]byte(row.HashedPassword), []byte(password)); err != nil {
		return "", ErrInvalidCreds
	}
	return row.UserName, nil
}
