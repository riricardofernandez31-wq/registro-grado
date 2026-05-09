// =============================================
//  REGISTRO DE GRADO - FRONTEND CON BACKEND
//  script.js
// =============================================

const API = "https://registro-grado-production.up.railway.app/api";
let usuarioActual    = null;
let estudiantesCache = [];
let editandoEstudianteId = null;

function parseFechaMySQL(fecha) {
    if (!fecha) return null;
    const s = String(fecha).substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
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
        document.getElementById("userNameDisplay").textContent = data.usuario.nombre;
        document.getElementById("userRolBadge").textContent    = formatRol(data.usuario.rol);
        document.getElementById("loginContainer").style.display = "none";
        document.getElementById("dashboard").style.display      = "flex";
        aplicarPermisos(data.usuario.rol);
        cargarNombreCentro();
        mostrarSeccion("inicio");

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
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    const sec = document.getElementById("sec-" + nombre);
    if (sec) sec.classList.add("active");

    const titulos = {
        inicio:"Panel Principal", estudiantes:"Registro de Estudiantes",
        busqueda:"Buscador Avanzado",
        calificaciones:"Registro de Calificaciones", asistencia:"Control de Asistencia",
        reportes:"Reportes Academicos", usuarios:"Gestion de Usuarios",
        configuracion:"Configuracion Institucional"
    };
    document.getElementById("sectionTitle").textContent = titulos[nombre] || "";

    if (nombre === "inicio")         cargarDashboard();
    if (nombre === "estudiantes")    cargarTablaEstudiantes();
    if (nombre === "busqueda")       iniciarBusqueda();
    if (nombre === "calificaciones") cargarSelectEstudiantes();
    if (nombre === "asistencia")     cargarAsistencia();
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
        document.getElementById("totalEstudiantes").textContent = data.length;
        const tbody     = document.getElementById("tablaRecientes");
        const recientes = data.slice(0, 5);
        if (recientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No hay estudiantes registrados aun.</td></tr>';
            return;
        }
        tbody.innerHTML = recientes.map(e =>
            `<tr><td>${e.nombre}</td><td>${e.matricula}</td><td>${e.grado}</td><td>${e.seccion||"—"}</td></tr>`
        ).join("");
    } catch (err) { console.error("Error dashboard:", err); }
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
        if (!res.ok) { alert(data.error || "Error al guardar."); return; }
        cancelarEdicionEstudiante();
        this.reset();
        const msg = document.getElementById("msgEstudiante");
        msg.textContent   = editandoEstudianteId ? "Estudiante actualizado exitosamente." : "Estudiante guardado exitosamente.";
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarTablaEstudiantes();
    } catch (err) { alert("No se pudo conectar al servidor."); }
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
    if (!confirm(`Eliminar al estudiante "${nombre}"? Esta accion no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API}/estudiantes/${id}`, { method:"DELETE" });
        if (!res.ok) { alert("Error al eliminar."); return; }
        cargarTablaEstudiantes();
    } catch (err) { alert("No se pudo conectar al servidor."); }
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
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No hay estudiantes registrados.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(e => `
            <tr>
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
        const select = document.getElementById("cal-estudiante");
        select.innerHTML = '<option value="">Seleccione estudiante</option>';
        data.forEach(function(est) {
            const opt = document.createElement("option");
            opt.value       = est.id;
            opt.textContent = `${est.nombre} (${est.grado}${est.seccion ? " - "+est.seccion : ""})`;
            select.appendChild(opt);
        });
        cargarTablaCalificaciones();
    } catch (err) { console.error("Error select:", err); }
}

["cal-p1","cal-p2"].forEach(function(id) {
    document.getElementById(id).addEventListener("input", function() {
        const p1 = parseFloat(document.getElementById("cal-p1").value) || 0;
        const p2 = parseFloat(document.getElementById("cal-p2").value) || 0;
        if (p1 > 0 || p2 > 0)
            document.getElementById("cal-final").value = ((p1+p2)/2).toFixed(1);
    });
});

document.getElementById("formCalificaciones").addEventListener("submit", async function(e) {
    e.preventDefault();
    const datos = {
        estudiante_id: document.getElementById("cal-estudiante").value,
        asignatura:    document.getElementById("cal-asignatura").value,
        competencia:   document.getElementById("cal-competencia").value.trim(),
        parcial_1:     document.getElementById("cal-p1").value || null,
        parcial_2:     document.getElementById("cal-p2").value || null,
        final:         document.getElementById("cal-final").value || null,
        observaciones: document.getElementById("cal-obs").value.trim()
    };
    try {
        const res  = await fetch(`${API}/calificaciones`, {
            method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(datos)
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || "Error al guardar."); return; }
        this.reset();
        const msg = document.getElementById("msgCalificacion");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarTablaCalificaciones();
    } catch (err) { alert("No se pudo conectar al servidor."); }
});

async function cargarTablaCalificaciones() {
    try {
        const res  = await fetch(`${API}/calificaciones`);
        const data = await res.json();
        const tbody = document.getElementById("tablaCalificaciones");
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No hay calificaciones registradas.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(c =>
            `<tr><td>${c.nombre_estudiante}</td><td>${c.asignatura}</td><td>${c.parcial_1??'—'}</td><td>${c.parcial_2??'—'}</td><td><strong>${c.final??'—'}</strong></td></tr>`
        ).join("");
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
        const res  = await fetch(`${API}/estudiantes`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) return;
        estudiantesCache = data;
        const contenedor = document.getElementById("listaAsistencia");
        if (data.length === 0) {
            contenedor.innerHTML = '<p class="empty-row">Registre estudiantes primero.</p>';
            return;
        }
        contenedor.innerHTML = data.map(est => `
            <div class="asistencia-row">
                <span class="asistencia-nombre">${est.nombre}</span>
                <label><input type="radio" name="as-${est.id}" value="presente" checked> Presente</label>
                <label><input type="radio" name="as-${est.id}" value="ausente"> Ausente</label>
                <label><input type="radio" name="as-${est.id}" value="tardanza"> Tardanza</label>
                <label><input type="radio" name="as-${est.id}" value="excusa"> Excusa</label>
            </div>`).join("");
    } catch (err) { console.error("Error asistencia:", err); }
}

document.getElementById("btnGuardarAsistencia").addEventListener("click", async function() {
    if (estudiantesCache.length === 0) return;
    const fechaHoy  = hoy.toISOString().split("T")[0];
    const registros = estudiantesCache.map(function(est) {
        const sel = document.querySelector(`input[name="as-${est.id}"]:checked`);
        return { estudiante_id:est.id, fecha:fechaHoy, estado:sel?sel.value:"presente", observacion:"" };
    });
    try {
        const res = await fetch(`${API}/asistencia`, {
            method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({registros})
        });
        if (!res.ok) { alert("Error al guardar asistencia."); return; }
        const msg = document.getElementById("msgAsistencia");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
    } catch (err) { alert("No se pudo conectar al servidor."); }
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
            columnas = ["Estudiante","Asignatura","Parcial 1","Parcial 2","Final"];
            filas = data.map(c =>
                `<tr><td>${c.nombre_estudiante}</td><td>${c.asignatura}</td><td>${c.parcial_1??'—'}</td><td>${c.parcial_2??'—'}</td><td><strong>${c.final??'—'}</strong></td></tr>`
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
        if (!res.ok) { alert(data.error || "Error al crear usuario."); return; }
        this.reset();
        const msg = document.getElementById("msgUsuario");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarTablaUsuarios();
    } catch (err) { alert("No se pudo conectar al servidor."); }
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
    if (!confirm(`Eliminar al usuario "${nombre}"? Esta accion no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API}/usuarios/${id}`, { method:"DELETE" });
        if (!res.ok) { alert("Error al eliminar."); return; }
        cargarTablaUsuarios();
    } catch (err) { alert("No se pudo conectar al servidor."); }
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
        if (!res.ok) { alert(data.error || "Error al guardar."); return; }
        const msg = document.getElementById("msgConfiguracion");
        msg.style.display = "block";
        setTimeout(() => msg.style.display = "none", 3000);
        cargarNombreCentro();
    } catch (err) { alert("No se pudo conectar al servidor."); }
});

// =============================================
//  BUSQUEDA AVANZADA
// =============================================
let busquedaTimeout     = null;
let fichaActualId       = null;
let busquedaInicializada = false;

function iniciarBusqueda() {
    if (busquedaInicializada) { buscarEstudiantes(); return; }
    busquedaInicializada = true;
    document.getElementById("busqueda-input").addEventListener("input", function() {
        clearTimeout(busquedaTimeout);
        busquedaTimeout = setTimeout(buscarEstudiantes, 350);
    });
    document.getElementById("filtro-grado").addEventListener("change", buscarEstudiantes);
    document.getElementById("filtro-seccion").addEventListener("change", buscarEstudiantes);
    buscarEstudiantes();
}

async function buscarEstudiantes() {
    const q       = document.getElementById("busqueda-input").value.trim();
    const grado   = document.getElementById("filtro-grado").value;
    const seccion = document.getElementById("filtro-seccion").value;
    const params  = new URLSearchParams();
    if (q)       params.set("q", q);
    if (grado)   params.set("grado", grado);
    if (seccion) params.set("seccion", seccion);

    const contenedor = document.getElementById("busqueda-resultados");
    contenedor.innerHTML = '<p style="color:#888;padding:12px 0">Buscando...</p>';
    try {
        const res  = await fetch(`${API}/estudiantes/buscar?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
            contenedor.innerHTML = '<p class="empty-row">Error del servidor: ' + (data.detalle || data.error || res.status) + '</p>';
            return;
        }
        if (!Array.isArray(data) || data.length === 0) {
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
                    ${data.map(function(e, i) { return `<tr>
                        <td>${i + 1}</td>
                        <td><strong>${e.nombre}</strong></td>
                        <td>${e.matricula}</td>
                        <td>${e.cedula || "—"}</td>
                        <td>${e.grado}</td>
                        <td>${e.seccion || "—"}</td>
                        <td><button onclick="mostrarFichaEstudiante(${e.id})" class="btn-ver-ficha">Ver Ficha</button></td>
                    </tr>`; }).join("")}
                </tbody>
            </table>
            </div>`;
    } catch (err) {
        contenedor.innerHTML = '<p class="empty-row">Error al buscar: ' + err.message + '</p>';
    }
}

function limpiarBusqueda() {
    document.getElementById("busqueda-input").value  = "";
    document.getElementById("filtro-grado").value    = "";
    document.getElementById("filtro-seccion").value  = "";
    document.getElementById("ficha-contenedor").innerHTML = "";
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
              + '<thead><tr><th>Asignatura</th><th>Parcial 1</th><th>Parcial 2</th><th>Final</th><th>Estado</th></tr></thead><tbody>'
              + califs.map(function(c) {
                    const fin    = parseFloat(c.final);
                    const estado = isNaN(fin) ? "—" : fin >= 70
                        ? '<span style="color:#2e7d32;font-weight:700">Aprobado</span>'
                        : '<span style="color:#c62828;font-weight:700">Pendiente</span>';
                    return '<tr><td><strong>' + c.asignatura + '</strong></td><td>' + (c.parcial_1 != null ? c.parcial_1 : "—")
                        + '</td><td>' + (c.parcial_2 != null ? c.parcial_2 : "—")
                        + '</td><td><strong>' + (c.final != null ? c.final : "—") + '</strong></td><td>' + estado + '</td></tr>';
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

        const partsHTML = parts.length === 0
            ? '<p style="color:#aaa;font-size:13px;margin-top:8px">Sin participaciones registradas.</p>'
            : '<ul class="participaciones-lista">'
              + parts.map(function(p) {
                    const fecha = new Date(p.fecha + "T00:00:00").toLocaleDateString("es-DO", { year:"numeric", month:"short", day:"numeric" });
                    return '<li><span class="part-fecha">' + fecha + '</span><span class="part-desc">' + (p.descripcion || "Participacion registrada") + '</span></li>';
                }).join("")
              + '</ul>';

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
                        <input type="text" id="part-desc" placeholder="Descripcion de la participacion..." class="part-input part-input-flex">
                        <button onclick="agregarParticipacion(${e.id})" class="btn-primary" style="padding:10px 18px;font-size:13px;white-space:nowrap;width:auto">+ Agregar</button>
                    </div>
                    <div id="participaciones-lista-${e.id}">${partsHTML}</div>
                </div>
            </div>`;

    } catch (err) {
        contenedor.innerHTML = '<div class="panel"><p class="empty-row">Error al cargar ficha del estudiante.</p></div>';
        console.error("Error ficha:", err);
    }
}

async function agregarParticipacion(estudianteId) {
    const fecha      = document.getElementById("part-fecha").value;
    const descripcion = document.getElementById("part-desc").value.trim();
    if (!fecha) { alert("Seleccione una fecha."); return; }
    try {
        const res = await fetch(`${API}/participaciones`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ estudiante_id: estudianteId, fecha, descripcion })
        });
        if (!res.ok) { alert("Error al guardar participacion."); return; }
        document.getElementById("part-desc").value = "";
        mostrarFichaEstudiante(estudianteId);
    } catch (err) { alert("No se pudo conectar al servidor."); }
}