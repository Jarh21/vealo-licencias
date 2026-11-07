const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Todas las rutas de este archivo requieren autenticación
router.use(authenticateToken);

// -------------------------------------------------------------
// 1. ESTADÍSTICAS DEL DASHBOARD Y GRÁFICOS (ESTILO KENA)
// GET /api/v1/admin/stats
// -------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    // Configuración para el umbral de advertencia
    const configRes = await db.query("SELECT clave, valor FROM configuracion WHERE clave IN ('warning_days', 'trial_days')");
    const warningDays = parseInt(configRes.rows.find(c => c.clave === 'warning_days')?.valor || '7', 10);
    const trialDays = parseInt(configRes.rows.find(c => c.clave === 'trial_days')?.valor || '30', 10);

    // Conteo total de clientes
    const totalClientsRes = await db.query('SELECT COUNT(*) FROM clientes');
    const totalClients = parseInt(totalClientsRes.rows[0].count, 10);

    // Conteo de licencias y semáforo
    const licenciasRes = await db.query(`
      SELECT 
        l.id, l.estado, l.bloqueada_manualmente, l.fecha_fin,
        NOW() as fecha_actual,
        ROUND(EXTRACT(EPOCH FROM (l.fecha_fin - NOW())) / 86400) as dias_restantes
      FROM licencias l
    `);

    let activas = 0;
    let proximasVencer = 0;
    let inactivas = 0;
    let bloqueadas = 0;

    licenciasRes.rows.forEach(lic => {
      const dias = parseFloat(lic.dias_restantes);
      if (lic.bloqueada_manualmente || lic.estado === 'bloqueada') {
        bloqueadas++;
        inactivas++;
      } else if (dias <= 0) {
        inactivas++;
      } else if (dias <= warningDays) {
        proximasVencer++;
      } else {
        activas++;
      }
    });

    // Conteo de pagos pendientes
    const pendingPaymentsRes = await db.query(
      "SELECT COUNT(*), COALESCE(SUM(monto), 0) as monto_pendiente FROM pagos WHERE estado = 'pendiente'"
    );
    const pendingPayments = parseInt(pendingPaymentsRes.rows[0].count, 10);
    const pendingMonto = parseFloat(pendingPaymentsRes.rows[0].monto_pendiente);

    // Total recaudado aprobado
    const approvedPaymentsRes = await db.query(
      "SELECT COALESCE(SUM(monto), 0) as total_aprobado FROM pagos WHERE estado = 'aprobado'"
    );
    const totalRecaudado = parseFloat(approvedPaymentsRes.rows[0].total_aprobado);

    // Distribución por App
    const appStatsRes = await db.query(`
      SELECT a.id, a.nombre, a.color, COUNT(l.id) as total_licencias
      FROM aplicaciones a
      LEFT JOIN licencias l ON l.app_id = a.id
      GROUP BY a.id, a.nombre, a.color
      ORDER BY a.id ASC
    `);

    // Últimos pagos reportados
    const recentPaymentsRes = await db.query(`
      SELECT p.id, p.referencia, p.monto, p.fecha_reporte, p.estado,
             c.nombre as cliente_nombre, c.email as cliente_email,
             a.nombre as app_nombre
      FROM pagos p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN aplicaciones a ON a.id = p.app_id
      ORDER BY p.id DESC
      LIMIT 5
    `);

    res.json({
      summary: {
        totalClients,
        activas,
        proximasVencer,
        inactivas,
        bloqueadas,
        pendingPayments,
        pendingMonto,
        totalRecaudado,
        warningDays,
        trialDays,
      },
      appStats: appStatsRes.rows,
      recentPayments: recentPaymentsRes.rows,
    });
  } catch (err) {
    console.error('Error al obtener estadísticas del dashboard:', err);
    res.status(500).json({ error: 'Error al calcular estadísticas.' });
  }
});

