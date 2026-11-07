// public/js/public.js - Lógica interactiva para la pantalla principal de usuarios

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Cierra modal al hacer click fuera del contenedor
window.addEventListener('click', (e) => {
  ['modalRegistro', 'modalPago', 'modalConsultar'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal && e.target === modal) {
      modal.classList.add('hidden');
    }
  });
});

// Preseleccionar App al hacer clic en tarjeta
function preselectApp(appName) {
  openModal('modalRegistro');
  const select = document.getElementById('regApp');
  if (select) {
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].text.includes(appName)) {
        select.selectedIndex = i;
        break;
      }
    }
  }
}

// Cargar catálogo inicial de Apps y Días de prueba configurados
async function loadPublicCatalog() {
  try {
    const res = await fetch('/api/v1/public/apps-and-plans');
    const data = await res.json();
    if (data.trial_days) {
      const el = document.getElementById('txtTrialDays');
      if (el) el.innerText = `${data.trial_days} días de prueba gratuita`;
    }
  } catch (err) {
    console.error('Error al cargar datos públicos:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadPublicCatalog);

// -------------------------------------------------------------
// REGISTRO DE NUEVO USUARIO
// -------------------------------------------------------------
async function handleRegistro(e) {
  e.preventDefault();
  const alertBox = document.getElementById('regAlert');
  const btn = document.getElementById('btnSubmitRegistro');

  const nombre = document.getElementById('regNombre').value;
  const email = document.getElementById('regEmail').value;
  const telefono = document.getElementById('regTelefono').value;
  const app_id = document.getElementById('regApp').value;

  alertBox.className = 'hidden';
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Procesando...';

  try {
    const res = await fetch('/api/v1/public/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, telefono, app_id }),
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 border border-red-200 block';
      alertBox.innerText = data.error || 'Ocurrió un error al procesar el registro.';
      btn.disabled = false;
      btn.innerHTML = '<span>Crear Cuenta y Activar Prueba</span><i class="fas fa-check ml-2"></i>';
      return;
    }

    alertBox.className = 'p-4 rounded-xl text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 block space-y-2';
    alertBox.innerHTML = `
      <div class="font-bold text-sm text-emerald-950 flex items-center space-x-2">
        <i class="fas fa-check-circle text-emerald-600 text-base"></i>
        <span>¡Registro Exitoso!</span>
      </div>
      <p>${data.message}</p>
      <div class="bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 mt-2">
        <div class="text-[11px] text-slate-500 font-semibold uppercase">Clave de Licencia Generada:</div>
        <div class="text-sm font-mono font-bold text-brand-900 select-all">${data.license.license_key}</div>
      </div>
      <p class="text-[11px] text-slate-600">Abre tu app móvil <strong>${data.app}</strong> e ingresa tu correo <strong>${email}</strong> para comenzar.</p>
    `;

    document.getElementById('formRegistro').reset();
    btn.disabled = false;
    btn.innerHTML = '<span>Registrar Otro Usuario</span>';
  } catch (err) {
    alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 border border-red-200 block';
    alertBox.innerText = 'Error de conexión con el servidor. Intente nuevamente.';
    btn.disabled = false;
    btn.innerHTML = '<span>Crear Cuenta y Activar Prueba</span><i class="fas fa-check ml-2"></i>';
  }
}

// -------------------------------------------------------------
// REPORTE DE PAGO
// -------------------------------------------------------------
async function handlePago(e) {
  e.preventDefault();
  const alertBox = document.getElementById('payAlert');
  const btn = document.getElementById('btnSubmitPago');

  const email = document.getElementById('payEmail').value;
  const app_id = document.getElementById('payApp').value;
  const referencia = document.getElementById('payReferencia').value;
  const monto = document.getElementById('payMonto').value;

  alertBox.className = 'hidden';
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Activando...';

  try {
    const res = await fetch('/api/v1/public/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, app_id, referencia, monto }),
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 border border-red-200 block';
      alertBox.innerText = data.error || 'Ocurrió un error al procesar el reporte de pago.';
      btn.disabled = false;
      btn.innerHTML = '<span>Confirmar y Activar Licencia</span><i class="fas fa-arrow-right ml-2"></i>';
      return;
    }

    const fechaFormat = new Date(data.nueva_fecha_vencimiento).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    alertBox.className = 'p-4 rounded-xl text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 block space-y-2';
    alertBox.innerHTML = `
      <div class="font-bold text-sm text-emerald-950 flex items-center space-x-2">
        <i class="fas fa-bolt text-emerald-600 text-base"></i>
        <span>¡Licencia Activada con Éxito!</span>
      </div>
      <p>${data.message}</p>
      <div class="bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800">
        <div><strong>Cliente:</strong> ${data.cliente}</div>
        <div><strong>App:</strong> ${data.app}</div>
        <div><strong>Nuevo Vencimiento:</strong> <span class="text-emerald-700 font-bold">${fechaFormat}</span></div>
        <div><strong>Referencia:</strong> ${data.referencia}</div>
      </div>
      <p class="text-[11px] text-slate-500">El estatus en tu app móvil ya se encuentra actualizado en modo ACTIVO (1).</p>
    `;

    document.getElementById('formPago').reset();
    btn.disabled = false;
    btn.innerHTML = '<span>Reportar Otro Pago</span>';
  } catch (err) {
    alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 border border-red-200 block';
    alertBox.innerText = 'Error de conexión con el servidor. Intente nuevamente.';
    btn.disabled = false;
    btn.innerHTML = '<span>Confirmar y Activar Licencia</span><i class="fas fa-arrow-right ml-2"></i>';
  }
}

// -------------------------------------------------------------
// CONSULTA DE ESTADO DE LICENCIA
// -------------------------------------------------------------
async function consultarLicencias() {
  const email = document.getElementById('chkEmail').value.trim();
  const resultsDiv = document.getElementById('chkResults');

  if (!email) {
    resultsDiv.innerHTML = '<div class="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl">Por favor ingresa un correo.</div>';
    return;
  }

  resultsDiv.innerHTML = '<div class="text-center py-4 text-xs text-slate-500"><i class="fas fa-spinner fa-spin mr-1"></i> Buscando licencias...</div>';

  try {
    const res = await fetch(`/api/v1/public/client-status?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!res.ok) {
      resultsDiv.innerHTML = `<div class="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200">${data.error || 'No se encontraron licencias.'}</div>`;
      return;
    }

    if (data.licencias.length === 0) {
      resultsDiv.innerHTML = '<div class="p-3 bg-slate-100 text-slate-600 text-xs rounded-xl">Este usuario no tiene licencias registradas aún.</div>';
      return;
    }

    let html = `
      <div class="text-xs font-semibold text-slate-500 mb-2">
        Licencias para <strong class="text-slate-800">${data.cliente.nombre}</strong>:
      </div>
    `;

    data.licencias.forEach(lic => {
      let badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      let iconColor = 'text-emerald-600';
      if (lic.badge === 'amarillo') {
        badgeBg = 'bg-amber-100 text-amber-800 border-amber-300';
        iconColor = 'text-amber-600';
      } else if (lic.badge === 'rojo') {
        badgeBg = 'bg-red-100 text-red-800 border-red-300';
        iconColor = 'text-red-600';
      }

      const fechaFmt = new Date(lic.fecha_fin).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      html += `
        <div class="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-sm flex items-center justify-between">
          <div>
            <div class="font-bold text-slate-900 flex items-center space-x-1.5">
              <i class="fas ${lic.app_icono || 'fa-mobile-alt'} ${iconColor}"></i>
              <span>${lic.app_nombre}</span>
            </div>
            <div class="font-mono text-[11px] text-slate-400 mt-0.5">${lic.license_key || 'LIC-KEY'}</div>
            <div class="text-[11px] text-slate-500 mt-1">Vence: ${fechaFmt}</div>
          </div>
          <div class="text-right">
            <span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeBg}">
              ${lic.estado_texto}
            </span>
          </div>
        </div>
      `;
    });

    resultsDiv.innerHTML = html;
  } catch (err) {
    resultsDiv.innerHTML = '<div class="p-3 bg-red-50 text-red-800 text-xs rounded-xl">Error al conectar con el servidor.</div>';
  }
}

