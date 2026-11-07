# Sistema de Gestión de Licencias - Grupo Vealo

Dashboard administrativo y API móvil para el registro, control de vencimiento y auto-activación de suscripciones para las aplicaciones:
* **Cobrale** (Gestión de cobranzas)
* **Passnet** (Control de acceso y pases digitales)
* **Vealo Admin** (Supervisión gerencial)

---

## 🚀 Inicio Rápido

### 1. Variables de Entorno (`.env`)
Configurado para PostgreSQL local:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:317464192@localhost:5432/licencias_vealo
JWT_SECRET=vealo_super_secret_jwt_token_2026_key
NODE_ENV=development
```

### 2. Iniciar el Servidor
```bash
npm start
```
El sistema inicializa automáticamente la base de datos `licencias_vealo`, ejecuta las migraciones de tablas y siembra los datos iniciales y el usuario administrador hardcodeado.

---

## 🔐 Credenciales de Acceso Administrativo

* **URL de Login:** `http://localhost:3000/login`
* **Dashboard:** `http://localhost:3000/admin`
* **Usuario:** `admin`
* **Contraseña:** `1814621111264181*`

---

## 🌐 URLs del Sistema

| Módulo | Ruta | Descripción |
|---|---|---|
| **Portal Público** | `http://localhost:3000/` | Pantalla de inicio con botones "Registrarse" y "Pagar suscripción", tarjetas de las 3 apps y consulta de licencias. |
| **Login Admin** | `http://localhost:3000/login` | Pantalla de inicio de sesión administrativo con diseño corporativo. |
| **Dashboard Admin** | `http://localhost:3000/admin` | Panel de control integral estilo KENA (Sidebar verde bosque `#133E36`, métricas, gráficos interactivos Chart.js, cartelera de clientes con semáforo, pagos, planes, admins y configuración). |
| **API Móvil** | `http://localhost:3000/api/v1/license/check` | Endpoint para validación de licencias desde las aplicaciones móviles. |

---

## 📱 Guía de Integración para Apps Móviles

La aplicación móvil debe realizar una petición HTTP simple (GET o POST) al endpoint de verificación enviando el `email` del usuario y el nombre de la aplicación `app`:

### Ejemplo HTTP GET:
```http
GET /api/v1/license/check?email=carlos@ejemplo.com&app=Cobrale
```

### Respuesta si está ACTIVA (Status = 1):
```json
{
  "status": 1,
  "condition": "active",
  "message": "Licencia activa y válida.",
  "app": "Cobrale",
  "cliente": "Carlos Mendoza",
  "license_key": "COB-8F42-99B1-2026",
  "plan": "Plan Mensual",
  "expires_at": "2026-11-30T20:20:00.000Z",
  "days_left": 25
}
```

### Respuesta si está INACTIVA / VENCIDA / BLOQUEADA (Status = 0):
```json
{
  "status": 0,
  "condition": "expired", // o "blocked" o "not_found"
  "message": "La licencia ha expirado. Por favor reporte su pago para renovarla.",
  "app": "Cobrale",
  "expires_at": "2026-11-01T20:20:00.000Z",
  "days_left": 0
}
```

### Código de ejemplo en App Móvil (JavaScript / Dart / Kotlin / Swift):
```javascript
async function checkLicenseStatus(userEmail, appName) {
  const url = `http://tu-servidor:3000/api/v1/license/check?email=${encodeURIComponent(userEmail)}&app=${encodeURIComponent(appName)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status === 1) {
    // LICENCIA ACTIVA: Permitir uso normal de la app
    console.log("Licencia válida. Días restantes:", data.days_left);
  } else {
    // LICENCIA INACTIVA: Bloquear funciones y mostrar pantalla de pago
    alert(data.message);
  }
}
```

---

## 🎨 Características Implementadas

1. **Diseño Visual Fiel a KENA:**
   * Barra lateral izquierda ergonómica en verde bosque (`#133E36`).
   * Gráficos interactivos con Chart.js (distribución por Apps y semáforo de dona).
   * Tarjetas blancas flotantes con bordes suaves y sombras elegantes.
2. **Cartelera de Clientes con Semáforo Tríptico:**
   * 🟢 **Verde:** Licencia activa con tiempo suficiente.
   * 🟡 **Amarillo:** Próxima a vencer (menos de 7 días, configurable).
   * 🔴 **Rojo:** Vencida o Bloqueada manualmente por el administrador.
3. **Acciones Rápidas por Registro:**
   * **Editar:** Modificar nombre, email, teléfono, plan o fecha exacta de expiración.
   * **Bloquear / Desbloquear en cualquier momento:** Un clic suspende o reactiva el acceso móvil instantáneamente.
   * **Eliminar:** Borrado seguro de cliente y licencias.
   * **Contacto WhatsApp:** Enlace directo con un clic al número de cada cliente.
4. **Auto-Activación de Pagos:**
   * El usuario reporta su pago en la vista principal con solo ingresar su correo, referencia y monto.
   * La licencia se activa o prolonga inmediatamente por 30 días para no interrumpir el servicio.
   * El administrador revisa el pago en su bandeja y puede **Aprobarlo** o **Rechazarlo** (al rechazar se revierten los días, se suspende la licencia y se abre WhatsApp con el mensaje de notificación listo para enviar al cliente).
5. **Módulo de Configuración:**
   * Días de prueba inicial (configurados por defecto en 30 días).
   * Días de advertencia para semáforo amarillo (por defecto 7 días).

