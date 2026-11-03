-- 003_users_odontologo.sql
-- Vincula un usuario interno con rol odontólogo con su registro en odontologos (C-05).
-- Nullable: las secretarias no tienen odontólogo asociado y los usuarios ya
-- existentes no requieren backfill. ON DELETE SET NULL evita romper el login si
-- se elimina el odontólogo.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS odontologo_id UUID NULL
  REFERENCES odontologos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_tenant_odontologo
  ON users(tenant_id, odontologo_id);
