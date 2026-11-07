// public/js/admin.js - Control total del Dashboard Administrativo Grupo Vealo

const token = localStorage.getItem('vealo_token');
const userStr = localStorage.getItem('vealo_user');

// 1. Verificación obligatoria de autenticación
if (!token) {
  window.location.href = '/login';
}

let currentUser = {};
try {
  currentUser = JSON.parse(userStr) || {};
} catch (_) {}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function logout() {
  localStorage.removeItem('vealo_token');
  localStorage.removeItem('vealo_user');
  window.location.href = '/login';
}

// Variables globales para gráficos Chart.js
let chartAppsInstance = null;
let chartStatusInstance = null;
let searchTimeout = null;

function toggleMobileSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar && backdrop) {
    const isClosed = sidebar.classList.contains('-translate-x-full');
    if (isClosed) {
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    }
  }
}

// ========================================================
// CONTROL DE PESTAÑAS (TABS)
// ========================================================
function switchTab(tabId) {
  // Cerrar sidebar móvil al cambiar de pestaña si está abierta
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('adminSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  }
  const sections = ['overview', 'clients', 'payments', 'plans', 'admins', 'settings', 'api-tester'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    const btn = document.getElementById(`tabBtn-${s}`);
    if (el) el.classList.add('hidden');
    if (btn) btn.classList.remove('sidebar-active');
  });

  const activeEl = document.getElementById(`section-${tabId}`);
  const activeBtn = document.getElementById(`tabBtn-${tabId}`);
  if (activeEl) activeEl.classList.remove('hidden');
  if (activeBtn) activeBtn.classList.add('sidebar-active');

  // Carga de datos según la sección
  if (tabId === 'overview') loadOverviewStats();
  if (tabId === 'clients') loadClients();
  if (tabId === 'payments') loadPayments();
  if (tabId === 'plans') loadPlans();
  if (tabId === 'admins') loadAdmins();
  if (tabId === 'settings') loadSettings();
}

