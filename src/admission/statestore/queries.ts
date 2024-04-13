const PENDING_TABLE = "users_pending_entry";
const INT_STATE_TABLE = "pending_user_interaction_state";

export interface FetchPendingResult {
    messageID: string,
}

export const fetchPendingUser = `
SELECT message_id AS messageID
FROM "${PENDING_TABLE}"
WHERE target_user_id = ?1
LIMIT 1;
`;

export const insertActionMessage = `
INSERT INTO "${PENDING_TABLE}"
    (target_user_id, message_id)
    VALUES (?1, ?2);
`;

const roleQuery = (col: string) => `
INSERT INTO "${INT_STATE_TABLE}"
    (target_user_id, interactor_id, ${col})
    VALUES (?1, ?2, ?3)

ON CONFLICT (target_user_id, interactor_id) DO
    UPDATE SET ${col} = excluded.${col};
`;

export const setRole = roleQuery("primary_role");
export const setAuxRoles = roleQuery("aux_roles");

export interface StateResult {
    roleRaw: string | null,
    auxRolesRaw: string | null,
}

export const selectState = `
SELECT
    ${INT_STATE_TABLE}.primary_role as roleRaw,
    ${INT_STATE_TABLE}.aux_roles as auxRolesRaw
FROM ${PENDING_TABLE}
    JOIN ${INT_STATE_TABLE} ON (
        ${INT_STATE_TABLE}.target_user_id = ${PENDING_TABLE}.target_user_id
)
WHERE
    ${INT_STATE_TABLE}.target_user_id = ?1
    AND ${INT_STATE_TABLE}.interactor_id = ?2
LIMIT 1;
`;

export const deleteState = `
DELETE FROM ${PENDING_TABLE}
WHERE target_user_id = ?1;
`;
