---
name: vealo-mobile-license
description: "Instrucciones de integración nativa para Android Studio (Kotlin/Java) con Gemini: implementa la verificación de licencias del Grupo Vealo en apps móviles (Cobrale, Passnet, etc.) y bloquea los Intents de envío de mensajes por WhatsApp si la licencia está vencida o inactiva (status 0)."
---

# Guía de Integración para Android Studio (Kotlin / Java) con Gemini

Esta guía y skill está diseñada específicamente para proyectos nativos en **Android Studio**, optimizada para que **Gemini en Android Studio** (o el programador) implemente la verificación de licencias de **Grupo Vealo** y restrinja el envío de mensajes por WhatsApp mediante `Intent` cuando la licencia esté inactiva o no pagada (`status: 0`).

---

## 🎯 Regla de Negocio en la App Móvil

1. **Permiso Total:** Si la API responde `status: 1`, la app permite abrir WhatsApp con normalidad mediante el `Intent` del sistema.
2. **Bloqueo Estricto:** Si la API responde `status: 0` (o no hay licencia), la app **interrumpe el `startActivity(intent)`**, no abre WhatsApp y muestra un `MaterialAlertDialog` explicando que la suscripción está vencida, con un botón para abrir el portal de pago.
3. **Caché Local:** Guarda el estado en `SharedPreferences` para que la app no dependa de conexión celular en cada clic si se encuentra en zonas sin cobertura.

---

## 📋 Archivos a Crear y Modificar en Android Studio

### 1. `AndroidManifest.xml`: Permisos de Internet y Tráfico HTTP
En Android 9+ (API 28+), el tráfico HTTP plano hacia IPs locales (`http://192.168.x.x:3000`) requiere `usesCleartextTraffic="true"` para pruebas locales:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Permiso de Internet requerido -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:usesCleartextTraffic="true"
        ... >
        <!-- Package visibility para abrir WhatsApp en Android 11+ (API 30+) -->
        <queries>
            <package android:name="com.whatsapp" />
            <package android:name="com.whatsapp.w4b" />
        </queries>
        ...
    </application>
</manifest>
```

---

### 2. Dependencias en `build.gradle.kts` o `build.gradle` (Module :app)
Asegurarse de tener `OkHttp` (o `Retrofit`) y corrutinas para llamadas asíncronas limpias:
```kotlin
// OkHttp para consultas HTTP rápidas y ligeras
implementation("com.squareup.okhttp3:okhttp:4.12.0")
// Corrutinas para no bloquear la UI
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
// Componentes Material Design para diálogos elegantes
implementation("com.google.android.material:material:1.11.0")
```

---

### 3. Servicio de Licencias: `LicenseManager.kt`
Crear este archivo en el paquete `com.tuempresa.app.licensing` o `utils`:

```kotlin
package com.grupovealo.licensing

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object LicenseManager {

    // Cambia a la IP de tu PC donde corre server.js (ej. "http://192.168.1.50:3000") o tu dominio web
    const val BASE_URL = "http://192.168.1.100:3000"
    const val APP_NAME = "Cobrale" // O "Passnet" o "Vealo Admin"

    private const val PREFS_NAME = "VealoLicensePrefs"
    private const val KEY_EMAIL = "client_email"
    private const val KEY_IS_ACTIVE = "is_license_active"
    private const val KEY_EXPIRES_AT = "expires_at"
    private const val KEY_DAYS_LEFT = "days_left"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Guarda el correo del cliente registrado
    fun setClientEmail(context: Context, email: String) {
        getPrefs(context).edit().putString(KEY_EMAIL, email.trim().lowercase()).apply()
    }

    fun getClientEmail(context: Context): String? {
        return getPrefs(context).getString(KEY_EMAIL, null)
    }

    // Comprueba si el estado cacheado localmente está activo
    fun isCachedActive(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_IS_ACTIVE, false)
    }

    // Consulta la API en segundo plano
    suspend fun verifyLicenseOnline(context: Context): Boolean = withContext(Dispatchers.IO) {
        val email = getClientEmail(context) ?: return@withContext false

        try {
            val url = "$BASE_URL/api/v1/license/check?email=${java.net.URLEncoder.encode(email, "UTF-8")}&app=${java.net.URLEncoder.encode(APP_NAME, "UTF-8")}"
            val request = Request.Builder().url(url).get().build()
            val response = httpClient.newCall(request).execute()

            if (response.isSuccessful) {
                val bodyString = response.body?.string() ?: return@withContext false
                val json = JSONObject(bodyString)

                // El backend retorna status 1 (activo) o 0 (inactivo/vencido)
                val status = json.optInt("status", 0)
                val isActive = (status == 1)
                val daysLeft = json.optInt("days_left", 0)
                val expiresAt = json.optString("expires_at", "")

                // Guardar en SharedPreferences
                getPrefs(context).edit()
                    .putBoolean(KEY_IS_ACTIVE, isActive)
                    .putInt(KEY_DAYS_LEFT, daysLeft)
                    .putString(KEY_EXPIRES_AT, expiresAt)
                    .apply()

                return@withContext isActive
            }
        } catch (e: Exception) {
            e.printStackTrace()
            // En caso de fallo de red o modo offline, usar el último estado cacheado
            return@withContext isCachedActive(context)
        }
        return@withContext false
    }
}
```

---

### 4. Guardián de WhatsApp: `WhatsAppGuard.kt`
Este componente reemplaza cualquier disparo directo de WhatsApp. Si la licencia está inactiva, bloquea el Intent y muestra el diálogo con botón de pago.

```kotlin
package com.grupovealo.licensing

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URLEncoder