// -------------------------------------------------------------
// 2. LISTADO DE CLIENTES Y LICENCIAS CON SEMÁFORO
// GET /api/v1/admin/clients
// -------------------------------------------------------------
router.get('/clients', async (req, res) => {
  const { search, app_id, status } = req.query;

  try {
    const configRes = await db.query("SELECT valor FROM configuracion WHERE clave = 'warning_days'");
    const warningDays = parseInt(configRes.rows[0]?.valor || '7', 10);

    let query = `
      SELECT 
        c.id as cliente_id,
        c.nombre as cliente_nombre,
        c.email as cliente_email,
        c.telefono as cliente_telefono,
        c.created_at as cliente_registro,
        l.id as licencia_id,
        l.license_key,
        l.fecha_inicio,
        l.fecha_fin,
        l.estado as licencia_estado,
        l.bloqueada_manualmente,
        l.motivo_bloqueo,
        a.id as app_id,
        a.nombre as app_nombre,
        a.color as app_color,
        p.id as plan_id,
        p.nombre as plan_nombre,
        ROUND(EXTRACT(EPOCH FROM (l.fecha_fin - NOW())) / 86400) as dias_restantes
      FROM clientes c
      LEFT JOIN licencias l ON l.cliente_id = c.id
      LEFT JOIN aplicaciones a ON a.id = l.app_id
      LEFT JOIN planes p ON p.id = l.plan_id
      WHERE 1=1
    `;

    const params = [];

    // Filtro por búsqueda de texto
    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (
        LOWER(c.nombre) LIKE $${params.length} OR 
        LOWER(c.email) LIKE $${params.length} OR 
        LOWER(c.telefono) LIKE $${params.length} OR
        LOWER(l.license_key) LIKE $${params.length} OR
        LOWER(a.nombre) LIKE $${params.length}
      )`;
    }

    // Filtro por aplicación
    if (app_id && app_id !== 'all') {
      params.push(parseInt(app_id, 10));
      query += ` AND a.id = $${params.length}`;
    }

    query += ` ORDER BY c.id DESC, l.id DESC`;

    const result = await db.query(query, params);

    // Calcular estatus de semáforo para cada registro
    const rows = result.rows.map(item => {
      const dias = item.dias_restantes !== null ? parseFloat(item.dias_restantes) : 0;
      let statusColor = 'verde';
      let statusLabel = 'Activa';

      if (item.bloqueada_manualmente || item.licencia_estado === 'bloqueada') {
        statusColor = 'rojo';
        statusLabel = 'Bloqueada';
      } else if (dias <= 0 || item.licencia_estado === 'inactiva') {
        statusColor = 'rojo';
        statusLabel = 'Vencida';
      } else if (dias <= warningDays) {
        statusColor = 'amarillo';
        statusLabel = `Por Vencer (${Math.max(0, Math.ceil(dias))} d)`;
      } else {
        statusColor = 'verde';
        statusLabel = `Activa (${Math.ceil(dias)} d)`;
      }

      return {
        ...item,
        statusColor,
        statusLabel,
        dias_restantes_num: Math.max(0, Math.ceil(dias)),
      };
    });

    // Filtro en memoria por color de semáforo si se especifica
    let filtered = rows;
    if (status && status !== 'all') {
      filtered = rows.filter(r => r.statusColor === status || (status === 'bloqueada' && r.bloqueada_manualmente));
    }

    res.json({ clients: filtered, warningDays });
  } catch (err) {
    console.error('Error al listar clientes:', err);
    res.status(500).json({ error: 'Error al consultar clientes.' });
  }
});

// -------------------------------------------------------------
// 3. EDITAR CLIENTE Y LICENCIA
// PUT /api/v1/admin/clients/:id
// -------------------------------------------------------------
router.put('/clients/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, email, telefono, app_id, plan_id, fecha_fin, estado, motivo_bloqueo } = req.body;

  try {
    // 1. Actualizar datos de cliente
    await db.query(
      `UPDATE clientes 
       SET nombre = COALESCE($1, nombre),
           email = COALESCE($2, email),
           telefono = COALESCE($3, telefono)
       WHERE id = $4`,
      [nombre?.trim(), email?.trim().toLowerCase(), telefono?.trim(), id]
    );

    // 2. Si se proporcionó fecha_fin o plan para su licencia
    if (fecha_fin || estado || plan_id || app_id) {
      let isBloqueada = estado === 'bloqueada';
      await db.query(
        `UPDATE licencias
         SET fecha_fin = COALESCE($1, fecha_fin),
             plan_id = COALESCE($2, plan_id),
             estado = COALESCE($3, estado),
             bloqueada_manualmente = $4,
             motivo_bloqueo = $5,
             updated_at = NOW()
         WHERE cliente_id = $6`,
        [
          fecha_fin ? new Date(fecha_fin) : null,
          plan_id ? parseInt(plan_id, 10) : null,
          estado || null,
          isBloqueada,
          isBloqueada ? (motivo_bloqueo || 'Bloqueo administrativo') : null,
          id
        ]
      );
    }

    res.json({ success: true, message: 'Cliente y licencia actualizados exitosamente.' });
  } catch (err) {
    console.error('Error al editar cliente:', err);
    res.status(500).json({ error: 'Error al actualizar información.' });
  }
});

// -------------------------------------------------------------
// 4. ELIMINAR CLIENTE
// DELETE /api/v1/admin/clients/:id
// -------------------------------------------------------------
router.delete('/clients/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM clientes WHERE id = $1', [id]);
    res.json({ success: true, message: 'Cliente y sus licencias asociadas eliminados con éxito.' });
  } catch (err) {
    console.error('Error al eliminar cliente:', err);
    res.status(500).json({ error: 'Error al eliminar cliente.' });
  }
});

// -------------------------------------------------------------
// 5. BLOQUEAR / DESBLOQUEAR LICENCIA EN CUALQUIER MOMENTO
// POST /api/v1/admin/clients/:id/toggle-block
// Requisito del usuario:
// "en cada registro una opcion para editar, eliminar y bloquear licencia ya que el administrador podra bloquear cualquier licencia en cualquier momento."
// -------------------------------------------------------------
router.post('/clients/:id/toggle-block', async (req, res) => {
  const { id } = req.params; // cliente_id
  const { motivo } = req.body;

  try {
    const licRes = await db.query(
      'SELECT id, estado, bloqueada_manualmente, fecha_fin FROM licencias WHERE cliente_id = $1 LIMIT 1',
      [id]
    );

    if (licRes.rows.length === 0) {
      return res.status(404).json({ error: 'El cliente no tiene una licencia asignada.' });
    }

    const lic = licRes.rows[0];
    const isCurrentlyBlocked = lic.bloqueada_manualmente || lic.estado === 'bloqueada';

    let nuevoEstado;
    let nuevoBloqueo;
    let nuevoMotivo;

    if (isCurrentlyBlocked) {
      // DESBLOQUEAR
      nuevoBloqueo = false;
      nuevoMotivo = null;
      const now = new Date();
      const fechaFin = new Date(lic.fecha_fin);
      nuevoEstado = fechaFin > now ? 'activa' : 'inactiva';
    } else {
      // BLOQUEAR
      nuevoBloqueo = true;
      nuevoEstado = 'bloqueada';
      nuevoMotivo = motivo || 'Bloqueada por el administrador';
    }

    await db.query(
      `UPDATE licencias 
       SET estado = $1, bloqueada_manualmente = $2, motivo_bloqueo = $3, updated_at = NOW()
       WHERE id = $4`,
      [nuevoEstado, nuevoBloqueo, nuevoMotivo, lic.id]
    );

    res.json({
      success: true,
      bloqueada: nuevoBloqueo,
      estado: nuevoEstado,
      message: nuevoBloqueo
        ? 'Licencia bloqueada exitosamente. La app móvil ahora recibirá estatus inactivo (0).'
        : 'Licencia desbloqueada exitosamente.',
    });
  } catch (err) {
    console.error('Error al alternar bloqueo:', err);
    res.status(500).json({ error: 'Error al cambiar estado de la licencia.' });
  }
});

// -------------------------------------------------------------
// 6. GESTIÓN DE PAGOS REPORTADOS (APROBAR / RECHAZAR)
// -------------------------------------------------------------
router.get('/payments', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.referencia, p.monto, p.fecha_reporte, p.estado, p.dias_otorgados, p.observaciones,
             p.fecha_validacion,
             c.id as cliente_id, c.nombre as cliente_nombre, c.email as cliente_email, c.telefono as cliente_telefono,
             a.nombre as app_nombre,
             adm.nombre as validador_nombre
      FROM pagos p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN aplicaciones a ON a.id = p.app_id
      LEFT JOIN administradores adm ON adm.id = p.validado_por
      ORDER BY p.id DESC
    `);
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar pagos.' });
  }
});

