const { Client, Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:317464192@localhost:5432/licencias_vealo';

async function initDatabase() {
  console.log('--- Iniciando configuración de Base de Datos PostgreSQL ---');

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  // Parse connection string to get db name and connection to postgres maintenance db
  const url = new URL(connectionString);
  const targetDbName = url.pathname.replace(/^\//, '') || 'licencias_vealo';

  // Solo intentamos crear la BD localmente en PostgreSQL estándar
  if (isLocal) {
    const maintenanceUrl = new URL(connectionString);
    maintenanceUrl.pathname = '/postgres';

    const maintenanceClient = new Client({
      connectionString: maintenanceUrl.toString(),
    });

    try {
      await maintenanceClient.connect();
      console.log('Conectado a PostgreSQL (postgres)...');

      const checkDbRes = await maintenanceClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [targetDbName]
      );

      if (checkDbRes.rowCount === 0) {
        console.log(`Base de datos "${targetDbName}" no existe. Creándola...`);
        await maintenanceClient.query(`CREATE DATABASE "${targetDbName}"`);
        console.log(`Base de datos "${targetDbName}" creada exitosamente.`);
      } else {
        console.log(`Base de datos "${targetDbName}" ya existe.`);
      }
    } catch (err) {
      console.warn('Nota al verificar/crear base de datos:', err.message);
    } finally {
      try {
        await maintenanceClient.end();
      } catch (_) {}
    }
  }

  // Connect to target database
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log(`Conectado a la base de datos "${targetDbName}". Creando tablas...`);

    // Tablas
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(50) UNIQUE NOT NULL,
        valor TEXT NOT NULL,
        descripcion TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS administradores (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(100) DEFAULT 'Administrador',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS aplicaciones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        descripcion TEXT,
        icono VARCHAR(100) DEFAULT 'fas fa-mobile-alt',
        color VARCHAR(50) DEFAULT '#133E36',
        activa BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS planes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        duracion_dias INT NOT NULL,
        precio NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        moneda VARCHAR(10) DEFAULT 'USD',
        descripcion TEXT,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL,
        telefono VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(LOWER(email));

      CREATE TABLE IF NOT EXISTS licencias (
        id SERIAL PRIMARY KEY,
        cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        app_id INT NOT NULL REFERENCES aplicaciones(id) ON DELETE CASCADE,
        plan_id INT REFERENCES planes(id) ON DELETE SET NULL,
        license_key VARCHAR(64) UNIQUE,
        fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_fin TIMESTAMP NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activa',
        bloqueada_manualmente BOOLEAN DEFAULT false,
        motivo_bloqueo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_cliente_app UNIQUE (cliente_id, app_id)
      );

      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        app_id INT NOT NULL REFERENCES aplicaciones(id) ON DELETE CASCADE,
        plan_id INT REFERENCES planes(id) ON DELETE SET NULL,
        referencia VARCHAR(100) UNIQUE NOT NULL,
        monto NUMERIC(10, 2) NOT NULL,
        fecha_reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        dias_otorgados INT DEFAULT 30,
        observaciones TEXT,
        fecha_validacion TIMESTAMP,
        validado_por INT REFERENCES administradores(id) ON DELETE SET NULL
      );
    `);

    console.log('Tablas verificadas/creadas con éxito.');

    // Seed Configuración
    await client.query(`
      INSERT INTO configuracion (clave, valor, descripcion)
      VALUES 
        ('trial_days', '30', 'Días de prueba inicial para nuevos registros'),
        ('warning_days', '7', 'Días restantes antes de vencer para marcar en amarillo'),
        ('app_title', 'Registro de licencias grupo Vealo', 'Título principal del portal'),
        ('support_whatsapp', '+58 412 1234567', 'Teléfono de contacto o soporte')
      ON CONFLICT (clave) DO NOTHING;
    `);

    // Seed Administrador hardcodeado: admin / 1814621111264181*
    const adminPassword = '1814621111264181*';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPassword, salt);

    await client.query(`
      INSERT INTO administradores (username, password_hash, nombre)
      VALUES ('admin', $1, 'Administrador General')
      ON CONFLICT (username) DO UPDATE 
      SET password_hash = $1;
    `, [hash]);
    console.log('Usuario administrador hardcodeado configurado: "admin"');

    // Seed Aplicaciones ("Cobrale", "Passnet", "Vealo Admin")
    await client.query(`
      INSERT INTO aplicaciones (nombre, slug, descripcion, icono, color)
      VALUES 
        ('Cobrale', 'cobrale', 'Sistema integral de gestión de cobranzas y cobradores en campo', 'fa-wallet', '#10B981'),
        ('Passnet', 'passnet', 'Plataforma de control de acceso, claves seguras y pases digitales', 'fa-shield-halved', '#3B82F6'),
        ('Vealo Admin', 'vealo-admin', 'Panel de supervisión móvil y monitoreo del Grupo Vealo', 'fa-chart-pie', '#8B5CF6')
      ON CONFLICT (nombre) DO UPDATE 
      SET slug = EXCLUDED.slug, descripcion = EXCLUDED.descripcion, icono = EXCLUDED.icono, color = EXCLUDED.color;
    `);
    console.log('Aplicaciones registradas: Cobrale, Passnet, Vealo Admin.');

    // Seed Planes
    await client.query(`
      INSERT INTO planes (nombre, duracion_dias, precio, descripcion)
      VALUES 
        ('Prueba de Bienvenida', 30, 0.00, '30 días de acceso total gratuito'),
        ('Plan Mensual', 30, 15.00, 'Acceso ilimitado por 1 mes (30 días)'),
        ('Plan Trimestral', 90, 40.00, 'Acceso ilimitado por 3 meses (90 días con descuento)'),
        ('Plan Semestral', 180, 75.00, 'Acceso ilimitado por 6 meses (180 días con ahorro)'),
        ('Plan Anual', 365, 140.00, 'Acceso ilimitado por 1 año (365 días - Mejor valor)')
      ON CONFLICT DO NOTHING;
    `);
    console.log('Planes de suscripción registrados.');

    // Seed some initial demo clients if empty (to showcase Verde, Amarillo, Rojo)
    const clientCountRes = await client.query('SELECT COUNT(*) FROM clientes');
    if (parseInt(clientCountRes.rows[0].count, 10) === 0) {
      console.log('Insertando clientes y licencias de demostración (Verde, Amarillo, Rojo)...');
      
      // Get apps
      const appsRes = await client.query('SELECT id, nombre FROM aplicaciones ORDER BY id');
      const cobraleId = appsRes.rows.find(a => a.nombre === 'Cobrale')?.id || 1;
      const passnetId = appsRes.rows.find(a => a.nombre === 'Passnet')?.id || 2;
      const vealoAdminId = appsRes.rows.find(a => a.nombre === 'Vealo Admin')?.id || 3;

      // Plan mensual
      const planRes = await client.query('SELECT id FROM planes WHERE nombre = $1', ['Plan Mensual']);
      const planId = planRes.rows[0]?.id || 1;

      // Client 1: Activo (Verde) - Vence en 25 días
      const c1 = await client.query(`
        INSERT INTO clientes (nombre, email, telefono)
        VALUES ('Carlos Mendoza', 'carlos@ejemplo.com', '+58 414 555-1234')
        RETURNING id;
      `);
      await client.query(`
        INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado)
        VALUES ($1, $2, $3, 'COB-8F42-99B1-2026', NOW(), NOW() + INTERVAL '25 days', 'activa');
      `, [c1.rows[0].id, cobraleId, planId]);

      // Client 2: Próximo a vencer (Amarillo) - Vence en 4 días
      const c2 = await client.query(`
        INSERT INTO clientes (nombre, email, telefono)
        VALUES ('María Rodríguez', 'maria@ejemplo.com', '+58 412 888-4321')
        RETURNING id;
      `);
      await client.query(`
        INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado)
        VALUES ($1, $2, $3, 'PAS-33A1-77C9-2026', NOW() - INTERVAL '26 days', NOW() + INTERVAL '4 days', 'activa');
      `, [c2.rows[0].id, passnetId, planId]);

      // Client 3: Vencido / Inactivo (Rojo) - Venció hace 5 días
      const c3 = await client.query(`
        INSERT INTO clientes (nombre, email, telefono)
        VALUES ('Inversiones Alfa C.A.', 'contacto@alfa.com', '+58 424 999-7711')
        RETURNING id;
      `);
      await client.query(`
        INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado)
        VALUES ($1, $2, $3, 'VEA-90E4-11K2-2026', NOW() - INTERVAL '35 days', NOW() - INTERVAL '5 days', 'inactiva');
      `, [c3.rows[0].id, vealoAdminId, planId]);

      // Client 4: Bloqueado por administrador (Rojo con badge Bloqueada)
      const c4 = await client.query(`
        INSERT INTO clientes (nombre, email, telefono)
        VALUES ('Roberto Gómez', 'roberto@ejemplo.com', '+58 416 333-8822')
        RETURNING id;
      `);
      await client.query(`
        INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado, bloqueada_manualmente, motivo_bloqueo)
        VALUES ($1, $2, $3, 'COB-11B2-88F4-2026', NOW(), NOW() + INTERVAL '20 days', 'bloqueada', true, 'Pago reportado fraudulento');
      `, [c4.rows[0].id, cobraleId, planId]);

      // Seed a pending payment for testing
      await client.query(`
        INSERT INTO pagos (cliente_id, app_id, plan_id, referencia, monto, fecha_reporte, estado, dias_otorgados, observaciones)
        VALUES ($1, $2, $3, 'PAG-78945612', 15.00, NOW(), 'pendiente', 30, 'Reporte de pago móvil Banco Mercantil');
      `, [c1.rows[0].id, cobraleId, planId]);

      console.log('Clientes y datos de prueba sembrados exitosamente.');
    }

    client.release();
    console.log('--- Configuración de Base de Datos completada con ÉXITO ---');
  } catch (err) {
    console.error('Error durante la inicialización de la BD:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initDatabase().catch(() => process.exit(1));
}

module.exports = { initDatabase };

