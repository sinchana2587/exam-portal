-- V10: Support 'Synchronisation Failed' status in session_unlock_credential for existing installations

ALTER TABLE session_unlock_credential DROP CONSTRAINT IF EXISTS session_unlock_credential_status_check;

ALTER TABLE session_unlock_credential
    ADD CONSTRAINT session_unlock_credential_status_check
    CHECK (status IN ('Active', 'Revoked', 'Expired', 'Superseded', 'Synchronisation Failed'));
