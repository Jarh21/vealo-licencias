-- ==============================================================================
-- SISTEMA DE LICENCIAS GRUPO VEALO - SCRIPT DDL PARA SUPABASE (POSTGRESQL)
-- ==============================================================================
-- Instrucciones:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com/dashboard)
-- 2. Abre el "SQL Editor" en el menú de la izquierda.
-- 3. Pega todo este código y haz clic en "Run".
-- ==============================================================================

-- 1. Tabla de Configuración General
CREATE TABLE IF NOT EXISTS configuracion (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(50) UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Administradores
CREATE TABLE IF NOT EXISTS administradores (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(100) DEFAULT 'Administrador',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Aplicaciones (Cobrale, Passnet, Vealo Admin)
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

-- 4. Tabla de Planes de Suscripción
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

-- 5. Tabla de Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(LOWER(email));

-- 6. Tabla de Licencias
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

-- 7. Tabla de Pagos
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

-- ==============================================================================
-- INSERCIÓN DE DATOS INICIALES (SEEDS)
-- ==============================================================================

-- A. Configuración por defecto
INSERT INTO configuracion (clave, valor, descripcion)
VALUES 
  ('trial_days', '30', 'Días de prueba inicial para nuevos registros'),
  ('warning_days', '7', 'Días restantes antes de vencer para marcar en amarillo'),
  ('app_title', 'Registro de licencias grupo Vealo', 'Título principal del portal'),
  ('support_whatsapp', '+58 412 1234567', 'Teléfono de contacto o soporte')
ON CONFLICT (clave) DO NOTHING;

-- B. Usuario Administrador por defecto
-- Usuario: admin
-- Contraseña: 1814621111264181*
INSERT INTO administradores (username, password_hash, nombre)
VALUES ('admin', '$2b$10$r31mj9mt68/0tcJAtV6uLulVIOtgmt2q5yjDKjbs0Hq6xDi5x5zaq', 'Administrador General')
ON CONFLICT (username) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;

-- C. Aplicaciones registradas
INSERT INTO aplicaciones (nombre, slug, descripcion, icono, color)
VALUES 
  ('Cobrale', 'cobrale', 'Sistema integral de gestión de cobranzas y cobradores en campo', 'fa-wallet', '#10B981'),
  ('Passnet', 'passnet', 'Plataforma de control de acceso, claves seguras y pases digitales', 'fa-shield-halved', '#3B82F6'),
  ('Vealo Admin', 'vealo-admin', 'Panel de supervisión móvil y monitoreo del Grupo Vealo', 'fa-chart-pie', '#8B5CF6')
ON CONFLICT (nombre) DO UPDATE 
SET slug = EXCLUDED.slug, descripcion = EXCLUDED.descripcion, icono = EXCLUDED.icono, color = EXCLUDED.color;

-- D. Planes de suscripción
INSERT INTO planes (nombre, duracion_dias, precio, descripcion)
VALUES 
  ('Prueba de Bienvenida', 30, 0.00, '30 días de acceso total gratuito'),
  ('Plan Mensual', 30, 15.00, 'Acceso ilimitado por 1 mes (30 días)'),
  ('Plan Trimestral', 90, 40.00, 'Acceso ilimitado por 3 meses (90 días con descuento)'),
  ('Plan Semestral', 180, 75.00, 'Acceso ilimitado por 6 meses (180 días con ahorro)'),
  ('Plan Anual', 365, 140.00, 'Acceso ilimitado por 1 año (365 días - Mejor valor)')
ON CONFLICT DO NOTHING;

-- E. Datos de demostración (Verde, Amarillo, Rojo, Bloqueada)
DO $$
DECLARE
  v_cobrale_id INT;
  v_passnet_id INT;
  v_admin_id INT;
  v_plan_id INT;
  v_c1_id INT;
  v_c2_id INT;
  v_c3_id INT;
  v_c4_id INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clientes LIMIT 1) THEN
    SELECT id INTO v_cobrale_id FROM aplicaciones WHERE nombre = 'Cobrale' LIMIT 1;
    SELECT id INTO v_passnet_id FROM aplicaciones WHERE nombre = 'Passnet' LIMIT 1;
    SELECT id INTO v_admin_id FROM aplicaciones WHERE nombre = 'Vealo Admin' LIMIT 1;
    SELECT id INTO v_plan_id FROM planes WHERE nombre = 'Plan Mensual' LIMIT 1;

    -- Cliente 1: Activo (Verde) - Vence en 25 días
    INSERT INTO clientes (nombre, email, telefono)
    VALUES ('Carlos Mendoza', 'carlos@ejemplo.com', '+58 414 555-1234')
    RETURNING id INTO v_c1_id;

    INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado)
    VALUES (v_c1_id, v_cobrale_id, v_plan_id, 'COB-8F42-99B1-2026', NOW(), NOW() + INTERVAL '25 days', 'activa');

    -- Cliente 2: Próximo a vencer (Amarillo) - Vence en 4 días
    INSERT INTO clientes (nombre, email, telefono)
    VALUES ('María Rodríguez', 'maria@ejemplo.com', '+58 412 888-4321')
    RETURNING id INTO v_c2_id;

    INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado)
    VALUES (v_c2_id, v_passnet_id, v_plan_id, 'PAS-33A1-77C9-2026', NOW() - INTERVAL '26 days', NOW() + INTERVAL '4 days', 'activa');

    -- Cliente 3: Vencido / Inactivo (Rojo) - Venció hace 5 días
    INSERT INTO clientes (nombre, email, telefono)
    VALUES ('Inversiones Alfa C.A.', 'contacto@alfa.com', '+58 424 999-7711')
    RETURNING id INTO v_c3_id;

    INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado)
    VALUES (v_c3_id, v_admin_id, v_plan_id, 'VEA-90E4-11K2-2026', NOW() - INTERVAL '35 days', NOW() - INTERVAL '5 days', 'inactiva');

    -- Cliente 4: Bloqueado por administrador (Rojo / Bloqueada)
    INSERT INTO clientes (nombre, email, telefono)
    VALUES ('Roberto Gómez', 'roberto@ejemplo.com', '+58 416 333-8822')
    RETURNING id INTO v_c4_id;

    INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado, bloqueada_manualmente, motivo_bloqueo)
    VALUES (v_c4_id, v_cobrale_id, v_plan_id, 'COB-11B2-88F4-2026', NOW(), NOW() + INTERVAL '20 days', 'bloqueada', true, 'Pago reportado fraudulento');

    -- Pago de prueba pendiente
    INSERT INTO pagos (cliente_id, app_id, plan_id, referencia, monto, fecha_reporte, estado, dias_otorgados, observaciones)
    VALUES (v_c1_id, v_cobrale_id, v_plan_id, 'PAG-78945612', 15.00, NOW(), 'pendiente', 30, 'Reporte de pago móvil Banco Mercantil');
  END IF;
END $$;

