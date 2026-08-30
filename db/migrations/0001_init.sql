CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_name       VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL
);

CREATE TABLE topics (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_at   INTEGER NOT NULL,
    expired_at INTEGER NOT NULL
);

CREATE TABLE voters (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE items (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    topic_id    UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    description VARCHAR NOT NULL,
    photo_url   VARCHAR
);

CREATE TABLE item_values (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    key     VARCHAR NOT NULL,
    value   VARCHAR NOT NULL,
    UNIQUE (item_id, key)
);

CREATE TABLE records (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voter_id   UUID NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
    item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE (voter_id, item_id)
);
