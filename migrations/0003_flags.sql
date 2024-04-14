-- Migration number: 0003 	 2024-04-13T22:58:38.274Z

CREATE TABLE flag_roles (
    country_code    TEXT NOT NULL,
    -- NOTE: having NOT NULL means we cannot really guard against two requests
    -- making the same role at the same time. Maybe reconsider someday?
    role_id         TEXT NOT NULL,
    -- If >0, marked for deletion
    tombstoned      INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (country_code, tombstoned)
);

-- Want this so we can efficiently join flags on user_flags
CREATE INDEX idx_flag_roles_country_code ON flag_roles (country_code);

CREATE TABLE user_flags (
    user_id         TEXT NOT NULL PRIMARY KEY,
    country_code    TEXT NOT NULL
);

-- Want this so we can efficiently join flags on user_flags
CREATE INDEX idx_user_flags_country_code ON user_flags (country_code);
