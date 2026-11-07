---
name: Grupo Vealo - Sistema de Licencias
description: Sistema de diseño corporativo para la gestión de licencias móviles y paneles administrativos
colors:
  primary: "#133e36"
  primary-dark: "#0c2722"
  accent-emerald: "#10b981"
  status-active: "#10b981"
  status-warning: "#f59e0b"
  status-danger: "#ef4444"
  neutral-bg: "#f8fafc"
  neutral-surface: "#ffffff"
  neutral-text: "#0f172a"
  neutral-muted: "#64748b"
  neutral-border: "#e2e8f0"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-secondary:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  badge-active:
    backgroundColor: "#d1fae5"
    textColor: "#065f46"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-warning:
    backgroundColor: "#fef3c7"
    textColor: "#92400e"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-danger:
    backgroundColor: "#fee2e2"
    textColor: "#991b1b"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: Grupo Vealo - Sistema de Licencias

## Overview

**Creative North Star: "The Sovereign Green Sentinel"**

Un sistema de diseño orientado a operaciones críticas de control y licenciamiento móvil. Combina la sobriedad arquitectónica de un verde bosque profundo (`#133E36`) con superficies flotantes en blanco puro y un semáforo de alto contraste para una lectura de telemetría sin fricción. Inspirado en la interfaz KENA, el sistema proyecta precisión, confianza institucional y calma analítica para operadores que auditan transacciones financieras y gestionan accesos en tiempo real.

**Key Characteristics:**
- **Identidad Bosque Esmeralda:** Fondo lateral profundo en `#133E36` con acentos de menta vibrante (`#34D399` / `#10B981`).
- **Superficies Táctiles Respirables:** Lienzo base en gris suave (`#F8FAFC`) con tarjetas de contenido en blanco nítido (`#FFFFFF`) y sombras de contacto ultra suaves.
- **Trilogía Semafórica Inequívoca:** Estados de licencia claramente codificados (Verde = Activo, Amarillo = Por Vencer $\le$ 7 días, Rojo = Inactivo / Bloqueado).

## Colors

Paleta institucional de alto contraste construida alrededor del verde bosque primario, enriquecida con señales semafóricas estándar para toma de decisiones sin ambigüedad.

### Primary
- **Deep Forest Green** (`#133E36`): Autoridad del sistema. Utilizado exclusivamente en la barra lateral izquierda, cabeceras institucionales y botones primarios de acción decisiva.
- **Deep Forest Dark** (`#0C2722`): Estado activo de selección e interacción hover en componentes principales.

### Secondary
- **Mint Accent & Active Green** (`#10B981`): Color funcional de salud operativa y licencias activas. Acompaña indicadores numéricos positivos y transiciones fluidas.

### Tertiary
- **Warning Amber** (`#F59E0B`): Color preventivo para licencias próximas a expirar en los próximos 7 días.
- **Alert Crimson** (`#EF4444`): Color restrictivo para licencias vencidas, revocadas o bloqueadas administrativamente.

### Neutral
- **Canvas Slate** (`#F8FAFC`): Fondo general que reduce la fatiga visual en jornadas de supervisión continua.
- **Card Surface White** (`#FFFFFF`): Contenedores elevados de información, tablas y modales.
- **Deep Slate Text** (`#0F172A`): Tipografía principal para máxima legibilidad según estándares WCAG AAA.
- **Muted Slate** (`#64748B`): Metadatos, etiquetas secundarias y fechas de caducidad.
- **Border Slate** (`#E2E8F0`): Líneas divisorias estructurales con opacidad controlada.

### Named Rules
**The Signal Exclusivity Rule.** El rojo (`#EF4444`) y el amarillo (`#F59E0B`) solo pueden emplearse para estados del ciclo de vida de la licencia o alertas de rechazo de pago; jamás como adorno o fondo arbitrario.

## Typography

**Display & Body Font:** Plus Jakarta Sans (con fallback a sans-serif del sistema).
**Mono Font:** JetBrains Mono / SFMono / Consolas (para claves de licencias y referencias bancarias).

**Character:** Tipografía geométrica humanista que equilibra modernidad corporativa con excelente legibilidad en tamaños reducidos para tablas de datos densas.