// APROBAR PAGO
router.post('/payments/:id/approve', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE pagos 
       SET estado = 'aprobado',
           fecha_validacion = NOW(),
           validado_por = $1
       WHERE id = $2`,
      [req.admin.id, id]
    );

    res.json({ success: true, message: 'Pago validado y aprobado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar pago.' });
  }
});

// RECHAZAR PAGO
router.post('/payments/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const paymentRes = await db.query(`
      SELECT p.id, p.cliente_id, p.app_id, p.dias_otorgados, p.referencia, p.monto, p.estado,
             c.nombre as cliente_nombre, c.email as cliente_email, c.telefono as cliente_telefono,
             a.nombre as app_nombre
      FROM pagos p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN aplicaciones a ON a.id = p.app_id
      WHERE p.id = $1
    `, [id]);

    if (paymentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado.' });
    }

    const payment = paymentRes.rows[0];
    const diasRevertir = payment.dias_otorgados || 30;
    const razon = motivo || 'Comprobante no válido o no reflejado en cuenta bancaria';

    // 1. Marcar pago como rechazado
    await db.query(
      `UPDATE pagos 
       SET estado = 'rechazado',
           observaciones = $1,
           fecha_validacion = NOW(),
           validado_por = $2
       WHERE id = $3`,
      [razon, req.admin.id, id]
    );

    // 2. Revertir días de la licencia y bloquearla
    await db.query(
      `UPDATE licencias
       SET fecha_fin = GREATEST(NOW() - INTERVAL '1 day', fecha_fin - ($1 || ' days')::INTERVAL),
           estado = 'bloqueada',
           bloqueada_manualmente = true,
           motivo_bloqueo = $2,
           updated_at = NOW()
       WHERE cliente_id = $3 AND app_id = $4`,
      [diasRevertir, `Pago rechazado (Ref: ${payment.referencia}): ${razon}`, payment.cliente_id, payment.app_id]
    );

    // Preparar mensaje de WhatsApp preformateado para contactar al cliente de inmediato
    const whatsappMsg = encodeURIComponent(
      `Hola ${payment.cliente_nombre}, le contactamos de Grupo Vealo con respecto a su reporte de pago para la aplicación ${payment.app_nombre} (Ref: ${payment.referencia}, Monto: $${payment.monto}). Motivo: ${razon}. Por favor verifique y envíenos el soporte correspondiente.`
    );
    const cleanPhone = payment.cliente_telefono.replace(/[^0-9]/g, '');
    const whatsappLink = `https://wa.me/${cleanPhone}?text=${whatsappMsg}`;

    res.json({
      success: true,
      message: 'Pago rechazado. La licencia ha sido suspendida automáticamente.',
      contactInfo: {
        nombre: payment.cliente_nombre,
        email: payment.cliente_email,
        telefono: payment.cliente_telefono,
        whatsappLink,
      },
    });
  } catch (err) {
    console.error('Error al rechazar pago:', err);
    res.status(500).json({ error: 'Error al rechazar pago.' });
  }
});

