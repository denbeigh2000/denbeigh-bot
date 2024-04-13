const TABLE_NAME = "oauth";

export interface UpsertResult {
    old_iv: ArrayBuffer | null;
    old_encrypted_token: ArrayBuffer | null;
}

export const upsertOne = `
INSERT INTO "${TABLE_NAME}" (
        user,
        encrypted_token,
        encrypted_refresh_token,
        iv,
        expires_at
    )
    VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT (user) DO
    UPDATE SET
        encrypted_token = excluded.encrypted_token,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        iv = excluded.iv,
        expires_at = excluded.expires_at,
        old_encrypted_token = encrypted_token,
        old_iv = iv
RETURNING old_encrypted_token, old_iv;
`;

export const replaceOne = `
UPDATE "${TABLE_NAME}"
SET
    encrypted_token = ?1,
    encrypted_refresh_token = ?2,
    iv = ?3,
    expires_at = ?4,

WHERE
    user = ?5
RETURNING old_encrypted_token, old_iv;
`;

export interface GetResult {
    encrypted_token: ArrayBuffer,
    encrypted_refresh_token: ArrayBuffer,
    iv: ArrayBuffer,
    expires_at: number,
}

export const getOne = `
SELECT encrypted_token, encrypted_refresh_token, iv, expires_at
FROM "${TABLE_NAME}"
WHERE user = ?1
LIMIT 1;
`;