### Hierarchy
- **Display** (800 Extrabold, 3rem / 48px, line-height 1.15): Título central de la pantalla pública ("Registro de licencias grupo Vealo").
- **Headline** (800 Extrabold, 1.875rem / 30px, line-height 1.25): Títulos de sección y números KPI de gran impacto.
- **Title** (700 Bold, 1.25rem / 20px, line-height 1.35): Encabezados de tarjetas, títulos de modales y nombres de aplicaciones.
- **Body** (400-500 Regular/Medium, 0.875rem / 14px, line-height 1.5): Textos de párrafos, explicaciones de planes y formularios.
- **Label** (700 Bold, 0.6875rem / 11px, letter-spacing 0.05em, UPPERCASE): Etiquetas de columnas, encabezados de tablas y tipos de app.

## Layout

Modelo espacial basado en cuadrícula flexible con contenedor central restringido a 1280px para máxima legibilidad en monitores anchos. El panel administrativo adopta un diseño de dos paneles: barra lateral fija a 256px (`w-64`) y área central fluidamente scrollable con padding constante de 32px (`p-8`).

## Elevation & Depth

El sistema utiliza una arquitectura híbrida de estratificación tonal con sombras ambientales muy sutiles (`0 10px 15px -3px rgba(0, 0, 0, 0.05)`). Los modales emplean un velo de desenfoque de fondo (`backdrop-blur-sm` con fondo `rgba(15, 23, 42, 0.6)`).

### Shadow Vocabulary
- **Card Ambient** (`box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)`): Aplicado en estado de reposo sobre todas las tarjetas de métricas y tablas.
- **Hover Lift** (`box-shadow: 0 15px 30px -10px rgba(19, 62, 54, 0.15)`): Elevación interactiva de 4px en tarjetas de aplicaciones de la pantalla principal.
- **Modal Depth** (`box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)`): Profundidad de foco para modales emergentes de pago y registro.

## Shapes

- **Bordes Generosos:** Las tarjetas y modales principales emplean esquinas redondeadas de radio 24px (`rounded-3xl` / 1.5rem), confiriendo suavidad y aspecto contemporáneo.
- **Controles y Botones:** Radio de 12px a 16px (`rounded-xl` / `rounded-2xl`) que maximiza el área táctil aparente.
- **Badges Semafóricos:** Cápsulas elípticas completas (`rounded-full`) con micro-puntos indicadores de color.

## Components

### Buttons
- **Shape:** Esquinas redondeadas de 12px (`rounded-xl`).
- **Primary:** Fondo `#133E36`, texto `#FFFFFF`, relleno `12px 20px`, peso 700.
- **Hover / Focus:** Transición a `#0C2722` con anillo sutil `focus:ring-2 focus:ring-brand-900/20`.

### Cards / Containers
- **Corner Style:** Radio 24px (`rounded-3xl`).
- **Background:** Blanco puro `#FFFFFF`.
- **Border:** `1px solid rgba(226, 232, 240, 0.8)`.
- **Internal Padding:** 24px a 32px (`p-6` a `p-8`).

### Inputs / Fields
- **Style:** Fondo `#F8FAFC`, borde `#E2E8F0`, radio 12px (`rounded-xl`), padding `10px 16px`.
- **Focus:** Anillo `ring-2 ring-[#133E36]/20`, borde `#133E36`.

### Badges de Semáforo
- **🟢 Activa:** Fondo `#D1FAE5`, texto `#065F46`, borde `#A7F3D0`.
- **🟡 Por Vencer:** Fondo `#FEF3C7`, texto `#92400E`, borde `#FDE68A`.
- **🔴 Vencida / Bloqueada:** Fondo `#FEE2E2`, texto `#991B1B`, borde `#FECACA`.

## Do's and Don'ts

### Do:
- **Do** incluir siempre el texto explícito del estado junto al indicador de color en el semáforo para garantizar accesibilidad a usuarios con daltonismo.
- **Do** preservar el color `#133E36` como la identidad dominante de la barra lateral en el panel administrativo.
- **Do** formatear todas las claves de licencia en tipografía monoespaciada con opción de selección rápida.

### Don't:
- **Don't** utilizar bordes negros puros o sombras duras que rompan la atmósfera suave y limpia del diseño.
- **Don't** ocultar el número de referencia ni la fecha exacta de expiración en las vistas resumidas.
- **Don't** omitir el enlace directo de WhatsApp en las listas de clientes con pagos rechazados o licencias por vencer.