// -------------------------------------------------------------
// 7. MÓDULO DE LICENCIAS Y PLANES
// Requisito del usuario:
// "Crea un modulo de licencias en donde se espsifique el nombre, tiempo de duracion y este a su vez es el plan que se le asignara a cada cliente."
// -------------------------------------------------------------
router.get('/plans', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM planes ORDER BY duracion_dias ASC');
    res.json({ plans: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar planes.' });
  }
});

router.post('/plans', async (req, res) => {
  const { nombre, duracion_dias, precio, descripcion } = req.body;

  if (!nombre || !duracion_dias) {
    return res.status(400).json({ error: 'El nombre y la duración en días son requeridos.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO planes (nombre, duracion_dias, precio, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre.trim(), parseInt(duracion_dias, 10), parseFloat(precio) || 0, descripcion?.trim()]
    );
    res.status(201).json({ success: true, plan: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear plan.' });
  }
});

router.put('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, duracion_dias, precio, descripcion, activo } = req.body;

  try {
    const result = await db.query(
      `UPDATE planes
       SET nombre = COALESCE($1, nombre),
           duracion_dias = COALESCE($2, duracion_dias),
           precio = COALESCE($3, precio),
           descripcion = COALESCE($4, descripcion),
           activo = COALESCE($5, activo)
       WHERE id = $6
       RETURNING *`,
      [
        nombre?.trim(),
        duracion_dias ? parseInt(duracion_dias, 10) : null,
        precio !== undefined ? parseFloat(precio) : null,
        descripcion?.trim(),
        activo,
        id,
      ]
    );

    res.json({ success: true, plan: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar plan.' });
  }
});

router.delete('/plans/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM planes WHERE id = $1', [id]);
    res.json({ success: true, message: 'Plan eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'No se puede eliminar el plan si ya está asignado a licencias.' });
  }
});

// -------------------------------------------------------------
// 8. MÓDULO DE CONFIGURACIÓN DEL SISTEMA
// Requisito del usuario:
// "apenas se registren dias de pruebas 30 y que pueda modificar esos dias en un modulo de configuracion."
// -------------------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT clave, valor, descripcion FROM configuracion');
    const settings = {};
    result.rows.forEach(r => {
      settings[r.clave] = r.valor;
    });
    res.json({ settings, raw: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar configuración.' });
  }
});

router.put('/settings', async (req, res) => {
  const { trial_days, warning_days, app_title, support_whatsapp } = req.body;

  try {
    if (trial_days !== undefined) {
      await db.query("UPDATE configuracion SET valor = $1, updated_at = NOW() WHERE clave = 'trial_days'", [String(trial_days)]);
    }
    if (warning_days !== undefined) {
      await db.query("UPDATE configuracion SET valor = $1, updated_at = NOW() WHERE clave = 'warning_days'", [String(warning_days)]);
    }
    if (app_title !== undefined) {
      await db.query("UPDATE configuracion SET valor = $1, updated_at = NOW() WHERE clave = 'app_title'", [String(app_title)]);
    }
    if (support_whatsapp !== undefined) {
      await db.query("UPDATE configuracion SET valor = $1, updated_at = NOW() WHERE clave = 'support_whatsapp'", [String(support_whatsapp)]);
    }

    res.json({ success: true, message: 'Configuración actualizada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración.' });
  }
});

// -------------------------------------------------------------
// 9. APLICACIONES DISPONIBLES
// GET /api/v1/admin/apps
// -------------------------------------------------------------
router.get('/apps', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM aplicaciones ORDER BY id ASC');
    res.json({ apps: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener aplicaciones.' });
  }
});

module.exports = router;

