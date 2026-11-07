const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// Helper to generate a friendly License Key
function generateLicenseKey(appPrefix = 'VEA') {
  const p1 = appPrefix.substring(0, 3).toUpperCase();
  const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const p3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const year = new Date().getFullYear();
  return `${p1}-${p2}-${p3}-${year}`;
}

// -------------------------------------------------------------
// 1. API VERIFICACIÓN DE LICENCIA PARA LA APP MÓVIL
// GET & POST /api/v1/license/check
// Retorna activo(1) o inactivo(0)
// Parámetros: email (o correo), app (nombre o slug)
// -------------------------------------------------------------
const handleLicenseCheck = async (req, res) => {
  const email = (req.query.email || req.query.correo || req.body?.email || req.body?.correo || '').trim().toLowerCase();
  const appParam = (req.query.app || req.body?.app || req.query.app_name || req.body?.app_name || '').trim();

  if (!email || !appParam) {
    return res.status(400).json({
      status: 0,
      condition: 'invalid_request',
      message: 'Debe especificar el correo electrónico y la aplicación a verificar.',
    });
  }

  try {
    // 1. Buscar cliente por correo
    const clientRes = await db.query(
      'SELECT id, nombre, email, telefono FROM clientes WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (clientRes.rows.length === 0) {
      return res.status(200).json({
        status: 0,
        condition: 'not_found',
        message: 'Cliente no registrado en el sistema Grupo Vealo.',
      });
    }

    const cliente = clientRes.rows[0];

    // 2. Buscar aplicación
    const appRes = await db.query(
      `SELECT id, nombre, slug, activa FROM aplicaciones 
       WHERE LOWER(nombre) = LOWER($1) OR LOWER(slug) = LOWER($1) OR id::text = $1`,
      [appParam]
    );

    if (appRes.rows.length === 0) {
      return res.status(200).json({
        status: 0,
        condition: 'app_not_found',
        message: `La aplicación "${appParam}" no existe en el sistema.`,
      });
    }

    const app = appRes.rows[0];

    // 3. Buscar la licencia para ese cliente y esa app
    const licRes = await db.query(
      `SELECT l.id, l.license_key, l.fecha_inicio, l.fecha_fin, l.estado, 
              l.bloqueada_manualmente, l.motivo_bloqueo, p.nombre as plan_nombre
       FROM licencias l
       LEFT JOIN planes p ON p.id = l.plan_id
       WHERE l.cliente_id = $1 AND l.app_id = $2`,
      [cliente.id, app.id]
    );

    if (licRes.rows.length === 0) {
      return res.status(200).json({
        status: 0,
        condition: 'no_license',
        message: `El usuario no posee una licencia registrada para ${app.nombre}.`,
      });
    }

    const licencia = licRes.rows[0];
    const now = new Date();
    const fechaFin = new Date(licencia.fecha_fin);
    const msLeft = fechaFin.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    // Verificación de bloqueo manual por el administrador
    if (licencia.bloqueada_manualmente || licencia.estado === 'bloqueada') {
      return res.status(200).json({
        status: 0,
        condition: 'blocked',
        message: 'Licencia bloqueada por el administrador.',
        motivo: licencia.motivo_bloqueo || 'Consulte con administración de Grupo Vealo.',
        app: app.nombre,
        expires_at: licencia.fecha_fin,
        days_left: Math.max(0, daysLeft),
      });
    }

    // Verificación de vencimiento
    if (daysLeft <= 0 || now > fechaFin) {
      // Actualizar estado en BD a 'inactiva' si aún figuraba como activa
      if (licencia.estado !== 'inactiva') {
        await db.query(
          "UPDATE licencias SET estado = 'inactiva', updated_at = NOW() WHERE id = $1",
          [licencia.id]
        );
      }

      return res.status(200).json({
        status: 0,
        condition: 'expired',
        message: 'La licencia ha expirado. Por favor reporte su pago para renovarla.',
        app: app.nombre,
        expires_at: licencia.fecha_fin,
        days_left: 0,
      });
    }

    // Licencia activa (1)
    return res.status(200).json({
      status: 1,
      condition: 'active',
      message: 'Licencia activa y válida.',
      app: app.nombre,
      cliente: cliente.nombre,
      license_key: licencia.license_key,
      plan: licencia.plan_nombre || 'Plan Activo',
      expires_at: licencia.fecha_fin,
      days_left: daysLeft,
    });
  } catch (err) {
    console.error('Error en /license/check:', err);
    return res.status(500).json({
      status: 0,
      condition: 'error',
      message: 'Error interno al consultar la licencia.',
    });
  }
};

