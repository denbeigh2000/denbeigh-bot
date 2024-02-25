-- Migration number: 0001 	 2024-02-24T22:55:17.140Z

CREATE TABLE users_pending_entry (
    target_user_id  TEXT    PRIMARY KEY,
    message_id      TEXT    NOT NULL
);

CREATE TABLE pending_user_interaction_state (
    target_user_id  TEXT    NOT NULL,
    interactor_id   TEXT    NOT NULL
    role            TEXT    DEFAULT NULL,
    aux_roles       TEXT    DEFAULT NULL,

    PRIMARY KEY (target_user_id, interactor_id),
    FOREIGN KEY (target_user_id) REFERENCES users_pending_entry(target_user_id) ON DELETE CASCADE
);

-- Be sure to make an index on the FK child column, sqlite does not do this for
-- us! https://www.sqlite.org/foreignkeys.html#fk_indexes
CREATE INDEX idx_pending_int_state_user_id ON pending_user_interaction_state(target_user_id);