// Modales genéricos
function closeModalAdmin(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ========================================================
// 1. OVERVIEW / RESUMEN Y GRÁFICOS (ESTILO KENA)
// ========================================================
async function loadOverviewStats() {
  try {
    const res = await fetch('/api/v1/admin/stats', { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) return logout();
    const data = await res.json();
    const sum = data.summary;

    // Actualizar KPIs
    document.getElementById('kpiActivas').innerText = sum.activas;
    document.getElementById('kpiProximas').innerText = sum.proximasVencer;
    document.getElementById('kpiInactivas').innerText = sum.inactivas;
    document.getElementById('kpiPagosPendientes').innerText = sum.pendingPayments;
    document.getElementById('kpiMontoPendiente').innerText = `$${sum.pendingMonto.toFixed(2)} por auditar`;

    if (sum.pendingPayments > 0) {
      const b = document.getElementById('badgePendingPayments');
      b.innerText = sum.pendingPayments;
      b.classList.remove('hidden');
    } else {
      document.getElementById('badgePendingPayments').classList.add('hidden');
    }

    // Leyendas semáforo
    document.getElementById('legendVerde').innerText = sum.activas;
    document.getElementById('legendAmarillo').innerText = sum.proximasVencer;
    document.getElementById('legendRojo').innerText = sum.inactivas;

    // Renderizar gráfico de Apps (Barras estilo KENA: tonos bosque y menta)
    renderChartApps(data.appStats);

    // Renderizar gráfico semáforo (Doughnut)
    renderChartStatus(sum.activas, sum.proximasVencer, sum.inactivas);

    // Tabla de pagos recientes en overview
    renderOverviewRecentPayments(data.recentPayments);

  } catch (err) {
    console.error('Error al cargar stats:', err);
  }
}

function renderChartApps(appStats) {
  const ctx = document.getElementById('chartApps');
  if (!ctx) return;

  const labels = appStats.map(a => a.nombre);
  const values = appStats.map(a => parseInt(a.total_licencias, 10));

  if (chartAppsInstance) {
    chartAppsInstance.destroy();
  }

  chartAppsInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Licencias',
        data: values,
        backgroundColor: ['#133E36', '#10B981', '#047857'],
        borderRadius: 10,
        barThickness: 36,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderChartStatus(activas, proximas, inactivas) {
  const ctx = document.getElementById('chartStatus');
  if (!ctx) return;

  if (chartStatusInstance) {
    chartStatusInstance.destroy();
  }

  chartStatusInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Activas', 'Por Vencer', 'Inactivas/Bloqueadas'],
      datasets: [{
        data: [activas, proximas, inactivas],
        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderOverviewRecentPayments(payments) {
  const tbody = document.getElementById('overviewRecentPayments');
  if (!tbody) return;

  if (!payments || payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-400">No hay pagos recientes reportados.</td></tr>';
    return;
  }

  tbody.innerHTML = payments.map(p => {
    let badgeClass = 'bg-blue-100 text-blue-800';
    if (p.estado === 'aprobado') badgeClass = 'bg-emerald-100 text-emerald-800';
    if (p.estado === 'rechazado') badgeClass = 'bg-red-100 text-red-800';

    const fechaFmt = new Date(p.fecha_reporte).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3 font-mono font-bold text-slate-900">${p.referencia}</td>
        <td class="py-3 font-medium">${p.cliente_nombre}</td>
        <td class="py-3"><span class="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold">${p.app_nombre}</span></td>
        <td class="py-3 font-bold text-slate-900">$${parseFloat(p.monto).toFixed(2)}</td>
        <td class="py-3 text-slate-400">${fechaFmt}</td>
        <td class="py-3">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}">
            ${p.estado}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// 2. CLIENTES Y LICENCIAS (CARTELERA COMPLETA)
// ========================================================
function debounceLoadClients() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadClients, 250);
}

async function loadClients() {
  const search = document.getElementById('clientSearchInput')?.value || '';
  const app_id = document.getElementById('clientFilterApp')?.value || 'all';
  const status = document.getElementById('clientFilterStatus')?.value || 'all';

  const tbody = document.getElementById('clientsTableBody');
  if (!tbody) return;

  try {
    const url = `/api/v1/admin/clients?search=${encodeURIComponent(search)}&app_id=${app_id}&status=${status}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) return logout();
    const data = await res.json();

    if (!data.clients || data.clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400 font-medium">No se encontraron clientes o licencias con los filtros seleccionados.</td></tr>';
      return;
    }

    tbody.innerHTML = data.clients.map(c => {
      // Semáforo Badge
      let semaforoBadge = '';
      if (c.statusColor === 'verde') {
        semaforoBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span> ${c.statusLabel}
        </span>`;
      } else if (c.statusColor === 'amarillo') {
        semaforoBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <span class="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span> ${c.statusLabel}
        </span>`;
      } else {
        const isBlock = c.bloqueada_manualmente || c.licencia_estado === 'bloqueada';
        semaforoBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
          <span class="w-2 h-2 rounded-full bg-red-500 mr-1.5"></span> ${isBlock ? '🚫 Bloqueada' : 'Vencida'}
        </span>`;
      }

      // App Badge
      const appColor = c.app_color || '#133E36';
      const appBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm" style="background-color: ${appColor}">
        ${c.app_nombre || 'Sin App'}
      </span>`;

      // Fecha fin
      const fechaFinFmt = c.fecha_fin 
        ? new Date(c.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A';

      // Teléfono WhatsApp
      const cleanPhone = (c.cliente_telefono || '').replace(/[^0-9]/g, '');
      const whatsappBtn = cleanPhone 
        ? `<a href="https://wa.me/${cleanPhone}" target="_blank" class="text-emerald-600 hover:text-emerald-800 ml-1.5" title="Abrir WhatsApp">
             <i class="fab fa-whatsapp"></i>
           </a>`
        : '';

      const isBlocked = c.bloqueada_manualmente || c.licencia_estado === 'bloqueada';
      const blockBtnText = isBlocked ? 'Desbloquear' : 'Bloquear';
      const blockBtnIcon = isBlocked ? 'fa-unlock' : 'fa-ban';
      const blockBtnClass = isBlocked 
        ? 'text-emerald-600 hover:bg-emerald-50' 
        : 'text-amber-600 hover:bg-amber-50';

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-3 px-4">${semaforoBadge}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${c.cliente_nombre}</div>
            <div class="text-[11px] text-slate-400">${c.cliente_email}</div>
          </td>
          <td class="py-3 px-4">
            <div class="text-xs font-semibold text-slate-700 flex items-center">
              <span>${c.cliente_telefono || 'S/N'}</span>
              ${whatsappBtn}
            </div>
          </td>
          <td class="py-3 px-4">${appBadge}</td>
          <td class="py-3 px-4 font-mono font-bold text-[11px] text-brand-900 select-all">
            ${c.license_key || '---'}
          </td>
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800">${fechaFinFmt}</div>
            <div class="text-[10px] text-slate-400">${c.plan_nombre || 'Plan Estándar'}</div>
          </td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center space-x-1.5">
              <!-- BOTÓN EDITAR -->
              <button onclick='openEditModal(${JSON.stringify(c)})' 
                      class="w-9 h-9 flex items-center justify-center rounded-xl text-slate-700 hover:text-brand-900 hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-brand-900" 
                      title="Editar datos y licencia"
                      aria-label="Editar datos de ${c.cliente_nombre}">
                <i class="fas fa-edit text-xs"></i>
              </button>

              <!-- BOTÓN BLOQUEAR / DESBLOQUEAR EN CUALQUIER MOMENTO -->
              <button onclick="toggleBlockLicense(${c.cliente_id}, ${isBlocked})" 
                      class="w-9 h-9 flex items-center justify-center rounded-xl ${blockBtnClass} transition focus-visible:ring-2 focus-visible:ring-brand-900" 
                      title="${blockBtnText} Licencia"
                      aria-label="${blockBtnText} licencia de ${c.cliente_nombre}">
                <i class="fas ${blockBtnIcon} text-xs"></i>
              </button>

              <!-- BOTÓN ELIMINAR -->
              <button onclick="deleteClient(${c.cliente_id}, '${c.cliente_nombre}')" 
                      class="w-9 h-9 flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-500" 
                      title="Eliminar cliente"
                      aria-label="Eliminar cliente ${c.cliente_nombre}">
                <i class="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error al cargar clientes:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-red-500 font-medium">Error al cargar clientes desde el servidor.</td></tr>';
  }
}

// -------------------------------------------------------------
// BLOQUEO / DESBLOQUEO MANUAL DE LICENCIA EN CUALQUIER MOMENTO
// -------------------------------------------------------------
async function toggleBlockLicense(clientId, isCurrentlyBlocked) {
  const confirmMsg = isCurrentlyBlocked 
    ? '¿Deseas DESBLOQUEAR esta licencia y reactivar el acceso a la app móvil?'
    : '¿Estás seguro de BLOQUEAR esta licencia? La app móvil recibirá estatus inactivo (0) inmediatamente.';

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/v1/admin/clients/${clientId}/toggle-block`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ motivo: 'Bloqueo manual por el Administrador' })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al cambiar estado de la licencia');
      return;
    }

    // Recargar tabla y resumen
    loadClients();
    loadOverviewStats();
  } catch (err) {
    alert('Error al conectar con el servidor.');
  }
}

// -------------------------------------------------------------
// ELIMINAR CLIENTE
// -------------------------------------------------------------
async function deleteClient(clientId, clientName) {
  if (!confirm(`¿Eliminar definitivamente al cliente "${clientName}" y todas sus licencias asociadas?`)) return;

  try {
    const res = await fetch(`/api/v1/admin/clients/${clientId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (res.ok) {
      loadClients();
      loadOverviewStats();
    } else {
      const data = await res.json();
      alert(data.error || 'No se pudo eliminar el cliente.');
    }
  } catch (err) {
    alert('Error al conectar con el servidor.');
  }
}

// -------------------------------------------------------------
// EDITAR CLIENTE Y LICENCIA (MODAL)
// -------------------------------------------------------------
function openEditModal(c) {
  document.getElementById('editClientId').value = c.cliente_id;
  document.getElementById('editNombre').value = c.cliente_nombre || '';
  document.getElementById('editEmail').value = c.cliente_email || '';
  document.getElementById('editTelefono').value = c.cliente_telefono || '';

  if (c.fecha_fin) {
    const d = new Date(c.fecha_fin);
    // Formatear para datetime-local (YYYY-MM-DDTHH:mm)
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    document.getElementById('editFechaFin').value = localISOTime;
  }

  const editEstado = document.getElementById('editEstado');
  if (c.bloqueada_manualmente) {
    editEstado.value = 'bloqueada';
  } else if (c.statusColor === 'verde' || c.statusColor === 'amarillo') {
    editEstado.value = 'activa';
  } else {
    editEstado.value = 'inactiva';
  }

  document.getElementById('editAlert').className = 'hidden';
  document.getElementById('modalEditClient').classList.remove('hidden');
}

async function handleSaveEditClient(e) {
  e.preventDefault();
  const id = document.getElementById('editClientId').value;
  const nombre = document.getElementById('editNombre').value;
  const email = document.getElementById('editEmail').value;
  const telefono = document.getElementById('editTelefono').value;
  const fecha_fin = document.getElementById('editFechaFin').value;
  const estado = document.getElementById('editEstado').value;
  const alertBox = document.getElementById('editAlert');

  try {
    const res = await fetch(`/api/v1/admin/clients/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ nombre, email, telefono, fecha_fin, estado })
    });

    const data = await res.json();
    if (!res.ok) {
      alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 block';
      alertBox.innerText = data.error || 'Error al guardar cambios.';
      return;
    }

    closeModalAdmin('modalEditClient');
    loadClients();
    loadOverviewStats();
  } catch (err) {
    alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 block';
    alertBox.innerText = 'Error al conectar con el servidor.';
  }
}

