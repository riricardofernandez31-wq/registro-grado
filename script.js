// =============================================
//  REGISTRO DE GRADO - FRONTEND CON BACKEND
//  script.js
// =============================================

const API = (function(){
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000/api';
    return 'https://registro-grado-production.up.railway.app/api';
})();
let usuarioActual    = null;
let estudiantesCache = [];
let editandoEstudianteId = null;
let aulasCache = [];
let aulasDocente = [];
let aulaSeleccionada = null;
let maestrosCache = [];
let editandoAulaId = null;
let chartPromedioGrado = null;
let mostrarTodosEstudiantes = false;

function parseFechaMySQL(fecha) {
    if (!fecha) return null;
    const s = String(fecha).substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// =============================================
//  SISTEMA DE NOTIFICACIONES (TOAST)
// =============================================
function showToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    const iconos = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${iconos[tipo] || 'ℹ️'}</span>
        <span class="toast-mensaje">${mensaje}</span>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =============================================
//  MODAL DE CONFIRMACIÓN
// =============================================
function showConfirm(mensaje, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
        <div class="confirm-content">
            <p class="confirm-mensaje">${mensaje}</p>
            <div class="confirm-actions">
                <button class="btn-cancel">Cancelar</button>
                <button class="btn-confirm">Confirmar</button>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger animation
    setTimeout(() => overlay.classList.add('show'), 10);

    const btnCancel = modal.querySelector('.btn-cancel');
    const btnConfirm = modal.querySelector('.btn-confirm');

    function cerrar() {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
    }

    btnCancel.addEventListener('click', () => {
        cerrar();
        if (onCancel) onCancel();
    });

    btnConfirm.addEventListener('click', () => {
        cerrar();
        if (onConfirm) onConfirm();
    });

    // Cerrar con Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            cerrar();
            document.removeEventListener('keydown', handleEscape);
            if (onCancel) onCancel();
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// =============================================
//  MODAL DE INPUT (Prompt elegante)
// =============================================
function showPrompt(mensaje, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';

        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-content">
                <p class="confirm-mensaje">${mensaje}</p>
                <input type="text" id="prompt-input" class="prompt-input" value="${defaultValue}" placeholder="Escriba aquí...">
                <div class="confirm-actions" style="margin-top: 20px;">
                    <button class="btn-cancel">Cancelar</button>
                    <button class="btn-confirm">Aceptar</button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Trigger animation
        setTimeout(() => overlay.classList.add('show'), 10);

        const input = modal.querySelector('#prompt-input');
        const btnCancel = modal.querySelector('.btn-cancel');
        const btnConfirm = modal.querySelector('.btn-confirm');

        function cerrar(valor) {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                resolve(valor);
            }, 300);
        }

        input.focus();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                cerrar(input.value || null);
            }
        });

        btnCancel.addEventListener('click', () => cerrar(null));
        btnConfirm.addEventListener('click', () => cerrar(input.value || null));

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cerrar(null);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

// =============================================
//  LOGIN
// =============================================
window.addEventListener("load", async function() {
    try {
        const res  = await fetch(`${API}/configuracion`);
        const data = await res.json();
        if (data.nombre_centro)
            document.getElementById("loginNombreCentro").textContent = data.nombre_centro;
    } catch (err) {}
    
    // Restaurar sesión si existe rol guardado en localStorage
    const userRol = localStorage.getItem('userRol');
    if (userRol) {
        aplicarVistaRol(userRol);
    }
});

document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const usuario  = document.getElementById("usuario").value.trim();
    const password = document.getElementById("password").value;
    const errorDiv = document.getElementById("loginError");

    try {
        const res  = await fetch(`${API}/login`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ usuario, password })
        });
        const data = await res.json();

        if (!res.ok) {
            errorDiv.textContent   = data.error || "Credenciales incorrectas.";
            errorDiv.style.display = "block";
            return;
        }

        errorDiv.style.display = "none";
        usuarioActual = data.usuario;
        localStorage.setItem('userRol', data.usuario.rol);
        localStorage.setItem('usuarioId', data.usuario.id);
        document.getElementById("userNameDisplay").textContent = data.usuario.nombre;
        document.getElementById("userRolBadge").textContent    = formatRol(data.usuario.rol);
        document.getElementById("loginContainer").style.display = "none";
        document.getElementById("dashboard").style.display      = "flex";
        aplicarPermisos(data.usuario.rol);
        aplicarVistaRol(data.usuario.rol);
        cargarNombreCentro();
        
        if (data.usuario.rol === "docente") {
            await cargarAulasDocente(data.usuario.id);
        }
        mostrarSeccion("inicio");
        document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
        document.querySelector('[data-section="inicio"]')?.classList.add("active");

    } catch (err) {
        errorDiv.textContent   = "No se pudo conectar al servidor. Esta corriendo Node.js?";
        errorDiv.style.display = "block";
    }
});

function formatRol(rol) {
    const roles = { admin:"Administrador", director:"Director", docente:"Docente",
                    coordinador:"Coordinador", secretaria:"Secretaria" };
    return roles[rol] || rol;
}

// =============================================
//  PERMISOS POR ROL
// =============================================
function aplicarPermisos(rol) {
    const linkUsuarios      = document.querySelector('[data-section="usuarios"]');
    const linkConfiguracion = document.querySelector('[data-section="configuracion"]');
    if (rol === "admin" || rol === "director") {
        linkUsuarios.style.display      = "flex";
        linkConfiguracion.style.display = "flex";
    } else {
        linkUsuarios.style.display      = "none";
        linkConfiguracion.style.display = "none";
    }
}

function aplicarVistaRol(rol) {
    const navItems = document.querySelectorAll('.nav-item');
    const busquedaLink = document.querySelector('[data-section="busqueda"]');

    if (rol === 'docente') {
        const seccionesDocente = ['inicio', 'busqueda', 'asistencia', 'calificaciones', 'participaciones'];
        navItems.forEach(item => {
            const seccion = item.getAttribute('data-section');
            item.style.display = seccionesDocente.includes(seccion) ? 'flex' : 'none';
        });
        if (busquedaLink) busquedaLink.innerHTML = '<span class="nav-icon">📋</span> Mis Estudiantes';
        // Ocultar filtros de grado/sección en buscador para docentes
        const filtrosAvanzados = document.getElementById('filtros-avanzados');
        if (filtrosAvanzados) filtrosAvanzados.style.display = 'none';
    } else {
        navItems.forEach(item => { item.style.display = 'flex'; });
        if (busquedaLink) busquedaLink.innerHTML = '<span class="nav-icon">&#128269;</span> Buscador';
        const filtrosAvanzados = document.getElementById('filtros-avanzados');
        if (filtrosAvanzados) filtrosAvanzados.style.display = '';
    }
}

// =============================================
//  NOMBRE DEL CENTRO EN SIDEBAR
// =============================================
async function cargarNombreCentro() {
    try {
        const res  = await fetch(`${API}/configuracion`);
        const data = await res.json();
        if (data.nombre_centro) {
            const palabras = data.nombre_centro.split(" ");
            const corto    = palabras.length > 3
                ? palabras.slice(0, 3).join(" ") + "..."
                : data.nombre_centro;
            document.getElementById("sidebarNombreCentro").innerHTML = corto.replace(" ", "<br>");
        }
    } catch (err) {}
}

// =============================================
//  LOGOUT
// =============================================
document.getElementById("btnLogout").addEventListener("click", function() {
    usuarioActual    = null;
    estudiantesCache = [];
    aulaSeleccionada = null;
    aulasDocente     = [];
    localStorage.removeItem('userRol');
    localStorage.removeItem('usuarioId');
    localStorage.removeItem('aulaSeleccionadaId');
    const badge = document.getElementById("aulaActivaBadge");
    if (badge) badge.style.display = "none";
    document.getElementById("dashboard").style.display      = "none";
    document.getElementById("loginContainer").style.display = "flex";
    document.getElementById("loginForm").reset();
    document.getElementById("loginError").style.display     = "none";
});

