-- 001_core_models.sql
-- Modelos base multi-tenant + constraint anti-overlap (RN-TU-01 / RN-MT-01)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Tabla: tenants (consultorios)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- Tabla: odontologos
CREATE TABLE IF NOT EXISTS odontologos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  especialidad VARCHAR(255) NOT NULL DEFAULT 'Odontología General',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odontologos_tenant ON odontologos(tenant_id);

-- Tabla: pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  user_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pacientes_tenant ON pacientes(tenant_id);

-- Tabla: turnos
CREATE TABLE IF NOT EXISTS turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  odontologo_id UUID NOT NULL REFERENCES odontologos(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'reservado',
  token_cancelacion VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_turnos_estado CHECK (estado IN ('reservado', 'cancelado', 'atendido')),
  CONSTRAINT chk_turnos_rango_valido CHECK (inicio < fin),
  CONSTRAINT turnos_no_overlap EXCLUDE USING gist (
    odontologo_id WITH =,
    tstzrange(inicio, fin) WITH &&
  ) WHERE (estado != 'cancelado')
);

CREATE INDEX IF NOT EXISTS idx_turnos_tenant_odontologo_inicio ON turnos(tenant_id, odontologo_id, inicio);
CREATE INDEX IF NOT EXISTS idx_turnos_token_cancelacion ON turnos(token_cancelacion);