// -------------------------------------------------------------
// CREAR CLIENTE MANUAL (MODAL)
// -------------------------------------------------------------
function openModalClienteNuevo() {
  document.getElementById('formNewClient').reset();
  document.getElementById('newClientAlert').className = 'hidden';
  document.getElementById('modalNewClient').classList.remove('hidden');
}

async function handleCreateClient(e) {
  e.preventDefault();
  const nombre = document.getElementById('newNombre').value;
  const email = document.getElementById('newEmail').value;
  const telefono = document.getElementById('newTelefono').value;
  const app_id = document.getElementById('newApp').value;
  const dias = document.getElementById('newDias').value;
  const alertBox = document.getElementById('newClientAlert');

  try {
    const res = await fetch('/api/v1/public/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, telefono, app_id })
    });

    const data = await res.json();
    if (!res.ok) {
      alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 block';
      alertBox.innerText = data.error || 'Error al crear cliente.';
      return;
    }

    closeModalAdmin('modalNewClient');
    loadClients();
    loadOverviewStats();
  } catch (err) {
    alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 block';
    alertBox.innerText = 'Error al conectar con el servidor.';
  }
}

// ========================================================
// 3. PAGOS REPORTADOS (APROBAR / RECHAZAR)
// ========================================================
async function loadPayments() {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/v1/admin/payments', { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) return logout();
    const data = await res.json();

    if (!data.payments || data.payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400 font-medium">No se han registrado pagos aún.</td></tr>';
      return;
    }

    tbody.innerHTML = data.payments.map(p => {
      let badge = '';
      if (p.estado === 'pendiente') {
        badge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Pendiente de Revisión</span>';
      } else if (p.estado === 'aprobado') {
        badge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Aprobado / Validado</span>';
      } else {
        badge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">Rechazado</span>';
      }

      const fechaFmt = new Date(p.fecha_reporte).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      let actions = '';
      if (p.estado === 'pendiente') {
        actions = `
          <button onclick="approvePayment(${p.id})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm mr-1">
            <i class="fas fa-check mr-1"></i> Aprobar
          </button>
          <button onclick="openRejectPaymentModal(${p.id})" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm">
            <i class="fas fa-times mr-1"></i> Rechazar
          </button>
        `;
      } else if (p.estado === 'rechazado') {
        actions = `<span class="text-[11px] text-slate-400 italic">Rechazado: ${p.observaciones || 'Sin detalles'}</span>`;
      } else {
        actions = `<span class="text-[11px] text-emerald-700 font-semibold"><i class="fas fa-check-double mr-1"></i> Validado</span>`;
      }

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-mono font-bold text-slate-900">${p.referencia}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${p.cliente_nombre}</div>
            <div class="text-[11px] text-slate-400">${p.cliente_email} &bull; ${p.cliente_telefono}</div>
          </td>
          <td class="py-3 px-4 font-semibold text-slate-800">${p.app_nombre}</td>
          <td class="py-3 px-4 font-extrabold text-slate-900 text-sm">$${parseFloat(p.monto).toFixed(2)}</td>
          <td class="py-3 px-4 text-slate-500">${fechaFmt}</td>
          <td class="py-3 px-4">${badge}</td>
          <td class="py-3 px-4 text-center">${actions}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error al cargar pagos:', err);
  }
}

async function approvePayment(paymentId) {
  if (!confirm('¿Confirmar y validar este pago como verificado?')) return;

  try {
    const res = await fetch(`/api/v1/admin/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: authHeaders()
    });

    if (res.ok) {
      loadPayments();
      loadOverviewStats();
    } else {
      alert('Error al aprobar el pago.');
    }
  } catch (err) {
    alert('Error al conectar con el servidor.');
  }
}

function openRejectPaymentModal(paymentId) {
  document.getElementById('rejectPaymentId').value = paymentId;
  document.getElementById('rejectMotivo').value = '';
  document.getElementById('modalRejectPayment').classList.remove('hidden');
}

async function confirmRejectPayment() {
  const paymentId = document.getElementById('rejectPaymentId').value;
  const motivo = document.getElementById('rejectMotivo').value.trim();

  if (!motivo) {
    alert('Por favor especifica un motivo de rechazo.');
    return;
  }

  try {
    const res = await fetch(`/api/v1/admin/payments/${paymentId}/reject`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ motivo })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al rechazar pago.');
      return;
    }

    closeModalAdmin('modalRejectPayment');
    loadPayments();
    loadOverviewStats();
    loadClients();

    // Requisito: "en caso de no ser correcto contactara al usuario"
    // Ofrecer apertura directa de WhatsApp con el mensaje preformateado
    if (data.contactInfo?.whatsappLink) {
      if (confirm(`El pago fue rechazado y la licencia suspendida.\n¿Deseas abrir WhatsApp para notificar a ${data.contactInfo.nombre} de inmediato?`)) {
        window.open(data.contactInfo.whatsappLink, '_blank');
      }
    }
  } catch (err) {
    alert('Error al procesar el rechazo del pago.');
  }
}

// ========================================================
// 4. PLANES Y DURACIONES DE LICENCIA
// ========================================================
async function loadPlans() {
  const grid = document.getElementById('plansGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/v1/admin/plans', { headers: authHeaders() });
    const data = await res.json();

    if (!data.plans || data.plans.length === 0) {
      grid.innerHTML = '<div class="col-span-3 text-center py-8 text-slate-400">No hay planes creados aún.</div>';
      return;
    }

    grid.innerHTML = data.plans.map(p => `
      <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-extrabold text-slate-900 text-lg">${p.nombre}</h4>
            <span class="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              ${p.duracion_dias} Días
            </span>
          </div>
          <div class="text-2xl font-black text-brand-900 mt-2">
            $${parseFloat(p.precio).toFixed(2)} <span class="text-xs text-slate-400 font-normal">/ suscripción</span>
          </div>
          <p class="text-xs text-slate-500 mt-3 leading-relaxed">
            ${p.descripcion || 'Plan estándar asignable a clientes de la plataforma.'}
          </p>
        </div>
        <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="font-semibold text-slate-400">Duración: <strong>${p.duracion_dias} días</strong></span>
          <span class="font-bold text-emerald-600">Activo</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error al cargar planes:', err);
  }
}

function openModalPlanNuevo() {
  const nombre = prompt('Nombre del nuevo plan (Ej: Plan Semestral):');
  if (!nombre) return;
  const dias = prompt('Duración en días (Ej: 180):', '180');
  if (!dias) return;
  const precio = prompt('Precio en USD (Ej: 75.00):', '75.00');

  fetch('/api/v1/admin/plans', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ nombre, duracion_dias: parseInt(dias, 10), precio: parseFloat(precio) || 0 })
  }).then(r => r.json()).then(data => {
    if (data.success) {
      loadPlans();
    } else {
      alert(data.error || 'Error al crear plan');
    }
  });
}