router.get('/license/check', handleLicenseCheck);
router.post('/license/check', handleLicenseCheck);

// -------------------------------------------------------------
// 2. DATOS PÚBLICOS (APPS Y PLANES ACTIVOS)
// GET /api/v1/public/apps-and-plans
// -------------------------------------------------------------
router.get('/public/apps-and-plans', async (req, res) => {
  try {
    const apps = await db.query(
      'SELECT id, nombre, slug, descripcion, icono, color FROM aplicaciones WHERE activa = true ORDER BY id ASC'
    );
    const planes = await db.query(
      'SELECT id, nombre, duracion_dias, precio, moneda, descripcion FROM planes WHERE activo = true ORDER BY duracion_dias ASC'
    );
    const configRes = await db.query(
      "SELECT valor FROM configuracion WHERE clave = 'trial_days'"
    );
    const trialDays = configRes.rows[0]?.valor ? parseInt(configRes.rows[0].valor, 10) : 30;

    res.json({
      apps: apps.rows,
      planes: planes.rows,
      trial_days: trialDays,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar catálogo público.' });
  }
});

// -------------------------------------------------------------
// 3. REGISTRO PÚBLICO DE CLIENTES CON PRUEBA CONFIGURABLE
// POST /api/v1/public/register
// -------------------------------------------------------------
router.post('/public/register', async (req, res) => {
  const { nombre, email, telefono, app_id, plan_id } = req.body;

  if (!nombre || !email || !telefono || !app_id) {
    return res.status(400).json({
      error: 'Nombre, correo electrónico, teléfono y aplicación son obligatorios.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanNombre = nombre.trim();
  const cleanTelefono = telefono.trim();

  try {
    // 1. Obtener app
    const appRes = await db.query('SELECT id, nombre, slug FROM aplicaciones WHERE id = $1', [app_id]);
    if (appRes.rows.length === 0) {
      return res.status(400).json({ error: 'La aplicación seleccionada no es válida.' });
    }
    const app = appRes.rows[0];

    // 2. Obtener días de prueba de la tabla de configuración
    const configRes = await db.query(
      "SELECT valor FROM configuracion WHERE clave = 'trial_days'"
    );
    const trialDays = configRes.rows[0]?.valor ? parseInt(configRes.rows[0].valor, 10) : 30;

    // 3. Registrar o reutilizar cliente
    let clienteId;
    const existingClient = await db.query('SELECT id FROM clientes WHERE LOWER(email) = LOWER($1)', [cleanEmail]);

    if (existingClient.rows.length > 0) {
      clienteId = existingClient.rows[0].id;
      // Actualizar teléfono y nombre si variaron
      await db.query(
        'UPDATE clientes SET nombre = $1, telefono = $2 WHERE id = $3',
        [cleanNombre, cleanTelefono, clienteId]
      );
    } else {
      const newClient = await db.query(
        'INSERT INTO clientes (nombre, email, telefono) VALUES ($1, $2, $3) RETURNING id',
        [cleanNombre, cleanEmail, cleanTelefono]
      );
      clienteId = newClient.rows[0].id;
    }

    // 4. Verificar si ya tiene licencia en esa app
    const existingLic = await db.query(
      'SELECT id, license_key, fecha_fin, estado FROM licencias WHERE cliente_id = $1 AND app_id = $2',
      [clienteId, app.id]
    );

    if (existingLic.rows.length > 0) {
      return res.status(400).json({
        error: `Ya existe una cuenta con este correo registrada en la app "${app.nombre}". Puedes usar la opción de "Pagar suscripción" para renovarla.`,
        license_key: existingLic.rows[0].license_key,
      });
    }

    // 5. Determinar plan inicial (por defecto plan de prueba gratuita)
    let selectedPlanId = plan_id || null;
    if (!selectedPlanId) {
      const defaultPlan = await db.query("SELECT id FROM planes WHERE nombre ILIKE '%prueba%' LIMIT 1");
      if (defaultPlan.rows.length > 0) {
        selectedPlanId = defaultPlan.rows[0].id;
      }
    }

    // 6. Crear licencia con los días de prueba
    const licenseKey = generateLicenseKey(app.slug || 'VEA');
    const newLicense = await db.query(
      `INSERT INTO licencias (cliente_id, app_id, plan_id, license_key, fecha_inicio, fecha_fin, estado)
       VALUES ($1, $2, $3, $4, NOW(), NOW() + ($5 || ' days')::INTERVAL, 'activa')
       RETURNING id, license_key, fecha_inicio, fecha_fin, estado`,
      [clienteId, app.id, selectedPlanId, licenseKey, trialDays]
    );

    res.status(201).json({
      success: true,
      message: `¡Registro exitoso! Se ha activado tu período de prueba de ${trialDays} días para ${app.nombre}.`,
      client: { id: clienteId, nombre: cleanNombre, email: cleanEmail, telefono: cleanTelefono },
      license: newLicense.rows[0],
      app: app.nombre,
      trial_days: trialDays,
    });
  } catch (err) {
    console.error('Error en /public/register:', err);
    res.status(500).json({ error: 'Ocurrió un error al procesar el registro.' });
  }
});

// -------------------------------------------------------------
// 4. REPORTE PÚBLICO DE PAGO CON ACTIVACIÓN INMEDIATA
// POST /api/v1/public/payment
// Requisito del usuario:
// "Cada usuario puede reportar su pago en la vista principal donde se registran los nuevos usuario solo indicando su correo el numero de referencia y monto, una vez registrado la licencia se activa y el administrador despues valida el pago y en caso de no ser correcto contactara al usuario."
// -------------------------------------------------------------
router.post('/public/payment', async (req, res) => {
  const { email, referencia, monto, app_id } = req.body;

  if (!email || !referencia || !monto) {
    return res.status(400).json({
      error: 'El correo electrónico, número de referencia y monto son requeridos.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanRef = referencia.trim();
  const cleanMonto = parseFloat(monto);

  if (isNaN(cleanMonto) || cleanMonto <= 0) {
    return res.status(400).json({ error: 'El monto ingresado no es válido.' });
  }

  try {
    // 1. Buscar cliente por correo
    const clientRes = await db.query('SELECT id, nombre, email, telefono FROM clientes WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (clientRes.rows.length === 0) {
      return res.status(404).json({
        error: 'No se encontró ningún usuario registrado con ese correo. Por favor regístrese primero antes de reportar un pago.',
      });
    }
    const cliente = clientRes.rows[0];

    // 2. Verificar que el número de referencia no esté duplicado
    const refCheck = await db.query('SELECT id FROM pagos WHERE LOWER(referencia) = LOWER($1)', [cleanRef]);
    if (refCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Este número de referencia ya ha sido registrado previamente.',
      });
    }

    // 3. Determinar la aplicación
    let targetAppId = app_id;
    if (!targetAppId) {
      // Buscar la primera app a la que pertenezca el cliente
      const licCheck = await db.query('SELECT app_id FROM licencias WHERE cliente_id = $1 LIMIT 1', [cliente.id]);
      if (licCheck.rows.length > 0) {
        targetAppId = licCheck.rows[0].app_id;
      } else {
        const defaultApp = await db.query('SELECT id FROM aplicaciones ORDER BY id ASC LIMIT 1');
        targetAppId = defaultApp.rows[0].id;
      }
    }

    const appRes = await db.query('SELECT id, nombre, slug FROM aplicaciones WHERE id = $1', [targetAppId]);
    const app = appRes.rows[0];

    // Días que se otorgarán por defecto (30 días por pago)
    const diasOtorgar = 30;

    // 4. Buscar o crear la licencia para esta app
    const licRes = await db.query(
      'SELECT id, fecha_fin, estado, bloqueada_manualmente FROM licencias WHERE cliente_id = $1 AND app_id = $2',
      [cliente.id, targetAppId]
    );

    let nuevaFechaFin;
    let licenseId;

    if (licRes.rows.length > 0) {
      const lic = licRes.rows[0];
      licenseId = lic.id;
      const now = new Date();
      const currentFechaFin = new Date(lic.fecha_fin);

      // Si aún está activa, se acumula el tiempo a la fecha de vencimiento actual.
      // Si ya estaba vencida, arranca desde hoy.
      if (currentFechaFin > now && !lic.bloqueada_manualmente) {
        // Acumular días a fecha_fin actual
        const updateRes = await db.query(
          `UPDATE licencias 
           SET fecha_fin = fecha_fin + ($1 || ' days')::INTERVAL,
               estado = 'activa',
               bloqueada_manualmente = false,
               motivo_bloqueo = NULL,
               updated_at = NOW()
           WHERE id = $2
           RETURNING fecha_fin`,
          [diasOtorgar, licenseId]
        );
        nuevaFechaFin = updateRes.rows[0].fecha_fin;
      } else {
        // Arranca desde hoy
        const updateRes = await db.query(
          `UPDATE licencias 
           SET fecha_inicio = NOW(),
               fecha_fin = NOW() + ($1 || ' days')::INTERVAL,
               estado = 'activa',
               bloqueada_manualmente = false,
               motivo_bloqueo = NULL,
               updated_at = NOW()
           WHERE id = $2
           RETURNING fecha_fin`,
          [diasOtorgar, licenseId]
        );
        nuevaFechaFin = updateRes.rows[0].fecha_fin;
      }
    } else {
      // No tenía licencia previa para esta app, crearla
      const newKey = generateLicenseKey(app?.slug || 'VEA');
      const createRes = await db.query(
        `INSERT INTO licencias (cliente_id, app_id, license_key, fecha_inicio, fecha_fin, estado)
         VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' days')::INTERVAL, 'activa')
         RETURNING id, fecha_fin`,
        [cliente.id, targetAppId, newKey, diasOtorgar]
      );
      licenseId = createRes.rows[0].id;
      nuevaFechaFin = createRes.rows[0].fecha_fin;
    }

    // 5. Registrar el pago con estado "pendiente" para que el admin lo valide después
    await db.query(
      `INSERT INTO pagos (cliente_id, app_id, referencia, monto, fecha_reporte, estado, dias_otorgados, observaciones)
       VALUES ($1, $2, $3, $4, NOW(), 'pendiente', $5, 'Reporte desde la pantalla principal por el usuario')`,
      [cliente.id, targetAppId, cleanRef, cleanMonto, diasOtorgar]
    );

    res.status(201).json({
      success: true,
      message: `¡Pago reportado exitosamente! Tu licencia para ${app.nombre} ha sido activada y extendida por ${diasOtorgar} días mientras la administración verifica el comprobante.`,
      cliente: cliente.nombre,
      app: app.nombre,
      nueva_fecha_vencimiento: nuevaFechaFin,
      referencia: cleanRef,
    });
  } catch (err) {
    console.error('Error en /public/payment:', err);
    res.status(500).json({ error: 'Ocurrió un error al procesar el reporte de pago.' });
  }
});

// -------------------------------------------------------------
// 5. CONSULTA DE ESTADO PARA USUARIOS (PORTAL PÚBLICO)
// GET /api/v1/public/client-status?email=...
// -------------------------------------------------------------
router.get('/public/client-status', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ error: 'Debe ingresar un correo electrónico.' });
  }

  try {
    const clientRes = await db.query('SELECT id, nombre, email, telefono FROM clientes WHERE LOWER(email) = LOWER($1)', [email]);
    if (clientRes.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron licencias para este correo.' });
    }

    const cliente = clientRes.rows[0];
    const licRes = await db.query(
      `SELECT l.id, l.license_key, l.fecha_fin, l.estado, l.bloqueada_manualmente, l.motivo_bloqueo,
              a.nombre as app_nombre, a.color as app_color, a.icono as app_icono
       FROM licencias l
       JOIN aplicaciones a ON a.id = l.app_id
       WHERE l.cliente_id = $1
       ORDER BY l.id ASC`,
      [cliente.id]
    );

    const now = new Date();
    const licencias = licRes.rows.map(lic => {
      const fechaFin = new Date(lic.fecha_fin);
      const daysLeft = Math.ceil((fechaFin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let badge = 'verde';
      let estadoTexto = 'Activa';

      if (lic.bloqueada_manualmente || lic.estado === 'bloqueada') {
        badge = 'rojo';
        estadoTexto = 'Bloqueada por administración';
      } else if (daysLeft <= 0 || now > fechaFin) {
        badge = 'rojo';
        estadoTexto = 'Vencida';
      } else if (daysLeft <= 7) {
        badge = 'amarillo';
        estadoTexto = `Próxima a vencer (${daysLeft} días)`;
      } else {
        badge = 'verde';
        estadoTexto = `Activa (${daysLeft} días restantes)`;
      }

      return {
        ...lic,
        days_left: Math.max(0, daysLeft),
        badge,
        estado_texto: estadoTexto,
      };
    });

    res.json({
      cliente,
      licencias,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar licencias del cliente.' });
  }
});

module.exports = router;

