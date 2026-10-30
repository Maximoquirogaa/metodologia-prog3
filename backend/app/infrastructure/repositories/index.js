import { getPool } from '../db.js';

export class TenantRepository {
  constructor(db = getPool()) {
    this.db = db;
  }

  async create({ nombre, slug }) {
    const text = `
      INSERT INTO tenants (nombre, slug)
      VALUES ($1, $2)
      RETURNING id, nombre, slug, created_at, updated_at;
    `;
    const res = await this.db.query(text, [nombre, slug]);
    return res.rows[0];
  }

  async findBySlug(slug) {
    const text = `
      SELECT id, nombre, slug, created_at, updated_at
      FROM tenants
      WHERE slug = $1;
    `;
    const res = await this.db.query(text, [slug]);
    return res.rows[0] || null;
  }

  async findById(id) {
    const text = `
      SELECT id, nombre, slug, created_at, updated_at
      FROM tenants
      WHERE id = $1;
    `;
    const res = await this.db.query(text, [id]);
    return res.rows[0] || null;
  }
}

export class OdontologoRepository {
  constructor(db = getPool()) {
    this.db = db;
  }

  async create({ tenant_id, nombre, especialidad = 'Odontología General', activo = true }) {
    const text = `
      INSERT INTO odontologos (tenant_id, nombre, especialidad, activo)
      VALUES ($1, $2, $3, $4)
      RETURNING id, tenant_id, nombre, especialidad, activo, created_at, updated_at;
    `;
    const res = await this.db.query(text, [tenant_id, nombre, especialidad, activo]);
    return res.rows[0];
  }

  async findByTenant(tenant_id) {
    const text = `
      SELECT id, tenant_id, nombre, especialidad, activo, created_at, updated_at
      FROM odontologos
      WHERE tenant_id = $1
      ORDER BY nombre ASC;
    `;
    const res = await this.db.query(text, [tenant_id]);
    return res.rows;
  }

  async findById(tenant_id, id) {
    const text = `
      SELECT id, tenant_id, nombre, especialidad, activo, created_at, updated_at
      FROM odontologos
      WHERE tenant_id = $1 AND id = $2;
    `;
    const res = await this.db.query(text, [tenant_id, id]);
    return res.rows[0] || null;
  }
}

export class PacienteRepository {
  constructor(db = getPool()) {
    this.db = db;
  }

  async create({ tenant_id, nombre, telefono, user_id = null }) {
    const text = `
      INSERT INTO pacientes (tenant_id, nombre, telefono, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, tenant_id, nombre, telefono, user_id, created_at, updated_at;
    `;
    const res = await this.db.query(text, [tenant_id, nombre, telefono, user_id]);
    return res.rows[0];
  }

  async findByTenant(tenant_id) {
    const text = `
      SELECT id, tenant_id, nombre, telefono, user_id, created_at, updated_at
      FROM pacientes
      WHERE tenant_id = $1
      ORDER BY nombre ASC;
    `;
    const res = await this.db.query(text, [tenant_id]);
    return res.rows;
  }

  async findById(tenant_id, id) {
    const text = `
      SELECT id, tenant_id, nombre, telefono, user_id, created_at, updated_at
      FROM pacientes
      WHERE tenant_id = $1 AND id = $2;
    `;
    const res = await this.db.query(text, [tenant_id, id]);
    return res.rows[0] || null;
  }
}

export class TurnoRepository {
  constructor(db = getPool()) {
    this.db = db;
  }

  async create({
    tenant_id,
    odontologo_id,
    paciente_id,
    inicio,
    fin,
    estado = 'reservado',
    token_cancelacion,
  }) {
    const text = `
      INSERT INTO turnos (
        tenant_id, odontologo_id, paciente_id, inicio, fin, estado, token_cancelacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, odontologo_id, paciente_id, inicio, fin, estado, token_cancelacion, created_at, updated_at;
    `;
    const res = await this.db.query(text, [
      tenant_id,
      odontologo_id,
      paciente_id,
      inicio,
      fin,
      estado,
      token_cancelacion,
    ]);
    return res.rows[0];
  }

  async findByTenant(tenant_id, filters = {}) {
    let text = `
      SELECT id, tenant_id, odontologo_id, paciente_id, inicio, fin, estado, token_cancelacion, created_at, updated_at
      FROM turnos
      WHERE tenant_id = $1
    `;
    const params = [tenant_id];

    if (filters.odontologo_id) {
      params.push(filters.odontologo_id);
      text += ` AND odontologo_id = $${params.length}`;
    }

    if (filters.estado) {
      params.push(filters.estado);
      text += ` AND estado = $${params.length}`;
    }

    text += ' ORDER BY inicio ASC;';

    const res = await this.db.query(text, params);
    return res.rows;
  }

  async findById(tenant_id, id) {
    const text = `
      SELECT id, tenant_id, odontologo_id, paciente_id, inicio, fin, estado, token_cancelacion, created_at, updated_at
      FROM turnos
      WHERE tenant_id = $1 AND id = $2;
    `;
    const res = await this.db.query(text, [tenant_id, id]);
    return res.rows[0] || null;
  }

  async cancel(tenant_id, id) {
    const text = `
      UPDATE turnos
      SET estado = 'cancelado', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, odontologo_id, paciente_id, inicio, fin, estado, token_cancelacion, created_at, updated_at;
    `;
    const res = await this.db.query(text, [tenant_id, id]);
    return res.rows[0] || null;
  }

  async cancelByToken(token_cancelacion) {
    const text = `
      UPDATE turnos
      SET estado = 'cancelado', updated_at = NOW()
      WHERE token_cancelacion = $1 AND estado != 'cancelado'
      RETURNING id, tenant_id, odontologo_id, paciente_id, inicio, fin, estado, token_cancelacion, created_at, updated_at;
    `;
    const res = await this.db.query(text, [token_cancelacion]);
    return res.rows[0] || null;
  }
}
