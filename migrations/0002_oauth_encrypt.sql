-- Migration number: 0002 	 2024-04-06T18:41:09.419Z

DROP TABLE IF EXISTS oauth;

CREATE TABLE oauth (
    user                    TEXT    PRIMARY KEY,
    encrypted_token         BLOB    NOT NULL,
    encrypted_refresh_token BLOB    NOT NULL,
    iv                      BLOB    NOT NULL,
    expires_at              INTEGER NOT NULL,
);

CREATE INDEX idx_oauth_expires_at ON oauth (expires_at);
