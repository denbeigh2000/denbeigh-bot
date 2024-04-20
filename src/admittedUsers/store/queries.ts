const usersTableName = "admitted_users";
const auxRoleTableName = "aux_role_assignments";

export const upsertQuery = `
INSERT INTO
    ${usersTableName}
    (user_id, state, added_at, updated_at)
VALUES
    ($1, $2, $3, $4)
ON CONFLICT (user_id) DO
    UPDATE SET
        state = excluded.state
        updated_at = excluded.updated_at
    WHERE
        excluded.updated_at > ${usersTableName}.updated_at
        AND state != excluded.state;
`;

export const getQuery = `
SELECT
    status,
    added_at AS addedAt,
    updated_at AS roleUpdatedAt,
FROM
    ${usersTableName}
WHERE
    user_id = $1
LIMIT 1;
`;

export const removeQuery = `
DELETE
FROM
    ${usersTableName}
WHERE
    user_id = $1
LIMIT 1;
`;

export const addAuxRoleQuery = `
INSERT INTO
    ${auxRoleTableName}
    (user_id, aux_role, added_at)
VALUES
    ($1, $2, $3)
ON CONFLICT (user_id, aux_role) DO
    NOTHING;
`;

export const removeAuxRoleQuery = `
DELETE FROM
    ${auxRoleTableName}
WHERE
    user_id = $1
    AND aux_role = $2;
`;

export const getAuxRolesQuery = `
SELECT
    aux_role,
    added_at AS addedAt
FROM
    ${auxRoleTableName}
WHERE
    user_id = $1;
`;
