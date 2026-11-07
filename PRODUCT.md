# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Administradores de Grupo Vealo:** Operadores internos y gerencia responsables de auditar y validar comprobantes de pago, supervisar el estado de las licencias, bloquear o desbloquear clientes manualmente, gestionar planes de precios y ajustar parámetros globales del sistema.
- **Clientes y Usuarios Finales:** Profesionales y empresas que adquieren y utilizan las aplicaciones móviles del ecosistema (*Cobrale*, *Passnet*, *Vealo Admin*), que necesitan registrarse de forma ágil, activar sus períodos de prueba y reportar pagos para mantener sus servicios sin interrupciones.

## Product Purpose

Proveer una infraestructura centralizada y en tiempo real para el licenciamiento, activación y verificación de suscripciones de las aplicaciones móviles del Grupo Vealo. El sistema elimina las demoras en la activación del servicio permitiendo a los clientes reportar sus pagos y activar su licencia de inmediato, al tiempo que brinda a la administración un control riguroso de auditoría y la capacidad de revocar accesos en cualquier instante.

## Positioning

Una plataforma de licenciamiento y facturación móvil desacoplada y orientada a la continuidad del negocio: las aplicaciones móviles validan su vigencia en milisegundos mediante una API REST simple y confiable (retornando `1` para activo y `0` para inactivo), con auto-activación inmediata tras el reporte de pago y semáforo preventivo de vencimiento en tres estados.

## Operating Context

- **Entorno Web Operativo:** Panel administrativo SPA moderno con barra lateral estilo KENA (verde bosque `#133E36`), con métricas KPI, gráficos dinámicos con Chart.js, buscador instantáneo y semáforo de estado tricolor.
- **Entorno Móvil Conectado:** Teléfonos inteligentes en campo corriendo las aplicaciones *Cobrale* (cobranzas), *Passnet* (control de accesos) y *Vealo Admin* (supervisión gerencial), que consultan el estado de su licencia al iniciar o sincronizar datos.
- **Flujo de Pagos:** Pagos móviles, transferencias o depósitos bancarios reportados por los usuarios en la pantalla pública mediante número de referencia y monto, validados posteriormente por el equipo administrativo. En caso de inconsistencias o rechazo, la licencia se suspende de forma automática y se habilita un canal directo de contacto vía WhatsApp.

## Capabilities and Constraints

- **Período de Prueba Automático:** 30 días de prueba gratuita asignados inmediatamente al registrarse cualquier nuevo cliente, configurables desde el panel administrativo.
- **API Móvil de Verificación:** Endpoint de alta velocidad `GET /api/v1/license/check` que recibe el correo del usuario y la aplicación, respondiendo un JSON con `status: 1` (activo) o `status: 0` (inactivo/vencido/bloqueado).
- **Semáforo Visual Tríptico:**
  - 🟢 **Verde (Activa):** Licencia vigente con más de 7 días restantes.
  - 🟡 **Amarillo (Por Vencer):** Licencia vigente con 7 o menos días restantes (umbral configurable).
  - 🔴 **Rojo (Inactiva / Bloqueada):** Licencia expirada por fecha o suspendida manualmente por un administrador.
- **Control de Bloqueo Instantáneo:** Capacidad del administrador de bloquear o desbloquear cualquier licencia en cualquier momento con un solo clic.
- **Auto-Activación y Reversión de Pagos:** El reporte de pago prolonga o activa la licencia inmediatamente por 30 días con estado `pendiente`; el rechazo administrativo revierte los días otorgados y bloquea la licencia.
- **Stack Técnico:** Node.js 24 + Express 5 + PostgreSQL (driver `pg`) + Tailwind CSS + HTML5 semántico + JavaScript modular ES6 + Chart.js.

## Brand Commitments

- **Identidad Visual:** Grupo Vealo, con estética corporativa profesional inspirada en el diseño KENA (sidebar `#133E36`, tipografía *Plus Jakarta Sans*, contrastes suaves en gris `#F8FAFC`, badges semafóricos claros y tarjetas con elevación sutil).
- **Apps Registradas:** Nombres e identidades fijas: *Cobrale*, *Passnet*, *Vealo Admin*.
- **Credencial Inicial:** Administrador maestro hardcodeado (`admin` / `1814621111264181*`).

## Evidence on Hand

- Código fuente completo y operativo en `server.js`, `db.js`, `init-db.js`, `routes/`, `middleware/` y `public/`.
- Base de datos relacional PostgreSQL activa en `licencias_vealo` con migraciones automáticas.
- Suite de pruebas de integración completa y verificada en `test-system.js` con salida exitosa (código 0).
- Imagen de referencia visual KENA cargada en el espacio de trabajo.

## Product Principles

1. **Continuidad del Servicio:** La experiencia del cliente nunca se detiene por esperas burocráticas; el pago reportado activa el servicio en el acto mientras la administración audita en segundo plano.
2. **Claridad Visual Instantánea:** El administrador debe entender el estado de toda la cartera de licencias en un vistazo gracias al semáforo tricolor y métricas en tiempo real.
3. **Control Absoluto:** Todo administrador tiene la facultad de revocar accesos de inmediato ante cualquier anomalía o fraude.
4. **Resiliencia y Simplicidad de Integración:** La API para las apps móviles es mínima, rápida y precisa, reduciendo la lógica en el dispositivo móvil a una decisión binaria (`1` o `0`).

## Accessibility & Inclusion

- Contraste accesible en todos los textos e insignias de semáforo (etiquetas textuales explícitas además del color para daltonismo: "🟢 Activa", "🟡 Por Vencer", "🔴 Vencida / Bloqueada").
- Interfaz completamente responsiva, operable en pantallas de escritorio, tablets y dispositivos móviles.

