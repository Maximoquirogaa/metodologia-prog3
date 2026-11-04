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

export class UserRepository {
  constructor(db = getPool()) {
    this.db = db;
  }

  async create({ tenant_id, email, password_hash, rol, odontologo_id = null }) {
    const text = `
      INSERT INTO users (tenant_id, email, password_hash, rol, odontologo_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, email, rol, odontologo_id, created_at;
    `;
    const res = await this.db.query(text, [tenant_id, email, password_hash, rol, odontologo_id]);
    return res.rows[0];
  }

  async findByEmailAndTenant(tenant_id, email) {
    const text = `
      SELECT id, tenant_id, email, password_hash, rol, odontologo_id, created_at
      FROM users
      WHERE tenant_id = $1 AND email = $2;
    `;
    const res = await this.db.query(text, [tenant_id, email]);
    return res.rows[0] || null;
  }

  async findById(tenant_id, id) {
    const text = `
      SELECT id, tenant_id, email, rol, odontologo_id, created_at
      FROM users
      WHERE tenant_id = $1 AND id = $2;
    `;
    const res = await this.db.query(text, [tenant_id, id]);
    return res.rows[0] || null;
  }

  /**
   * Setea (o corrige) el vínculo con un odontólogo. Scoped por tenant: nunca
   * permite mover un usuario de consultorio. Lo usa el seed para dejar el
   * usuario demo consistente en corridas repetidas.
   */
  async linkOdontologo(tenant_id, id, odontologo_id) {
    const text = `
      UPDATE users
      SET odontologo_id = $3
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, email, rol, odontologo_id, created_at;
    `;
    const res = await this.db.query(text, [tenant_id, id, odontologo_id]);
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

  /**
   * Busca el paciente por teléfono dentro del tenant. La reserva pública
   * reutiliza el registro existente en vez de duplicarlo (match por teléfono,
   * nunca global: un teléfono puede repetirse en otro tenant).
   */
  async findByTelefono(tenant_id, telefono) {
    const text = `
      SELECT id, tenant_id, nombre, telefono, user_id, created_at, updated_at
      FROM pacientes
      WHERE tenant_id = $1 AND telefono = $2
      ORDER BY created_at ASC
      LIMIT 1;
    `;
    const res = await this.db.query(text, [tenant_id, telefono]);
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

  /**
   * Turnos de un día completo con paciente y odontólogo expandidos.
   * Scoped por tenant en la tabla base y en ambos JOIN. Incluye todos los
   * estados (la agenda muestra también los cancelados) y no selecciona
   * `token_cancelacion`: es un secreto de cancelación que la agenda no necesita.
   */
  async findByDay(tenant_id, { desde, hasta, odontologo_id } = {}) {
    let text = `
      SELECT t.id, t.inicio, t.fin, t.estado,
             p.id AS paciente_id, p.nombre AS paciente_nombre, p.telefono AS paciente_telefono,
             o.id AS odontologo_id, o.nombre AS odontologo_nombre
      FROM turnos t
      JOIN pacientes p ON p.id = t.paciente_id AND p.tenant_id = t.tenant_id
      JOIN odontologos o ON o.id = t.odontologo_id AND o.tenant_id = t.tenant_id
      WHERE t.tenant_id = $1 AND t.inicio >= $2 AND t.inicio < $3
    `;
    const params = [tenant_id, desde, hasta];

    if (odontologo_id) {
      params.push(odontologo_id);
      text += ` AND t.odontologo_id = $${params.length}`;
    }

    text += ' ORDER BY t.inicio ASC;';

    const res = await this.db.query(text, params);
    return res.rows;
  }

  /**
   * Turnos activos del odontólogo que se superponen con el rango [desde, hasta).
   * Un turno cancelado no ocupa el slot, por eso queda fuera de la consulta:
   * la disponibilidad pública no debe leer sus datos.
   */
  async findActivosByOdontologoAndDay(tenant_id, odontologo_id, desde, hasta) {
    const text = `
      SELECT id, tenant_id, odontologo_id, paciente_id, inicio, fin, estado
      FROM turnos
      WHERE tenant_id = $1
        AND odontologo_id = $2
        AND estado IN ('reservado', 'atendido')
        AND inicio < $4
        AND fin > $3
      ORDER BY inicio ASC;
    `;
    const res = await this.db.query(text, [tenant_id, odontologo_id, desde, hasta]);
    return res.rows;
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

  /**
   * Turno por token de cancelación, scopeado por tenant. El token es el único
   * secreto del flujo público: buscar dentro del tenant evita filtrar la
   * existencia de turnos de otro consultorio (responde lo mismo que un token
   * inexistente). No selecciona `token_cancelacion` en la respuesta.
   */
  async findByToken(tenant_id, token_cancelacion) {
    const text = `
      SELECT t.id, t.inicio, t.fin, t.estado,
             p.id AS paciente_id, p.nombre AS paciente_nombre,
             o.id AS odontologo_id, o.nombre AS odontologo_nombre
      FROM turnos t
      JOIN pacientes p ON p.id = t.paciente_id AND p.tenant_id = t.tenant_id
      JOIN odontologos o ON o.id = t.odontologo_id AND o.tenant_id = t.tenant_id
      WHERE t.tenant_id = $1 AND t.token_cancelacion = $2;
    `;
    const res = await this.db.query(text, [tenant_id, token_cancelacion]);
    return res.rows[0] || null;
  }

  /**
   * Cancela por token dentro del tenant. La guarda `estado != 'cancelado'`
   * evita dobles actualizaciones concurrentes; el servicio resuelve la
   * idempotencia leyendo el turno antes.
   */
  async cancelByToken(tenant_id, token_cancelacion) {
    const text = `
      UPDATE turnos
      SET estado = 'cancelado', updated_at = NOW()
      WHERE tenant_id = $1 AND token_cancelacion = $2 AND estado != 'cancelado'
      RETURNING id, tenant_id, odontologo_id, paciente_id, inicio, fin, estado, created_at, updated_at;
    `;
    const res = await this.db.query(text, [tenant_id, token_cancelacion]);
    return res.rows[0] || null;
  }
}