document.getElementById("btnHamburger").addEventListener("click", function() {
    document.querySelector(".sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("active");
});
document.getElementById("sidebarOverlay").addEventListener("click", function() {
    document.querySelector(".sidebar").classList.remove("open");
    this.classList.remove("active");
});

// =============================================
//  NAVEGACION
// =============================================
document.querySelectorAll(".nav-item").forEach(function(item) {
    item.addEventListener("click", function(e) {
        e.preventDefault();
        const seccion = this.getAttribute("data-section");
        mostrarSeccion(seccion);
        document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
        this.classList.add("active");
        if (window.innerWidth <= 768) {
            document.querySelector(".sidebar").classList.remove("open");
            document.getElementById("sidebarOverlay").classList.remove("active");
        }
    });
});

function mostrarSeccion(nombre) {
    // "participaciones" no tiene sección propia, usa sec-asistencia
    const seccionReal = nombre === "participaciones" ? "asistencia" : nombre;
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    const sec = document.getElementById("sec-" + seccionReal);
    if (sec) sec.classList.add("active");

    const rol = localStorage.getItem('userRol') || (usuarioActual && usuarioActual.rol);
    const titulos = {
        inicio: "Panel Principal",
        estudiantes: "Registro de Estudiantes",
        busqueda: rol === 'docente' ? "Mis Estudiantes" : "Buscador Avanzado",
        calificaciones: "Registro de Calificaciones",
        asistencia: "Control de Asistencia",
        participaciones: "Participaciones",
        reportes: "Reportes Academicos",
        usuarios: "Gestion de Usuarios",
        configuracion: "Configuracion Institucional"
    };
    document.getElementById("sectionTitle").textContent = titulos[nombre] || "";

    if (nombre === "inicio") {
        if (rol === 'docente') {
            const panelDocente = document.getElementById('docente-aulas-panel');
            const panelAdmin = document.getElementById('admin-dashboard-panel');
            if (panelDocente) panelDocente.style.display = '';
            if (panelAdmin) panelAdmin.style.display = 'none';
            renderizarPanelDocente();
        } else {
            const panelDocente = document.getElementById('docente-aulas-panel');
            const panelAdmin = document.getElementById('admin-dashboard-panel');
            if (panelDocente) panelDocente.style.display = 'none';
            if (panelAdmin) panelAdmin.style.display = '';
            cargarDashboard();
            setTimeout(initGraficas, 500);
        }
    }
    if (nombre === "estudiantes")    cargarTablaEstudiantes();
    if (nombre === "busqueda")       iniciarBusqueda();
    if (nombre === "calificaciones") cargarSelectEstudiantes();
    if (nombre === "asistencia")     cargarAsistencia();
    if (nombre === "participaciones") cargarAsistencia().then(() => seleccionarTabAsistencia('participaciones'));
    if (nombre === "usuarios")       cargarTablaUsuarios();
    if (nombre === "configuracion")  cargarConfiguracion();
}

// =============================================
//  DASHBOARD
// =============================================
async function cargarDashboard() {
    try {
        const res  = await fetch(`${API}/estudiantes`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
            console.error("Dashboard error:", data.detalle || data.error || data);
            return;
        }
        estudiantesCache = data;
        // Actualizar KPI de estudiantes rápido
        const kpiEst = document.getElementById("kpi-estudiantes");
        if (kpiEst) kpiEst.textContent = data.length;

        // Solicitar estadísticas completas al servidor para poblar KPIs y gráficas
        try {
            const sres = await fetch(`${API}/dashboard/stats`);
            const stats = await sres.json();
            if (sres.ok) {
                const kpiAsistencia = document.getElementById("kpi-asistencia");
                if (kpiAsistencia) kpiAsistencia.textContent = typeof stats.asistencia_hoy === 'number' ? stats.asistencia_hoy : 0;
                const kpiPromedio = document.getElementById("kpi-promedio");
                if (kpiPromedio) kpiPromedio.textContent = typeof stats.promedio_general === 'number' ? stats.promedio_general.toFixed(1) : 0;
                const kpiAlertas = document.getElementById("kpi-alertas");
                if (kpiAlertas) kpiAlertas.textContent = stats.alertas_academicas || 0;
            }
        } catch (err) { console.error("Error cargando stats:", err); }

        // Llenar tabla de últimos estudiantes registrados (5)
        const tbody     = document.getElementById("tablaRecientes");
        const recientes = data.slice(0, 5);
        if (recientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No hay estudiantes registrados aun.</td></tr>';
        } else {
            tbody.innerHTML = recientes.map(e =>
                `<tr><td>${e.nombre}</td><td>${e.matricula}</td><td>${e.grado}</td><td>${e.seccion||"—"}</td></tr>`
            ).join("");
        }

        // Llenar tabla de Top 5 alertas académicas
        try {
            const alertRes = await fetch(`${API}/dashboard/alertas-academicas`);
            const alertas = alertRes.ok ? await alertRes.json() : [];
            const tbodyAlertas = document.getElementById("tablaAlertas");
            if (!tbodyAlertas) return;
            
            if (!Array.isArray(alertas) || alertas.length === 0) {
                tbodyAlertas.innerHTML = '<tr><td colspan="3" class="empty-row">No hay alertas académicas.</td></tr>';
            } else {
                const top5 = alertas.slice(0, 5);
                tbodyAlertas.innerHTML = top5.map(a => {
                    let nivelColor = 'background: #2e7d32; color: #fff;';
                    if (a.promedio < 60) {
                        nivelColor = 'background: #c62828; color: #fff;';
                    } else if (a.promedio < 75) {
                        nivelColor = 'background: #e65100; color: #fff;';
                    } else if (a.promedio < 85) {
                        nivelColor = 'background: #f57f17; color: #fff;';
                    }
                    return `<tr><td>${a.nombre_estudiante || a.nombre}</td><td>${a.promedio ? a.promedio.toFixed(1) : '—'}</td><td><span style="${nivelColor} padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600;">${a.nivel || 'Bajo'}</span></td></tr>`;
                }).join("");
            }
        } catch (err) { 
            console.warn("Error cargando alertas académicas:", err);
            const tbodyAlertas = document.getElementById("tablaAlertas");
            if (tbodyAlertas) tbodyAlertas.innerHTML = '<tr><td colspan="3" class="empty-row">Error al cargar alertas</td></tr>';
        }
    } catch (err) { console.error("Error dashboard:", err); }
}

// =============================================
// Charts
// =============================================
async function initGraficas() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js no está cargado');
        return;
    }

    let promedioData = [];

    try {
        const pgRes = await fetch(`${API}/dashboard/promedios-por-grado`);
        const pgJson = pgRes.ok ? await pgRes.json() : [];

        promedioData = Array.isArray(pgJson) ? pgJson.map(d => ({ label: d.grado || '', value: Number(d.promedio || 0) })) : [];
    } catch (err) {
        console.error('Error cargando datos de gráficas:', err);
    }

    const crearGrafica = (canvasId, type, labels, values, label) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) { console.error(`Canvas ${canvasId} no encontrado`); return; }
        if (ctx._chartInstance) ctx._chartInstance.destroy();
        const chart = new Chart(ctx, {
            type,
            data: { labels, datasets: [{ label: label || '', data: values, backgroundColor: '#1565c0', borderColor: '#0d47a1', borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
        ctx._chartInstance = chart;
    };

    crearGrafica(
        'chartPromedioGrado',
        'bar',
        promedioData.map(d => d.label),
        promedioData.map(d => d.value),
        'Promedio'
    );
}


// =============================================
//  ESTUDIANTES
// =============================================
document.getElementById("formEstudiante").addEventListener("submit", async function(e) {
    e.preventDefault();
    const datos = {
        nombre:           document.getElementById("est-nombre").value.trim(),
        matricula:        document.getElementById("est-matricula").value.trim(),
        cedula:           document.getElementById("est-cedula").value.trim() || null,
        fecha_nacimiento: document.getElementById("est-fechanac").value || null,
        sexo:             document.getElementById("est-sexo").value || null,
        grado:            document.getElementById("est-grado").value,
        seccion:          document.getElementById("est-seccion").value || null,
        tutor:            document.getElementById("est-tutor").value.trim(),
        parentesco_tutor: document.getElementById("est-parentesco").value.trim() || null,
        telefono:         document.getElementById("est-telefono").value.trim(),
        direccion:        document.getElementById("est-direccion").value.trim(),
        observaciones:    document.getElementById("est-observaciones").value.trim()
    };
    try {
        const url    = editandoEstudianteId ? `${API}/estudiantes/${editandoEstudianteId}` : `${API}/estudiantes`;
        const method = editandoEstudianteId ? "PUT" : "POST";
        const res    = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(datos) });
        const data   = await res.json();
        if (!res.ok) { showToast(data.error || "Error al guardar.", "error"); return; }
        cancelarEdicionEstudiante();
        this.reset();
        const msg = document.getElementById("msgEstudiante");
        msg.textContent   = editandoEstudianteId ? "Estudiante actualizado exitosamente." : "Estudiante guardado exitosamente.";
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarTablaEstudiantes();
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
});

function editarEstudiante(id) {
    const est = estudiantesCache.find(e => e.id === id);
    if (!est) return;
    editandoEstudianteId = id;
    document.getElementById("est-nombre").value        = est.nombre           || "";
    document.getElementById("est-matricula").value     = est.matricula        || "";
    document.getElementById("est-cedula").value        = est.cedula           || "";
    document.getElementById("est-fechanac").value      = est.fecha_nacimiento ? est.fecha_nacimiento.split("T")[0] : "";
    document.getElementById("est-sexo").value          = est.sexo             || "";
    document.getElementById("est-grado").value         = est.grado            || "";
    document.getElementById("est-seccion").value       = est.seccion          || "";
    document.getElementById("est-tutor").value         = est.tutor            || "";
    document.getElementById("est-parentesco").value    = est.parentesco_tutor || "";
    document.getElementById("est-telefono").value      = est.telefono         || "";
    document.getElementById("est-direccion").value     = est.direccion        || "";
    document.getElementById("est-observaciones").value = est.observaciones    || "";
    document.getElementById("btnSubmitEstudiante").textContent  = "Actualizar Estudiante";
    document.getElementById("btnCancelarEdicion").style.display = "inline-block";
    document.querySelector("#sec-estudiantes .panel-title").textContent = "Editar Estudiante";
    document.getElementById("est-nombre").scrollIntoView({ behavior:"smooth", block:"center" });
}

function cancelarEdicionEstudiante() {
    editandoEstudianteId = null;
    document.getElementById("formEstudiante").reset();
    document.getElementById("btnSubmitEstudiante").textContent  = "Guardar Estudiante";
    document.getElementById("btnCancelarEdicion").style.display = "none";
    document.querySelector("#sec-estudiantes .panel-title").textContent = "Registrar Nuevo Estudiante";
}

async function eliminarEstudiante(id, nombre) {
    showConfirm(`¿Está seguro que desea eliminar al estudiante "${nombre}"?`, () => {
        fetch(`${API}/estudiantes/${id}`, { method:"DELETE" })
        .then(res => { if (!res.ok) { showToast("Error al eliminar.", "error"); return; }
        cargarTablaEstudiantes(); })
        .catch(err => { showToast("No se pudo conectar al servidor.", "error"); });
    }, () => {});
    return;
    try {
        const res = await fetch(`${API}/estudiantes/${id}`, { method:"DELETE" });
        if (!res.ok) { showToast("Error al eliminar.", "error"); return; }
        cargarTablaEstudiantes();
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
}

async function cargarTablaEstudiantes() {
    try {
        const res  = await fetch(`${API}/estudiantes`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) {
            console.error("Estudiantes error:", data.detalle || data.error || data);
            return;
        }
        estudiantesCache = data;
        const tbody = document.getElementById("tablaEstudiantes");
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No hay estudiantes registrados.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(e => `
            <tr>
                <td style="font-weight:700;color:#1565c0;text-align:center">${e.orden || '—'}</td>
                <td>${e.nombre}</td>
                <td>${e.matricula}</td>
                <td>${e.grado}</td>
                <td>${e.seccion||"—"}</td>
                <td>${e.tutor||"—"}</td>
                <td style="white-space:nowrap">
                    <button onclick="editarEstudiante(${e.id})"
                        style="background:#1565c0;color:#fff;padding:5px 12px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-right:6px">
                        Editar</button>
                    <button onclick="eliminarEstudiante(${e.id},'${e.nombre.replace(/'/g,"\\\'")}')"
                        style="background:#c62828;color:#fff;padding:5px 12px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
                        Eliminar</button>
                </td>
            </tr>`).join("");
    } catch (err) { console.error("Error estudiantes:", err); }
}

// =============================================
//  CALIFICACIONES
// =============================================
async function cargarSelectEstudiantes() {
    try {
        const res  = await fetch(`${API}/estudiantes`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) return;
        estudiantesCache = data;

        // Para docentes con aula seleccionada, filtrar solo sus estudiantes
        const lista = aulaSeleccionada
            ? data.filter(est => String(est.aula_id) === String(aulaSeleccionada.id))
            : data;

        const select = document.getElementById("cal-estudiante");
        select.innerHTML = '<option value="">Seleccione estudiante</option>';
        lista.forEach(function(est) {
            const opt = document.createElement("option");
            opt.value       = est.id;
            opt.textContent = `N°${est.orden || '?'} - ${est.nombre} (${est.grado}${est.seccion ? " - "+est.seccion : ""})`;
            select.appendChild(opt);
        });
        cargarTablaCalificaciones();
    } catch (err) { console.error("Error select:", err); }
}

async function actualizarAsignacionCalificacion() {
    const estudianteId = document.getElementById("cal-estudiante").value;
    const asignatura   = document.getElementById("cal-asignatura").value;
    const input        = document.getElementById("cal-asignacion-id");
    input.value = "";
    if (!estudianteId || !asignatura) return;
    const estudiante = estudiantesCache.find(e => String(e.id) === String(estudianteId));
    if (!estudiante || !estudiante.aula_id) return;
    try {
        const res = await fetch(`${API}/asignaciones/aula/${estudiante.aula_id}`);
        if (!res.ok) return;
        const asignaciones = await res.json();
        const match = asignaciones.find(a => a.asignatura === asignatura);
        if (match) input.value = match.id;
    } catch (err) {
        console.error("Error buscando asignacion:", err);
    }
}

document.getElementById("cal-estudiante").addEventListener("change", actualizarAsignacionCalificacion);
document.getElementById("cal-asignatura").addEventListener("change", actualizarAsignacionCalificacion);

["cal-p1","cal-p2","cal-p3","cal-p4"].forEach(function(id) {
    document.getElementById(id).addEventListener("input", function() {
        const p1 = parseFloat(document.getElementById("cal-p1").value) || 0;
        const p2 = parseFloat(document.getElementById("cal-p2").value) || 0;
        const p3 = parseFloat(document.getElementById("cal-p3").value) || 0;
        const p4 = parseFloat(document.getElementById("cal-p4").value) || 0;
        document.getElementById("cal-final").value = ((p1 + p2 + p3 + p4) / 4).toFixed(1);
    });
});

document.getElementById("formCalificaciones").addEventListener("submit", async function(e) {
    e.preventDefault();
    const datos = {
        estudiante_id: document.getElementById("cal-estudiante").value,
        asignatura:    document.getElementById("cal-asignatura").value,
        competencia:   document.getElementById("cal-competencia").value.trim(),
        nota1:         document.getElementById("cal-p1").value || null,
        nota2:         document.getElementById("cal-p2").value || null,
        nota3:         document.getElementById("cal-p3").value || null,
        nota4:         document.getElementById("cal-p4").value || null,
        asignacion_id: document.getElementById("cal-asignacion-id").value || null,
        observaciones: document.getElementById("cal-obs").value.trim()
    };
    try {
        const res  = await fetch(`${API}/calificaciones`, {
            method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(datos)
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Error al guardar.", "error"); return; }
        this.reset();
        const msg = document.getElementById("msgCalificacion");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarTablaCalificaciones();
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
});

async function cargarTablaCalificaciones() {
    try {
        const res  = await fetch(`${API}/calificaciones`);
        const data = await res.json();
        const tbody = document.getElementById("tablaCalificaciones");
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay calificaciones registradas.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(c => {
            const est = estudiantesCache.find(e => e.id === c.estudiante_id);
            const orden = est ? (est.orden || '—') : '—';
            return `<tr><td style="font-weight:700;color:#1565c0;text-align:center">${orden}</td><td>${c.nombre_estudiante}</td><td>${c.asignatura}</td><td>${c.nota1 ?? '—'}</td><td>${c.nota2 ?? '—'}</td><td>${c.nota3 ?? '—'}</td><td>${c.nota4 ?? '—'}</td><td><strong>${c.promedio ?? '—'}</strong></td></tr>`;
        }).join("");
    } catch (err) { console.error("Error calificaciones:", err); }
}

// =============================================
//  ASISTENCIA
// =============================================
const hoy = new Date();
document.getElementById("fechaHoy").textContent =
    hoy.toLocaleDateString("es-DO", {weekday:"long",year:"numeric",month:"long",day:"numeric"});

async function cargarAsistencia() {
    try {
        const [resEst, resAulas] = await Promise.all([
            fetch(`${API}/estudiantes`),
            fetch(`${API}/aulas`)
        ]);
        const data = await resEst.json();
        const aulas = await resAulas.json();
        if (!resEst.ok || !Array.isArray(data)) return;
        estudiantesCache = data;
        aulasCache = Array.isArray(aulas) ? aulas : [];

        // Para docentes con aula seleccionada, mostrar solo sus estudiantes
        const listaAsis = aulaSeleccionada
            ? data.filter(est => String(est.aula_id) === String(aulaSeleccionada.id))
            : data;

        const contenedor = document.getElementById("listaAsistencia");
        if (listaAsis.length === 0) {
            contenedor.innerHTML = aulaSeleccionada
                ? '<p class="empty-row">No hay estudiantes activos en el aula seleccionada.</p>'
                : '<p class="empty-row">Registre estudiantes primero para tomar asistencia.</p>';
        } else {
            contenedor.innerHTML = listaAsis.map(est => `
                <div class="asistencia-row">
                    <span class="asistencia-orden">${est.orden || '—'}</span>
                    <span class="asistencia-nombre">${est.nombre}</span>
                    <div class="asistencia-opciones">
                        <label><input type="radio" name="as-${est.id}" value="presente" checked> Presente</label>
                        <label><input type="radio" name="as-${est.id}" value="ausente"> Ausente</label>
                        <label><input type="radio" name="as-${est.id}" value="tardanza"> Tardanza</label>
                        <label><input type="radio" name="as-${est.id}" value="excusa"> Excusa</label>
                    </div>
                </div>`).join("");
        }

        const selectAula = document.getElementById("selAulaParticipaciones");
        if (selectAula) {
            selectAula.innerHTML = '<option value="">Seleccione un aula</option>' + aulasCache
                .map(a => `<option value="${a.id}">${a.aula_numero || a.grado + '-' + a.seccion}</option>`)
                .join("");
            // Pre-seleccionar el aula activa para docentes
            if (aulaSeleccionada) {
                selectAula.value = String(aulaSeleccionada.id);
            }
        }

        const fechaParticipaciones = document.getElementById("fechaParticipaciones");
        if (fechaParticipaciones) {
            fechaParticipaciones.value = new Date().toISOString().split("T")[0];
        }

        seleccionarTabAsistencia("asistencia");
        cargarParticipacionesAula();
    } catch (err) { console.error("Error asistencia:", err); }
}

function seleccionarTabAsistencia(tab) {
    document.querySelectorAll(".asistencia-tab").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.getElementById("panelAsistencia").style.display = tab === "asistencia" ? "block" : "none";
    document.getElementById("panelParticipaciones").style.display = tab === "participaciones" ? "block" : "none";
}

async function cargarParticipacionesAula() {
    const aulaId = document.getElementById("selAulaParticipaciones")?.value;
    const fecha = document.getElementById("fechaParticipaciones")?.value;
    const contenedor = document.getElementById("listaParticipaciones");
    if (!aulaId) {
        if (contenedor) contenedor.innerHTML = '<p class="empty-row">Seleccione un aula para cargar los estudiantes.</p>';
        return;
    }
    if (!fecha) {
        if (contenedor) contenedor.innerHTML = '<p class="empty-row">Seleccione una fecha válida.</p>';
        return;
    }
    const aulaEstudiantes = estudiantesCache.filter(est => String(est.aula_id) === String(aulaId) && est.activo === 1);
    if (!aulaEstudiantes.length) {
        if (contenedor) contenedor.innerHTML = '<p class="empty-row">No hay estudiantes activos en este aula.</p>';
        return;
    }

    let existing = [];
    try {
        const res = await fetch(`${API}/participaciones/aula/${aulaId}/fecha/${fecha}`);
        if (res.ok) {
            existing = await res.json();
        }
    } catch (err) {
        console.warn("No se pudo cargar participaciones existentes:", err);
    }
    const existingMap = existing.reduce((acc, item) => {
        acc[item.estudiante_id] = item;
        return acc;
    }, {});

    if (contenedor) {
        contenedor.innerHTML = '<div class="participaciones-lista-rows">' + aulaEstudiantes.map(est => {
            const registro = existingMap[est.id] || {};
            const score = registro.puntuacion ? registro.puntuacion : "";
            const obs = registro.observacion || registro.descripcion || "";
            return `
                <div class="participacion-row">
                    <div style="display:flex;align-items:center;gap:8px"><span style="background:#e3f2fd;color:#1565c0;font-weight:700;font-size:12px;padding:2px 7px;border-radius:4px;min-width:28px;text-align:center">N°${est.orden || '?'}</span><strong>${est.nombre}</strong></div>
                    <div>
                        <label style="font-size:13px;color:#555">Puntaje</label>
                        <select class="part-score part-input" data-id="${est.id}">
                            <option value="">--</option>
                            <option value="1" ${score === 1 ? 'selected' : ''}>1</option>
                            <option value="2" ${score === 2 ? 'selected' : ''}>2</option>
                            <option value="3" ${score === 3 ? 'selected' : ''}>3</option>
                            <option value="4" ${score === 4 ? 'selected' : ''}>4</option>
                            <option value="5" ${score === 5 ? 'selected' : ''}>5</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:13px;color:#555">Observación</label>
                        <input type="text" class="part-input part-observacion" data-id="${est.id}" placeholder="Breve nota..." value="${obs ? String(obs).replace(/"/g, '&quot;') : ''}">
                    </div>
                </div>`;
        }).join('') + '</div>';
    }
}

async function guardarParticipacionesAula() {
    const aulaId = document.getElementById("selAulaParticipaciones")?.value;
    const fecha = document.getElementById("fechaParticipaciones")?.value;
    if (!aulaId || !fecha) {
        showToast("Seleccione aula y fecha antes de guardar.", "warning");
        return;
    }
    const filas = Array.from(document.querySelectorAll(".participacion-row"));
    const registros = filas.map(row => {
        const estudianteId = row.querySelector(".part-score")?.dataset.id || row.querySelector(".part-observacion")?.dataset.id;
        const puntuacion = parseInt(row.querySelector(".part-score")?.value || "", 10);
        const observacion = row.querySelector(".part-observacion")?.value.trim() || "";
        return {
            estudiante_id: estudianteId ? parseInt(estudianteId, 10) : null,
            fecha,
            puntuacion: isNaN(puntuacion) ? 0 : puntuacion,
            observacion
        };
    }).filter(r => r.estudiante_id && (r.puntuacion > 0 || r.observacion));

    if (!registros.length) {
        showToast("Debe registrar al menos una puntuación o observación.", "warning");
        return;
    }

    try {
        const resultados = await Promise.all(registros.map(r => fetch(`${API}/participaciones`, {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify(r)
        })));
        const fallos = await Promise.all(resultados.map(async (res, idx) => ({ ok: res.ok, data: await res.json().catch(() => null), registro: registros[idx] })));
        const error = fallos.find(item => !item.ok);
        if (error) {
            console.error("Error guardando participaciones:", error);
            showToast(error.data?.error || "Ocurrió un error al guardar algunas participaciones.", "error");
            return;
        }
        const msg = document.getElementById("msgParticipaciones");
        if (msg) {
            msg.style.display = "block";
            setTimeout(() => msg.style.display = "none", 3000);
        }
        cargarParticipacionesAula();
    } catch (err) {
        console.error("Error guardando participaciones:", err);
        showToast("No se pudo conectar al servidor.", "error");
    }
}

document.getElementById("btnGuardarAsistencia").addEventListener("click", async function() {
    const listaEst = aulaSeleccionada
        ? estudiantesCache.filter(e => String(e.aula_id) === String(aulaSeleccionada.id))
        : estudiantesCache;
    if (listaEst.length === 0) return;
    const fechaHoy  = hoy.toISOString().split("T")[0];
    const registros = listaEst.map(function(est) {
        const sel = document.querySelector(`input[name="as-${est.id}"]:checked`);
        return { estudiante_id:est.id, fecha:fechaHoy, estado:sel?sel.value:"presente", observacion:"" };
    });
    try {
        const res = await fetch(`${API}/asistencia`, {
            method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({registros})
        });
        if (!res.ok) { showToast("Error al guardar asistencia.", "error"); return; }
        const msg = document.getElementById("msgAsistencia");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
});

document.getElementById("btnGuardarParticipaciones")?.addEventListener("click", async function() {
    await guardarParticipacionesAula();
});

// =============================================
//  REPORTES
// =============================================
async function generarReporte(tipo) {
    const contenedor = document.getElementById("reporteContenido");
    try {
        let data = [];
        let titulo = "";
        let columnas = [];
        let filas = "";

        if (tipo === "estudiantes") {
            const res = await fetch(`${API}/estudiantes`);
            data = await res.json();
            titulo = "Listado de Estudiantes";
            columnas = ["Nombre","Matricula","Grado","Seccion","Tutor"];
            filas = data.map(e =>
                `<tr><td>${e.nombre}</td><td>${e.matricula}</td><td>${e.grado}</td><td>${e.seccion||"—"}</td><td>${e.tutor||"—"}</td></tr>`
            ).join("");
        } else if (tipo === "calificaciones") {
            const res = await fetch(`${API}/calificaciones`);
            data = await res.json();
            titulo = "Reporte de Calificaciones";
            columnas = ["Estudiante","Asignatura","P1","P2","P3","P4","Promedio"];
            filas = data.map(c =>
                `<tr><td>${c.nombre_estudiante}</td><td>${c.asignatura}</td><td>${c.nota1 ?? '—'}</td><td>${c.nota2 ?? '—'}</td><td>${c.nota3 ?? '—'}</td><td>${c.nota4 ?? '—'}</td><td><strong>${c.promedio ?? '—'}</strong></td></tr>`
            ).join("");
        } else if (tipo === "asistencia") {
            const res = await fetch(`${API}/asistencia`);
            data = await res.json();
            titulo = "Reporte de Asistencia";
            columnas = ["Estudiante","Fecha","Estado","Observacion"];
            filas = data.map(a =>
                `<tr><td>${a.nombre_estudiante}</td>
                 <td>${new Date(a.fecha).toLocaleDateString("es-DO",{year:"numeric",month:"long",day:"numeric"})}</td>
                 <td>${a.estado.charAt(0).toUpperCase()+a.estado.slice(1)}</td>
                 <td>${a.observacion||"—"}</td></tr>`
            ).join("");
        }

        if (data.length === 0) {
            contenedor.innerHTML = '<div class="msg-success" style="background:#fff3e0;color:#e65100;border-color:#ffe0b2">No hay datos para mostrar.</div>';
            return;
        }

        const thCols = columnas.map(c => `<th>${c}</th>`).join("");

        contenedor.innerHTML = `
            <div class="panel">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 class="panel-title" style="margin:0">${titulo} (${data.length} registros)</h3>
                    <div style="display:flex;gap:10px">
                        <button onclick="exportar('pdf','${tipo}')" 
                            style="background:#c62828;color:#fff;padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:auto">
                            Exportar PDF
                        </button>
                        <button onclick="exportar('excel','${tipo}')"
                            style="background:#2e7d32;color:#fff;padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:auto">
                            Exportar Excel
                        </button>
                    </div>
                </div>
                <table class="data-table">
                    <thead><tr>${thCols}</tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>`;

    } catch (err) { console.error("Error reporte:", err); }
}

function exportar(formato, tipo) {
    window.open(`${API}/exportar/${formato}/${tipo}`, "_blank");
}

function exportarBoletin(formato, estudianteId) {
    if (!estudianteId) {
        showToast("Debe seleccionar un estudiante.", "warning");
        return;
    }
    window.open(`${API}/exportar/boletin/${formato}/${estudianteId}`, "_blank");
}

// =============================================
//  USUARIOS
// =============================================
document.getElementById("formUsuario").addEventListener("submit", async function(e) {
    e.preventDefault();
    const datos = {
        nombre:   document.getElementById("usr-nombre").value.trim(),
        usuario:  document.getElementById("usr-usuario").value.trim(),
        password: document.getElementById("usr-password").value,
        rol:      document.getElementById("usr-rol").value
    };
    try {
        const res  = await fetch(`${API}/usuarios`, {
            method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(datos)
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Error al crear usuario.", "error"); return; }
        this.reset();
        const msg = document.getElementById("msgUsuario");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarTablaUsuarios();
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
});

async function cargarTablaUsuarios() {
    try {
        const res  = await fetch(`${API}/usuarios`);
        const data = await res.json();
        const tbody = document.getElementById("tablaUsuarios");
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No hay usuarios registrados.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.nombre}</td><td>${u.usuario}</td><td>${formatRol(u.rol)}</td>
                <td><button onclick="eliminarUsuario(${u.id},'${u.nombre}')"
                    style="background:#c62828;padding:6px 14px;font-size:13px;border-radius:6px;width:auto">
                    Eliminar</button></td>
            </tr>`).join("");
    } catch (err) { console.error("Error usuarios:", err); }
}

async function eliminarUsuario(id, nombre) {
    showConfirm(`¿Está seguro que desea eliminar al usuario "${nombre}"?`, () => {
        fetch(`${API}/usuarios/${id}`, { method:"DELETE" })
        .then(res => { if (!res.ok) { showToast("Error al eliminar.", "error"); return; }
        cargarTablaUsuarios(); })
        .catch(err => { showToast("No se pudo conectar al servidor.", "error"); });
    }, () => {});
    return;
    try {
        const res = await fetch(`${API}/usuarios/${id}`, { method:"DELETE" });
        if (!res.ok) { showToast("Error al eliminar.", "error"); return; }
        cargarTablaUsuarios();
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
}

// =============================================
//  CONFIGURACION
// =============================================
async function cargarConfiguracion() {
    try {
        const res  = await fetch(`${API}/configuracion`);
        const data = await res.json();
        document.getElementById("cfg-nombre").value    = data.nombre_centro || "";
        document.getElementById("cfg-anio").value      = data.anio_escolar  || "";
        document.getElementById("cfg-director").value  = data.director      || "";
        document.getElementById("cfg-telefono").value  = data.telefono      || "";
        document.getElementById("cfg-distrito").value  = data.distrito      || "";
        document.getElementById("cfg-regional").value  = data.regional      || "";
        document.getElementById("cfg-direccion").value = data.direccion     || "";
    } catch (err) { console.error("Error configuracion:", err); }
}

document.getElementById("formConfiguracion").addEventListener("submit", async function(e) {
    e.preventDefault();
    const datos = {
        nombre_centro: document.getElementById("cfg-nombre").value.trim(),
        anio_escolar:  document.getElementById("cfg-anio").value.trim(),
        director:      document.getElementById("cfg-director").value.trim(),
        telefono:      document.getElementById("cfg-telefono").value.trim(),
        distrito:      document.getElementById("cfg-distrito").value.trim(),
        regional:      document.getElementById("cfg-regional").value.trim(),
        direccion:     document.getElementById("cfg-direccion").value.trim()
    };
    try {
        const res  = await fetch(`${API}/configuracion`, {
            method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(datos)
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Error al guardar.", "error"); return; }
        const msg = document.getElementById("msgConfiguracion");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarNombreCentro();
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
});

// =============================================
//  BUSQUEDA AVANZADA
// =============================================
let busquedaTimeout     = null;
let fichaActualId       = null;
let busquedaInicializada = false;

function iniciarBusqueda() {
    if (!busquedaInicializada) {
        busquedaInicializada = true;
        document.getElementById("busqueda-input").addEventListener("input", function() {
            clearTimeout(busquedaTimeout);
            busquedaTimeout = setTimeout(buscarEstudiantes, 350);
        });
        document.getElementById("filtro-grado").addEventListener("change", buscarEstudiantes);
        document.getElementById("filtro-seccion").addEventListener("change", buscarEstudiantes);
    }
    const rol = localStorage.getItem('userRol') || (usuarioActual && usuarioActual.rol);
    if (rol === 'docente') {
        mostrarTodosEstudiantes = false;
        actualizarBannerDocente();
    }
    buscarEstudiantes();
}

async function buscarEstudiantes() {
    const q = document.getElementById("busqueda-input").value.trim();
    const rol = localStorage.getItem('userRol') || (usuarioActual && usuarioActual.rol);
    const params = new URLSearchParams();
    if (q) params.set("q", q);

    if (rol !== 'docente') {
        const grado   = document.getElementById("filtro-grado").value;
        const seccion = document.getElementById("filtro-seccion").value;
        if (grado)   params.set("grado", grado);
        if (seccion) params.set("seccion", seccion);
    }

    const contenedor = document.getElementById("busqueda-resultados");
    contenedor.innerHTML = '<p style="color:#888;padding:12px 0">Buscando...</p>';
    try {
        const res = await fetch(`${API}/estudiantes/buscar?${params.toString()}`);
        let data = await res.json();
        if (!res.ok) {
            contenedor.innerHTML = '<p class="empty-row">Error del servidor: ' + (data.detalle || data.error || res.status) + '</p>';
            return;
        }
        if (!Array.isArray(data)) { contenedor.innerHTML = '<p class="empty-row">No se encontraron estudiantes.</p>'; return; }

        if (rol === 'docente') {
            if (!mostrarTodosEstudiantes && aulaSeleccionada) {
                data = data.filter(e => String(e.aula_id) === String(aulaSeleccionada.id));
            } else if (mostrarTodosEstudiantes) {
                const misAulaIds = aulasDocente.map(a => String(a.id));
                data = data.filter(e => misAulaIds.includes(String(e.aula_id)));
            }
        }

        if (data.length === 0) {
            contenedor.innerHTML = '<p class="empty-row">No se encontraron estudiantes.</p>';
            return;
        }

        contenedor.innerHTML = `
            <p style="color:#888;font-size:13px;margin-bottom:12px">${data.length} estudiante(s) encontrado(s)</p>
            <div style="overflow-x:auto">
            <table class="data-table">
                <thead><tr>
                    <th>#</th><th>Nombre</th><th>Matricula</th><th>Cedula</th>
                    <th>Grado</th><th>Seccion</th><th>Accion</th>
                </tr></thead>
                <tbody>
                    ${data.map(function(e, i) {
                        return `<tr>
                            <td>${i + 1}</td>
                            <td><strong>${e.nombre}</strong></td>
                            <td>${e.matricula}</td>
                            <td>${e.cedula || "—"}</td>
                            <td>${e.grado}</td>
                            <td>${e.seccion || "—"}</td>
                            <td><button onclick="mostrarFichaEstudiante(${e.id})" class="btn-ver-ficha">Ver Ficha</button></td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
            </div>`;
    } catch (err) {
        contenedor.innerHTML = '<p class="empty-row">Error al buscar: ' + err.message + '</p>';
    }
}

function limpiarBusqueda() {
    document.getElementById("busqueda-input").value = "";
    document.getElementById("ficha-contenedor").innerHTML = "";
    const rol = localStorage.getItem('userRol') || (usuarioActual && usuarioActual.rol);
    if (rol !== 'docente') {
        document.getElementById("filtro-grado").value   = "";
        document.getElementById("filtro-seccion").value = "";
    } else {
        mostrarTodosEstudiantes = false;
        actualizarBannerDocente();
    }
    buscarEstudiantes();
}

async function mostrarFichaEstudiante(id) {
    fichaActualId = id;
    const contenedor = document.getElementById("ficha-contenedor");
    contenedor.innerHTML = '<div class="panel" style="padding:24px"><p style="color:#888">Cargando ficha...</p></div>';
    contenedor.scrollIntoView({ behavior:"smooth", block:"start" });
    try {
        const res  = await fetch(`${API}/estudiantes/${id}/ficha`);
        const data = await res.json();
        if (!res.ok) { contenedor.innerHTML = ""; return; }

        const e       = data.estudiante;
        const califs  = data.calificaciones;
        const asist   = data.asistencia;
        const parts   = data.participaciones;
        const promedio = data.promedio_general;

        const fechaNac = parseFechaMySQL(e.fecha_nacimiento);
        let edad = "";
        if (fechaNac) {
            const anos = Math.floor((Date.now() - fechaNac.getTime()) / (365.25 * 86400000));
            edad = " (" + anos + " años)";
        }

        const pNum  = parseFloat(promedio);
        const pColor = pNum >= 90 ? "#2e7d32" : pNum >= 70 ? "#1565c0" : pNum >= 60 ? "#e65100" : "#c62828";

        const califsHTML = califs.length === 0
            ? '<p class="empty-row">Sin calificaciones registradas.</p>'
            : '<div style="overflow-x:auto"><table class="data-table">'
              + '<thead><tr><th>Asignatura</th><th>P1</th><th>P2</th><th>P3</th><th>P4</th><th>Promedio</th><th>Estado</th></tr></thead><tbody>'
              + califs.map(function(c) {
                    const prom    = parseFloat(c.promedio);
                    const estado = isNaN(prom) ? "—" : prom >= 70
                        ? '<span style="color:#2e7d32;font-weight:700">Aprobado</span>'
                        : '<span style="color:#c62828;font-weight:700">Pendiente</span>';
                    return '<tr><td><strong>' + c.asignatura + '</strong></td><td>' + (c.nota1 != null ? c.nota1 : "—")
                        + '</td><td>' + (c.nota2 != null ? c.nota2 : "—")
                        + '</td><td>' + (c.nota3 != null ? c.nota3 : "—")
                        + '</td><td>' + (c.nota4 != null ? c.nota4 : "—") + '</td><td><strong>' + (c.promedio != null ? c.promedio : "—") + '</strong></td><td>' + estado + '</td></tr>';
                }).join("")
              + '</tbody></table></div>';

        const estadosColor = { presente:"#2e7d32", ausente:"#c62828", tardanza:"#e65100", excusa:"#6a1b9a" };
        const asistDetalle = asist.detalle.length === 0
            ? '<p class="empty-row">Sin registros de asistencia.</p>'
            : '<div style="overflow-x:auto"><table class="data-table">'
              + '<thead><tr><th>Fecha</th><th>Estado</th><th>Observacion</th></tr></thead><tbody>'
              + asist.detalle.map(function(a) {
                    const color = estadosColor[a.estado] || "#333";
                    const fecha = new Date(a.fecha + "T00:00:00").toLocaleDateString("es-DO", { year:"numeric", month:"short", day:"numeric" });
                    return '<tr><td>' + fecha + '</td><td><span style="color:' + color + ';font-weight:700;text-transform:capitalize">'
                        + a.estado + '</span></td><td>' + (a.observacion || "—") + '</td></tr>';
                }).join("")
              + '</tbody></table></div>';

        const avgPart = data.promedio_participacion;
        const partsHTML = parts.length === 0
            ? '<p style="color:#aaa;font-size:13px;margin-top:8px">Sin participaciones registradas.</p>'
            : '<div class="participaciones-lista">'
              + parts.map(function(p) {
                    const fecha = new Date(p.fecha + "T00:00:00").toLocaleDateString("es-DO", { year:"numeric", month:"short", day:"numeric" });
                    const score = p.puntuacion > 0 ? '<span class="part-score-badge">' + p.puntuacion + '/5</span>' : '';
                    const texto = p.observacion || p.descripcion || "Participación registrada";
                    return '<div class="participacion-item"><div><span class="part-fecha">' + fecha + '</span>' + score + '</div><div class="part-desc">' + texto + '</div></div>';
                }).join("")
              + '</div>';

        const hoyStr = new Date().toISOString().split("T")[0];
        const fnac = fechaNac
            ? fechaNac.toLocaleDateString("es-DO", { year:"numeric", month:"long", day:"numeric" }) + edad
            : "—";
        const totalAsist = asist.stats.presente + asist.stats.ausente + asist.stats.tardanza + asist.stats.excusa;
        const anioEscolar = e.anio_escolar || "";

        contenedor.innerHTML = `
            <div class="ficha-estudiante">
                <div class="ficha-header">
                    <div class="ficha-avatar">${e.nombre.charAt(0).toUpperCase()}</div>
                    <div class="ficha-header-info">
                        <h2 class="ficha-nombre">${e.nombre}</h2>
                        <div class="ficha-tags">
                            <span class="ficha-tag">Mat: ${e.matricula}</span>
                            <span class="ficha-tag">${e.grado}${e.seccion ? ' "' + e.seccion + '"' : ""}</span>
                            ${anioEscolar ? '<span class="ficha-tag">' + anioEscolar + '</span>' : ""}
                            ${avgPart !== null ? '<span class="ficha-tag">Participación: ' + avgPart + '</span>' : ""}
                        </div>
                    </div>
                    ${promedio !== null ? `<div class="ficha-promedio-badge" style="border-color:${pColor};color:${pColor}">
                        <span class="ficha-promedio-num">${promedio}</span>
                        <span class="ficha-promedio-label">Promedio General</span>
                    </div>` : ""}
                </div>

                <div class="ficha-grid-2">
                    <div class="ficha-section">
                        <h4 class="ficha-section-title">Datos Personales</h4>
                        <div class="ficha-campo"><span>Cedula:</span><strong>${e.cedula || "—"}</strong></div>
                        <div class="ficha-campo"><span>Nacimiento:</span><strong>${fnac}</strong></div>
                        <div class="ficha-campo"><span>Sexo:</span><strong>${e.sexo === "M" ? "Masculino" : e.sexo === "F" ? "Femenino" : "—"}</strong></div>
                        <div class="ficha-campo"><span>Direccion:</span><strong>${e.direccion || "—"}</strong></div>
                        ${e.observaciones ? '<div class="ficha-campo"><span>Observaciones:</span><strong>' + e.observaciones + '</strong></div>' : ""}
                    </div>
                    <div class="ficha-section">
                        <h4 class="ficha-section-title">Tutor Responsable</h4>
                        <div class="ficha-campo"><span>Nombre:</span><strong>${e.tutor || "—"}</strong></div>
                        <div class="ficha-campo"><span>Telefono:</span><strong>${e.telefono || "—"}</strong></div>
                        <div class="ficha-campo"><span>Parentesco:</span><strong>${e.parentesco_tutor || "—"}</strong></div>
                    </div>
                </div>

                <div class="ficha-section">
                    <h4 class="ficha-section-title">Asistencia (${totalAsist} dias registrados)</h4>
                    <div class="asist-stats">
                        <div class="asist-stat asist-presente"><strong>${asist.stats.presente}</strong><span>Presente</span></div>
                        <div class="asist-stat asist-ausente"><strong>${asist.stats.ausente}</strong><span>Ausente</span></div>
                        <div class="asist-stat asist-tardanza"><strong>${asist.stats.tardanza}</strong><span>Tardanza</span></div>
                        <div class="asist-stat asist-excusa"><strong>${asist.stats.excusa}</strong><span>Excusa</span></div>
                    </div>
                    <div style="margin-top:16px">
                        <p style="font-size:13px;color:#888;margin-bottom:10px">Ultimos 10 registros:</p>
                        ${asistDetalle}
                    </div>
                </div>

                <div class="ficha-section">
                    <h4 class="ficha-section-title">Calificaciones por Asignatura</h4>
                    ${califsHTML}
                </div>

                <div class="ficha-section">
                    <h4 class="ficha-section-title">Participaciones Diarias</h4>
                    <div class="participacion-form">
                        <input type="date" id="part-fecha" value="${hoyStr}" class="part-input">
                        <select id="part-score" class="part-input" style="width:120px">
                            <option value="">Puntaje</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                        <input type="text" id="part-desc" placeholder="Descripción de la participación..." class="part-input part-input-flex">
                        <button onclick="agregarParticipacion(${e.id})" class="btn-primary" style="padding:10px 18px;font-size:13px;white-space:nowrap;width:auto">+ Agregar</button>
                    </div>
                    <div id="participaciones-lista-${e.id}">${partsHTML}</div>
                </div>

                <div class="ficha-section" style="background:#f9f9f9;border-top:2px solid #0d2352;padding-top:20px">
                    <h4 class="ficha-section-title">Boletín Estudiantil</h4>
                    <div style="display:flex;gap:12px;flex-wrap:wrap">
                        <button onclick="exportarBoletin('pdf',${e.id})"
                            style="background:#0d2352;color:#fff;padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;flex:1;min-width:150px">
                            📄 Descargar Boletín PDF
                        </button>
                        <button onclick="exportarBoletin('excel',${e.id})"
                            style="background:#1565c0;color:#fff;padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;flex:1;min-width:150px">
                            📊 Descargar Boletín Excel
                        </button>
                    </div>
                </div>
            </div>`;

    } catch (err) {
        contenedor.innerHTML = '<div class="panel"><p class="empty-row">Error al cargar ficha del estudiante.</p></div>';
        console.error("Error ficha:", err);
    }
}

async function agregarParticipacion(estudianteId) {
    const fecha       = document.getElementById("part-fecha").value;
    const puntuacion  = parseInt(document.getElementById("part-score").value || "", 10);
    const observacion = document.getElementById("part-desc").value.trim();
    if (!fecha) { showToast("Seleccione una fecha.", "warning"); return; }
    try {
        const res = await fetch(`${API}/participaciones`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({
                estudiante_id: estudianteId,
                fecha,
                puntuacion: isNaN(puntuacion) ? 0 : puntuacion,
                observacion
            })
        });
        if (!res.ok) { showToast("Error al guardar participacion.", "error"); return; }
        document.getElementById("part-desc").value = "";
        document.getElementById("part-score").value = "";
        mostrarFichaEstudiante(estudianteId);
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
}

// =============================================
//  AULAS
// =============================================

async function cargarMaestrosDropdown() {
    try {
        const res = await fetch(`${API}/maestros`);
        const data = await res.json();
        if (!res.ok) return;
        maestrosCache = data;
        const select = document.getElementById("aula-maestro-guia");
        if (!select) return;
        select.innerHTML = '<option value="">-- Sin asignar --</option>' +
            data.map(m => `<option value="${m.id}">${m.nombre} ${m.rol ? `(${m.rol})` : ''}</option>`).join("");
    } catch (err) { console.error("Error cargando maestros:", err); }
}

async function cargarTablaAulas() {
    try {
        const res = await fetch(`${API}/aulas`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) return;

        aulasCache = data;
        const tbody = document.getElementById("tablaAulas");
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay aulas registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((a, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${a.aula_numero || 'Aula ' + a.grado + '-' + a.seccion}</strong></td>
                <td>${a.grado}</td>
                <td>${a.seccion}</td>
                <td>${a.capacidad}</td>
                <td>${a.nombre_maestro || '—'}</td>
                <td><span style="background:#e3f2fd;color:#1565c0;padding:4px 8px;border-radius:4px;font-weight:600;font-size:12px">${a.estudiantes_count || 0}</span></td>
                <td style="white-space:nowrap;font-size:12px">
                    <button onclick="verDetalleAula(${a.id})" style="background:#1565c0;color:#fff;padding:5px 10px;border:none;border-radius:4px;cursor:pointer;margin-right:4px">Ver</button>
                    <button onclick="editarAula(${a.id})" style="background:#2e7d32;color:#fff;padding:5px 10px;border:none;border-radius:4px;cursor:pointer;margin-right:4px">Editar</button>
                    <button onclick="eliminarAula(${a.id},'${(a.aula_numero || '').replace(/'/g, "\\'")}')" style="background:#c62828;color:#fff;padding:5px 10px;border:none;border-radius:4px;cursor:pointer">Eliminar</button>
                </td>
            </tr>`).join("");
    } catch (err) { console.error("Error:", err); }
}

document.getElementById("formAula")?.addEventListener("submit", async function(e) {
    e.preventDefault();

    const maestroValue = document.getElementById("aula-maestro-guia").value;
    const grado = document.getElementById("aula-grado").value;
    const seccion = document.getElementById("aula-seccion").value;
    const anioEscolar = document.getElementById("cfg-anio")?.value.trim() || null;

    if (!grado || !seccion) {
        showToast("Grado y sección son obligatorios.", "warning");
        return;
    }

    const maestroGuiaId = maestroValue && maestroValue !== "undefined" ? parseInt(maestroValue, 10) : null;
    const datos = {
        aula_numero: document.getElementById("aula-numero").value.trim(),
        grado,
        seccion,
        capacidad: parseInt(document.getElementById("aula-capacidad").value, 10) || 35,
        maestro_guia_id: Number.isNaN(maestroGuiaId) ? null : maestroGuiaId,
        anio_escolar: anioEscolar
    };

    try {
        const url = editandoAulaId ? `${API}/aulas/${editandoAulaId}` : `${API}/aulas`;
        const method = editandoAulaId ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(datos)
        });
        const data = await res.json();

        if (!res.ok) { showToast(data.error || "Error al guardar aula.", "error"); return; }

        this.reset();
        cancelarEdicionAula();

        const msg = document.getElementById("msgAula");
        if (msg) {
            msg.textContent = "Aula guardada exitosamente.";
            msg.style.display = "block";
            setTimeout(() => msg.style.display = "none", 3000);
        }

        cargarTablaAulas();
    } catch (err) { showToast("No se pudo conectar al servidor.", "error"); }
});

async function editarAula(id) {
    const aula = aulasCache.find(a => a.id === id);
    if (!aula) return;

    await cargarMaestrosDropdown();

    editandoAulaId = id;
    document.getElementById("aula-numero").value = aula.aula_numero || "";
    document.getElementById("aula-grado").value = aula.grado;
    document.getElementById("aula-seccion").value = aula.seccion;
    document.getElementById("aula-capacidad").value = aula.capacidad;
    document.getElementById("aula-maestro-guia").value = aula.maestro_guia_id || "";

    document.getElementById("btnSubmitAula").textContent = "Actualizar Aula";
    document.getElementById("btnCancelarAula").style.display = "inline-block";
    document.querySelector("#sec-aulas .panel-title").textContent = "🏫 Editar Aula";

    document.getElementById("aula-numero").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionAula() {
    editandoAulaId = null;
    document.getElementById("formAula").reset();
    document.getElementById("btnSubmitAula").textContent = "Guardar Aula";
    document.getElementById("btnCancelarAula").style.display = "none";
    document.querySelector("#sec-aulas .panel-title").textContent = "🏫 Gestión de Aulas";
}

document.getElementById("btnCancelarAula")?.addEventListener("click", cancelarEdicionAula);

async function eliminarAula(id, nombre) {
    showConfirm(`¿Está seguro que desea eliminar el aula "${nombre}"?`, () => {
        fetch(`${API}/aulas/${id}`, { method: "DELETE" })
        .then(res => { if (!res.ok) { showToast("Error al eliminar.", "error"); return; }
        cargarTablaAulas(); })
        .catch(err => { showToast("No se pudo conectar.", "error"); });
    }, () => {});
    return;
    try {
        const res = await fetch(`${API}/aulas/${id}`, { method: "DELETE" });
        if (!res.ok) { showToast("Error al eliminar.", "error"); return; }
        cargarTablaAulas();
    } catch (err) { showToast("No se pudo conectar.", "error"); }
}

async function verDetalleAula(aulaId) {
    const contenedor = document.getElementById("detalleAulaContenedor");
    contenedor.innerHTML = '<div class="panel"><p style="color:#888">Cargando detalle...</p></div>';

    try {
        const aula = aulasCache.find(a => a.id === aulaId);
        if (!aula) return;

        const [resEst, resAsign, resMaestros] = await Promise.all([
            fetch(`${API}/estudiantes`),
            fetch(`${API}/asignaciones/aula/${aulaId}`),
            fetch(`${API}/maestros/para-asignaciones`)
        ]);
        const todosEstudiantes = await resEst.json();
        const estudiantes = todosEstudiantes.filter(e => e.aula_id === aulaId && e.activo === 1);
        const asignaciones = await resAsign.json();
        const maestrosLista = resMaestros.ok ? await resMaestros.json() : [];
        const opcionesMaestros = maestrosLista.map(m =>
            `<option value="${m.id}">${m.nombre}${m.especialidad ? ' — ' + m.especialidad : ''}</option>`
        ).join("");

        let html = `
            <div class="ficha-estudiante" style="margin-top:20px;background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
                <div class="ficha-header" style="background:linear-gradient(135deg,#0d2352,#1565c0);padding:28px 32px;display:flex;align-items:center;gap:20px;color:#fff;border-radius:12px 12px 0 0">
                    <div style="width:68px;height:68px;background:rgba(255,255,255,0.18);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;border:2px solid rgba(255,255,255,0.35)">🏫</div>
                    <div>
                        <h2 style="margin:0;font-size:24px;font-weight:700">${aula.aula_numero || aula.grado + '-' + aula.seccion}</h2>
                        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                            <span style="background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:4px;font-size:12px">Grado: ${aula.grado}</span>
                            <span style="background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:4px;font-size:12px">Sección: ${aula.seccion}</span>
                            <span style="background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:4px;font-size:12px">Capacidad: ${aula.capacidad}</span>
                        </div>
                    </div>
                </div>

                <div style="padding:24px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
                        <div>
                            <h4 style="font-size:13px;font-weight:700;color:#0d2352;text-transform:uppercase;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #f0f4fa">Información</h4>
                            <div style="margin:8px 0"><span style="color:#888">Maestro Guía:</span> <strong>${aula.nombre_maestro || 'Sin asignar'}</strong></div>
                            <div style="margin:8px 0"><span style="color:#888">Estudiantes:</span> <strong>${estudiantes.length}/${aula.capacidad}</strong></div>
                        </div>
                    </div>

                    <div>
                        <h4 style="font-size:13px;font-weight:700;color:#0d2352;text-transform:uppercase;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #f0f4fa">Estudiantes (${estudiantes.length})</h4>
                        ${estudiantes.length === 0 ? '<p style="color:#888">Sin estudiantes asignados.</p>' : `
                            <table class="data-table" style="margin-top:12px">
                                <thead><tr><th>#</th><th>Nombre</th><th>Matrícula</th><th>Cedula</th></tr></thead>
                                <tbody>
                                    ${estudiantes.map((e, i) => `<tr><td>${i+1}</td><td>${e.nombre}</td><td>${e.matricula}</td><td>${e.cedula||'—'}</td></tr>`).join("")}
                                </tbody>
                            </table>`}
                    </div>

                    <div style="margin-top:24px">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                            <h4 style="font-size:13px;font-weight:700;color:#0d2352;text-transform:uppercase;margin:0;padding-bottom:8px;border-bottom:2px solid #f0f4fa;flex:1">Asignaturas y Maestros</h4>
                        </div>
                        <div style="background:#f0f4fa;border-radius:8px;padding:14px;margin-bottom:14px">
                            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
                                <div style="flex:1;min-width:150px">
                                    <label style="font-size:11px;font-weight:700;color:#0d2352;display:block;margin-bottom:4px;text-transform:uppercase">Materia</label>
                                    <input type="text" id="input-asignatura-${aulaId}" placeholder="Ej: Matemáticas" style="width:100%;padding:8px 10px;border:1px solid #c5d3e8;border-radius:6px;font-size:13px;box-sizing:border-box">
                                </div>
                                <div style="flex:1;min-width:180px">
                                    <label style="font-size:11px;font-weight:700;color:#0d2352;display:block;margin-bottom:4px;text-transform:uppercase">Maestro</label>
                                    <select id="sel-maestro-${aulaId}" style="width:100%;padding:8px 10px;border:1px solid #c5d3e8;border-radius:6px;font-size:13px;background:#fff;box-sizing:border-box">
                                        <option value="">Seleccione maestro</option>
                                        ${opcionesMaestros}
                                    </select>
                                </div>
                                <button onclick="agregarAsignacionInline(${aulaId})" style="background:linear-gradient(135deg,#0d47a1,#1976d2);color:#fff;border:none;padding:9px 18px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;flex-shrink:0">+ Agregar</button>
                            </div>
                        </div>
                        ${asignaciones.length === 0 ? '<p style="color:#888">Sin asignaciones registradas.</p>' : `
                            <table class="data-table">
                                <thead><tr><th>Asignatura</th><th>Maestro</th><th>Especialidad</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    ${asignaciones.map(a => `<tr>
                                        <td><strong>${a.asignatura}</strong></td>
                                        <td>${a.nombre_maestro}</td>
                                        <td>${a.especialidad || '—'}</td>
                                        <td><button onclick="eliminarAsignacion(${a.id},${aulaId})" style="background:#c62828;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">Quitar</button></td>
                                    </tr>`).join("")}
                                </tbody>
                            </table>`}
                    </div>
                </div>
            </div>`;

        contenedor.innerHTML = html;
        contenedor.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
        contenedor.innerHTML = '<div class="panel"><p style="color:#888">Error al cargar detalle.</p></div>';
    }
}

async function agregarAsignacionInline(aulaId) {
    const asignatura = (document.getElementById(`input-asignatura-${aulaId}`) || {}).value || "";
    const maestroId  = (document.getElementById(`sel-maestro-${aulaId}`)    || {}).value || "";

    if (!asignatura.trim()) { showToast("Ingrese el nombre de la materia.", "error"); return; }
    if (!maestroId)         { showToast("Seleccione un maestro.", "error"); return; }

    try {
        const res = await fetch(`${API}/asignaciones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aula_id: aulaId, asignatura: asignatura.trim(), maestro_id: parseInt(maestroId) })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Error al asignar.", "error"); return; }
        showToast("Asignación agregada.", "success");
        verDetalleAula(aulaId);
    } catch (err) { showToast("Error de conexión.", "error"); }
}

async function eliminarAsignacion(id, aulaId) {
    showConfirm("¿Está seguro que desea quitar esta asignación?", () => {
        fetch(`${API}/asignaciones/${id}`, { method: "DELETE" })
        .then(res => { if (!res.ok) { showToast("Error.", "error"); return; }
        verDetalleAula(aulaId); })
        .catch(err => { showToast("Error de conexión.", "error"); });
    }, () => {});
    return;
    try {
        const res = await fetch(`${API}/asignaciones/${id}`, { method: "DELETE" });
        if (!res.ok) { showToast("Error.", "error"); return; }
        verDetalleAula(aulaId);
    } catch (err) { showToast("Error de conexión.", "error"); }
}

// Listener para el nav item Aulas
document.querySelector('[data-section="aulas"]')?.addEventListener("click", function(e) {
    e.preventDefault();
    mostrarSeccion("aulas");
    cargarMaestrosDropdown();
    cargarTablaAulas();
});

// =============================================
//  SELECCIÓN DE AULA (DOCENTES)
// =============================================

async function cargarAulasDocente(usuarioId) {
    try {
        const res = await fetch(`${API}/docente/mis-aulas?usuario_id=${usuarioId}`);
        const data = await res.json();
        aulasDocente = Array.isArray(data) ? data : [];
    } catch (err) {
        aulasDocente = [];
        console.error("Error cargando aulas del docente:", err);
    }
}

function mostrarSeleccionAula() {
    irPanelPrincipal();
}

function irPanelPrincipal() {
    mostrarSeccion("inicio");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelector('[data-section="inicio"]')?.classList.add("active");
}

function renderizarPanelDocente() {
    const grid = document.getElementById("aulasGridInicio");
    if (!grid) return;

    const nombre = usuarioActual?.nombre || document.getElementById("userNameDisplay").textContent || "Docente";
    const titulo = document.getElementById("panelDocenteTitulo");
    if (titulo) titulo.textContent = `Bienvenido/a, ${nombre}`;

    if (aulasDocente.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px">
                <p style="font-size:48px;margin-bottom:16px">🏫</p>
                <p style="color:#555;font-size:18px;font-weight:600;margin-bottom:8px">Sin aulas asignadas</p>
                <p style="color:#888;font-size:14px">No tienes aulas asignadas en este momento.<br>Contacta al administrador del centro.</p>
            </div>`;
        return;
    }

    grid.innerHTML = aulasDocente.map(aula => `
        <div class="aula-card">
            <div class="aula-card-icon">🏫</div>
            <div class="aula-card-grado">${aula.grado}</div>
            <div class="aula-card-seccion">Sección ${aula.seccion}</div>
            <div class="aula-card-nombre">${aula.aula_numero || aula.grado + ' - ' + aula.seccion}</div>
            <div class="aula-card-estudiantes">${aula.cantidad_estudiantes || 0} estudiantes</div>
            <button onclick="seleccionarAula(${aula.id})" style="margin-top:16px;padding:10px 0;background:#1565c0;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;width:100%">Entrar</button>
        </div>
    `).join("");
}

function actualizarBannerDocente() {
    const banner = document.getElementById("docente-busqueda-banner");
    const btnVer = document.getElementById("btnVerTodosEstudiantes");
    const info = document.getElementById("docente-busqueda-info");
    if (!banner) return;
    if (aulaSeleccionada) {
        banner.style.display = 'flex';
        const nombre = aulaSeleccionada.aula_numero || (aulaSeleccionada.grado + ' ' + aulaSeleccionada.seccion);
        if (mostrarTodosEstudiantes) {
            if (info) info.textContent = 'Mostrando todos mis estudiantes';
            if (btnVer) btnVer.textContent = 'Ver aula activa';
        } else {
            if (info) info.textContent = `Mostrando estudiantes de: ${nombre}`;
            if (btnVer) btnVer.textContent = 'Ver mis estudiantes';
        }
    } else {
        banner.style.display = 'none';
    }
}

function toggleVerTodosEstudiantes() {
    mostrarTodosEstudiantes = !mostrarTodosEstudiantes;
    actualizarBannerDocente();
    buscarEstudiantes();
}

function seleccionarAula(aulaId) {
    aulaSeleccionada = aulasDocente.find(a => a.id === aulaId) || null;
    if (!aulaSeleccionada) return;

    localStorage.setItem('aulaSeleccionadaId', String(aulaId));

    const badge = document.getElementById("aulaActivaBadge");
    const aulaActivaNombre = document.getElementById("aulaActivaNombre");
    if (badge && aulaActivaNombre) {
        aulaActivaNombre.textContent = aulaSeleccionada.aula_numero || `${aulaSeleccionada.grado} ${aulaSeleccionada.seccion}`;
        badge.style.display = "inline-flex";
    }

    mostrarSeccion("asistencia");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelector('[data-section="asistencia"]')?.classList.add("active");
    showToast(`Aula ${aulaSeleccionada.aula_numero || aulaSeleccionada.grado + ' ' + aulaSeleccionada.seccion} seleccionada`, "success");
}