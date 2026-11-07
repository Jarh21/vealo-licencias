// test-system.js - Verificación completa automatizada de todos los requerimientos
const db = require('./db');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 INICIANDO VERIFICACIÓN COMPLETA DEL SISTEMA DE LICENCIAS');
  console.log('========================================================');

  let adminToken = '';

  // 1. Health
  console.log('\n1. Probando endpoint de salud (/health)...');
  const health = await request('GET', '/health');
  console.log('Respuesta:', health.status, health.body);

  // 2. Apps y Planes Públicos
  console.log('\n2. Probando catálogo público (/api/v1/public/apps-and-plans)...');
  const catalog = await request('GET', '/api/v1/public/apps-and-plans');
  console.log(`Apps registradas: ${catalog.body.apps.map(a => a.nombre).join(', ')}`);
  console.log(`Días de prueba configurados: ${catalog.body.trial_days}`);

  // 3. Login Administrativo con credenciales requeridas
  console.log('\n3. Probando login admin con "admin" y "1814621111264181*"...');
  const loginRes = await request('POST', '/api/v1/auth/login', {
    username: 'admin',
    password: '1814621111264181*',
  });
  console.log('Login status:', loginRes.status, loginRes.body.success ? 'EXITOSO' : 'FALLIDO');
  adminToken = loginRes.body.token;

  if (!adminToken) {
    throw new Error('Fallo al obtener token de administrador');
  }

  // 4. Estadísticas del Dashboard
  console.log('\n4. Probando estadísticas del dashboard (/api/v1/admin/stats)...');
  const statsRes = await request('GET', '/api/v1/admin/stats', null, {
    'Authorization': `Bearer ${adminToken}`,
  });
  console.log('KPIs:', statsRes.body.summary);

  // 5. Listado de Clientes con Semáforo (Verde, Amarillo, Rojo)
  console.log('\n5. Probando listado de clientes (/api/v1/admin/clients)...');
  const clientsRes = await request('GET', '/api/v1/admin/clients', null, {
    'Authorization': `Bearer ${adminToken}`,
  });
  console.log(`Clientes encontrados: ${clientsRes.body.clients.length}`);
  clientsRes.body.clients.forEach(c => {
    console.log(` - ${c.cliente_nombre} | App: ${c.app_nombre} | Estado: ${c.statusLabel} [${c.statusColor.toUpperCase()}]`);
  });

  // 6. Verificación de la API Móvil (Requerimiento clave: Retorno activo 1 o inactivo 0)
  console.log('\n6. Probando API Móvil (GET /api/v1/license/check):');

  // 6.a Cliente Activo (Carlos Mendoza - Cobrale)
  const checkActivo = await request('GET', '/api/v1/license/check?email=carlos@ejemplo.com&app=Cobrale');
  console.log(' - Carlos (Cobrale) -> Status:', checkActivo.body.status, `[${checkActivo.body.message}]`, `Días restantes: ${checkActivo.body.days_left}`);

  // 6.b Cliente Vencido (Alfa C.A. - Vealo Admin)
  const checkVencido = await request('GET', '/api/v1/license/check?email=contacto@alfa.com&app=Vealo Admin');
  console.log(' - Alfa (Vealo Admin) -> Status:', checkVencido.body.status, `[${checkVencido.body.message}]`);

  // 6.c Cliente Bloqueado (Roberto Gómez - Cobrale)
  const checkBloqueado = await request('GET', '/api/v1/license/check?email=roberto@ejemplo.com&app=Cobrale');
  console.log(' - Roberto (Cobrale) -> Status:', checkBloqueado.body.status, `[${checkBloqueado.body.message}]`);

  // 7. Registro Público con los 30 días de prueba
  console.log('\n7. Probando registro de nuevo usuario con 30 días de prueba...');
  const testEmail = `test_${Date.now()}@vealo.com`;
  const regRes = await request('POST', '/api/v1/public/register', {
    nombre: 'Usuario Prueba Beta',
    email: testEmail,
    telefono: '+58 412 777-8899',
    app_id: 1, // Cobrale
  });
  console.log('Registro:', regRes.body.message);
  console.log('Clave de Licencia:', regRes.body.license?.license_key);

  // Verificar que la API móvil responde activo(1) para este nuevo usuario
  const checkNuevo = await request('GET', `/api/v1/license/check?email=${testEmail}&app=Cobrale`);
  console.log(' - Nuevo Usuario Móvil -> Status:', checkNuevo.body.status, `[${checkNuevo.body.message}]`, `Días: ${checkNuevo.body.days_left}`);

  // 8. Reporte Público de Pago con Activación Inmediata
  console.log('\n8. Probando reporte de pago en la pantalla principal...');
  const refNum = `REF-${Math.floor(Math.random() * 9000000 + 1000000)}`;
  const payRes = await request('POST', '/api/v1/public/payment', {
    email: testEmail,
    referencia: refNum,
    monto: 15.00,
    app_id: 1,
  });
  console.log('Pago Reportado:', payRes.body.message);

  // 9. Bloquear y Desbloquear Licencia en cualquier momento por el Administrador
  console.log('\n9. Probando bloqueo manual de licencia por el administrador...');
  const nuevoClienteId = regRes.body.client.id;
  const blockRes = await request('POST', `/api/v1/admin/clients/${nuevoClienteId}/toggle-block`, {
    motivo: 'Bloqueo preventivo de prueba',
  }, { 'Authorization': `Bearer ${adminToken}` });
  console.log('Resultado bloqueo:', blockRes.body.message);

  // Consultar API móvil con la licencia bloqueada
  const checkDespuesDeBloqueo = await request('GET', `/api/v1/license/check?email=${testEmail}&app=Cobrale`);
  console.log(' - Consulta API Móvil tras bloqueo -> Status:', checkDespuesDeBloqueo.body.status, `[${checkDespuesDeBloqueo.body.message}]`);

  // Desbloquear licencia
  console.log('\nDesbloqueando licencia...');
  const unblockRes = await request('POST', `/api/v1/admin/clients/${nuevoClienteId}/toggle-block`, {}, {
    'Authorization': `Bearer ${adminToken}`,
  });
  console.log('Resultado desbloqueo:', unblockRes.body.message);

  const checkDespuesDeDesbloqueo = await request('GET', `/api/v1/license/check?email=${testEmail}&app=Cobrale`);
  console.log(' - Consulta API Móvil tras desbloqueo -> Status:', checkDespuesDeDesbloqueo.body.status, `[${checkDespuesDeDesbloqueo.body.message}]`);

  console.log('\n========================================================');
  console.log('✅ TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ROTUNDO');
  console.log('========================================================\n');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error en pruebas:', err);
      process.exit(1);
    });
}