object WhatsAppGuard {

    /**
     * Valida la licencia antes de enviar un mensaje de WhatsApp.
     * Si está activa -> Dispara el Intent de WhatsApp.
     * Si está inactiva -> Bloquea y muestra diálogo de pago.
     */
    fun sendProtectedWhatsApp(
        context: Context,
        scope: CoroutineScope,
        phone: String,
        message: String
    ) {
        scope.launch {
            // 1. Verificación rápida local o en línea
            val isActive = LicenseManager.verifyLicenseOnline(context)

            withContext(Dispatchers.Main) {
                if (isActive) {
                    // LICENCIA VÁLIDA: Proceder al envío normal
                    executeWhatsAppIntent(context, phone, message)
                } else {
                    // LICENCIA INACTIVA: BLOQUEAR ENVÍO
                    showBlockedDialog(context, scope, phone, message)
                }
            }
        }
    }

    private fun executeWhatsAppIntent(context: Context, phone: String, message: String) {
        try {
            val cleanPhone = phone.replace(Regex("[^0-9]"), "")
            val encodedMsg = URLEncoder.encode(message, "UTF-8")
            val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleanPhone&text=$encodedMsg")

            val intent = Intent(Intent.ACTION_VIEW, uri)
            intent.setPackage("com.whatsapp")

            // Si WhatsApp estándar no está instalado, intentar abrir con navegador o Business
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
            } else {
                val genericIntent = Intent(Intent.ACTION_VIEW, uri)
                context.startActivity(genericIntent)
            }
        } catch (e: Exception) {
            Toast.makeText(context, "No se pudo abrir WhatsApp: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showBlockedDialog(
        context: Context,
        scope: CoroutineScope,
        pendingPhone: String,
        pendingMessage: String
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("🔒 Función de WhatsApp Bloqueada")
            .setMessage("El envío de mensajes y recordatorios por WhatsApp requiere una suscripción activa de Grupo Vealo para esta aplicación.\n\nPor favor reporte su pago para reactivar el servicio al instante.")
            .setCancelable(false)
            .setPositiveButton("Pagar / Activar Licencia") { dialog, _ ->
                dialog.dismiss()
                // Abrir portal público de Grupo Vealo en el navegador
                val portalIntent = Intent(Intent.ACTION_VIEW, Uri.parse(LicenseManager.BASE_URL))
                context.startActivity(portalIntent)
            }
            .setNeutralButton("Reintentar Validación") { dialog, _ ->
                dialog.dismiss()
                Toast.makeText(context, "Verificando estado con el servidor...", Toast.LENGTH_SHORT).show()
                scope.launch {
                    val activeNow = LicenseManager.verifyLicenseOnline(context)
                    withContext(Dispatchers.Main) {
                        if (activeNow) {
                            Toast.makeText(context, "✅ ¡Licencia Activada! Enviando mensaje...", Toast.LENGTH_LONG).show()
                            executeWhatsAppIntent(context, pendingPhone, pendingMessage)
                        } else {
                            Toast.makeText(context, "❌ La licencia continúa inactiva o no registrada.", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
            .setNegativeButton("Cancelar") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }
}
```

---

## ⚡ Cómo Usarlo en tus `Activity` o `Fragment`

En cualquier botón donde antes hacías el envío de WhatsApp:

### Antes (Código Desprotegido):
```kotlin
btnEnviarWhatsApp.setOnClickListener {
    val url = "https://wa.me/584121234567?text=Recordatorio%20de%20pago"
    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
}
```

### Ahora (Código Protegido con Licencia Grupo Vealo):
```kotlin
import androidx.lifecycle.lifecycleScope
import com.grupovealo.licensing.WhatsAppGuard

btnEnviarWhatsApp.setOnClickListener {
    // Si no se ha configurado el email del cliente aún:
    // LicenseManager.setClientEmail(this, "cliente@ejemplo.com")

    WhatsAppGuard.sendProtectedWhatsApp(
        context = this,
        scope = lifecycleScope,
        phone = "+58 412 1234567",
        message = "Estimado cliente, le recordamos su cuota pendiente por cobrar."
    )
}
```

---

## 🤖 Prompt Listo para Copiar y Pegar en Gemini en Android Studio

Puedes copiar y pegar el siguiente texto directamente en el panel de **Gemini** dentro de Android Studio:

> **Prompt para Gemini en Android Studio:**
> 
> "Actúa como un desarrollador senior de Android. Necesito integrar la validación de licencias de Grupo Vealo en este proyecto para restringir el envío de mensajes por WhatsApp si la licencia no está activa.
> 
> Las reglas son:
> 1. Consultar el endpoint: `http://<IP_SERVIDOR>:3000/api/v1/license/check?email={email}&app=Cobrale` mediante HTTP GET.
> 2. Si la API retorna `{"status": 1}`, la licencia está activa y se debe permitir abrir WhatsApp con normalidad.
> 3. Si la API retorna `{"status": 0}` o falla, se debe BLOQUEAR el Intent de WhatsApp y mostrar un MaterialAlertDialog que informe: 'Función de WhatsApp Bloqueada: Tu suscripción está inactiva o vencida', con un botón para abrir el navegador web en el portal de pago y otro para reintentar la verificación.
> 4. Guarda el correo y el último estado en SharedPreferences para soporte offline.
> 
> Por favor busca en mi proyecto todos los lugares donde se envían mensajes por WhatsApp (buscando 'wa.me', 'whatsapp://' o Intents de WhatsApp) e indícame los cambios exactos para reemplazar esos envíos directos por la llamada protegida."
