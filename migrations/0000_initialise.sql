-- Migration number: 0000 	 2023-11-05T02:35:15.339Z

CREATE TABLE oauth (
    access_token_hash   TEXT    PRIMARY KEY,
    refresh_token       TEXT    NOT NULL,
    expires_at          INTEGER NOT NULL,
    user                TEXT    NOT NULL
);

CREATE INDEX idx_oauth_expires_at ON oauth (expires_at);
CREATE INDEX idx_oauth_user_expires_at ON oauth (user, expires_at);
