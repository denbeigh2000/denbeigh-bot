-- Migration number: 0001 	 2023-11-06T05:09:30.735Z

CREATE TABLE users (
    user_id         TEXT    PRIMARY KEY,
    role            INTEGER NOT NULL,
    join_date       INTEGER NOT NULL,
);

CREATE INDEX idx_roles ON users (role);
CREATE INDEX idx_join_date ON users (join_date);

CREATE TABLE group_members (
    group_id    INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    joined_at   INTEGER NOT NULL,
);

CREATE TABLE group_names (
    -- sqlite documentation sez to avoid autoincrement
    -- https://www.sqlite.org/autoinc.html
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    description TEXT,
    created_at  INTEGER NOT NULL,
);