// ========================================================
// 5. ADMINISTRADORES
// ========================================================
async function loadAdmins() {
  const tbody = document.getElementById('adminsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/v1/auth/admins', { headers: authHeaders() });
    const data = await res.json();

    if (!data.admins || data.admins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-slate-400">No hay administradores registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = data.admins.map(a => {
      const fechaFmt = new Date(a.created_at).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      const isPrimary = a.username.toLowerCase() === 'admin';
      const deleteBtn = isPrimary
        ? '<span class="text-[11px] text-slate-400 font-semibold italic">Principal (Hardcodeado)</span>'
        : `<button onclick="deleteAdmin(${a.id}, '${a.username}')" class="text-red-600 hover:text-red-800 text-xs font-bold transition">
             <i class="fas fa-trash-alt mr-1"></i> Eliminar
           </button>`;

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
            <div class="w-7 h-7 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center text-xs">
              <i class="fas fa-user-shield"></i>
            </div>
            <span>${a.username}</span>
          </td>
          <td class="py-3 px-4 text-slate-700">${a.nombre || 'Administrador'}</td>
          <td class="py-3 px-4 text-slate-400">${fechaFmt}</td>
          <td class="py-3 px-4 text-center">${deleteBtn}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error al cargar admins:', err);
  }
}

function openModalAdminNuevo() {
  const username = prompt('Nombre de usuario para el nuevo administrador:');
  if (!username) return;
  const password = prompt('Contraseña:');
  if (!password) return;
  const nombre = prompt('Nombre completo o cargo (opcional):', 'Administrador');

  fetch('/api/v1/auth/admins', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, password, nombre })
  }).then(r => r.json()).then(data => {
    if (data.success) {
      alert('Administrador creado exitosamente.');
      loadAdmins();
    } else {
      alert(data.error || 'Error al crear administrador');
    }
  });
}

async function deleteAdmin(id, username) {
  if (!confirm(`¿Eliminar la cuenta de administrador "${username}"?`)) return;

  try {
    const res = await fetch(`/api/v1/auth/admins/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      loadAdmins();
    } else {
      alert(data.error || 'Error al eliminar administrador');
    }
  } catch (err) {
    alert('Error al conectar con el servidor.');
  }
}

// ========================================================
// 6. CONFIGURACIÓN DEL SISTEMA
// Requisito del usuario:
// "apenas se registren dias de pruebas 30 y que pueda modificar esos dias en un modulo de configuracion."
// ========================================================
async function loadSettings() {
  try {
    const res = await fetch('/api/v1/admin/settings', { headers: authHeaders() });
    const data = await res.json();
    const s = data.settings || {};

    if (s.trial_days) document.getElementById('cfgTrialDays').value = s.trial_days;
    if (s.warning_days) document.getElementById('cfgWarningDays').value = s.warning_days;
    if (s.support_whatsapp) document.getElementById('cfgWhatsapp').value = s.support_whatsapp;
  } catch (err) {
    console.error('Error al cargar configuración:', err);
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const trial_days = document.getElementById('cfgTrialDays').value;
  const warning_days = document.getElementById('cfgWarningDays').value;
  const support_whatsapp = document.getElementById('cfgWhatsapp').value;
  const alertBox = document.getElementById('settingsAlert');

  try {
    const res = await fetch('/api/v1/admin/settings', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ trial_days, warning_days, support_whatsapp })
    });

    const data = await res.json();
    if (res.ok) {
      alertBox.className = 'p-3 rounded-xl text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 block';
      alertBox.innerText = 'Configuración actualizada exitosamente.';
      setTimeout(() => alertBox.className = 'hidden', 3500);
      loadOverviewStats();
    } else {
      alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 border border-red-200 block';
      alertBox.innerText = data.error || 'Error al actualizar configuración.';
    }
  } catch (err) {
    alertBox.className = 'p-3 rounded-xl text-xs bg-red-100 text-red-800 border border-red-200 block';
    alertBox.innerText = 'Error al conectar con el servidor.';
  }
}

// ========================================================
// 7. PROBADOR DE API MÓVIL
// ========================================================
async function testMobileApi() {
  const email = document.getElementById('apiTestEmail').value.trim();
  const app = document.getElementById('apiTestApp').value;
  const respEl = document.getElementById('apiTestResponse');
  const badgeEl = document.getElementById('apiTestBadge');

  if (!email) {
    alert('Ingresa un correo para probar la API.');
    return;
  }

  respEl.innerText = '// Enviando petición HTTP GET...';

  try {
    const start = performance.now();
    const res = await fetch(`/api/v1/license/check?email=${encodeURIComponent(email)}&app=${encodeURIComponent(app)}`);
    const data = await res.json();
    const end = performance.now();
    const latency = Math.round(end - start);

    respEl.innerText = JSON.stringify(data, null, 2);

    if (data.status === 1) {
      badgeEl.className = 'text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
      badgeEl.innerHTML = `<i class="fas fa-check-circle mr-1"></i> STATUS: 1 (ACTIVO) &bull; ${latency}ms`;
    } else {
      badgeEl.className = 'text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-300';
      badgeEl.innerHTML = `<i class="fas fa-times-circle mr-1"></i> STATUS: 0 (INACTIVO) &bull; ${latency}ms`;
    }
  } catch (err) {
    respEl.innerText = '// Error de conexión con el endpoint.';
    badgeEl.className = 'text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-800';
    badgeEl.innerText = 'ERROR HTTP';
  }
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  if (currentUser.nombre) {
    const el = document.getElementById('topUserName');
    if (el) el.innerText = currentUser.nombre;
    const greeting = document.getElementById('topGreeting');
    if (greeting) greeting.innerText = `¡Bienvenido de nuevo, ${currentUser.nombre}!`;
  }
  loadOverviewStats();
});

