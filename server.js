// =============================================
//  REGISTRO DE GRADO - SERVIDOR NODE.JS
//  server.js
// =============================================

require("dotenv").config();
const express  = require("express");
const mysql    = require("mysql2");
const cors     = require("cors");
const PDFKit   = require("pdfkit");
const ExcelJS  = require("exceljs");

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ---- CONEXION A MYSQL ----
const db = mysql.createPool({
    host:               process.env.MYSQLHOST,
    user:               process.env.MYSQLUSER,
    password:           process.env.MYSQLPASSWORD,
    database:           process.env.MYSQLDATABASE,
    port:               parseInt(process.env.MYSQLPORT),
    ssl:                { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0
});

function initDB() {
    const tablas = [
        `CREATE TABLE IF NOT EXISTS configuracion (
            id            INT           NOT NULL AUTO_INCREMENT,
            nombre_centro VARCHAR(200)  NOT NULL DEFAULT 'Centro Educativo',
            anio_escolar  VARCHAR(20)   NOT NULL DEFAULT '2025-2026',
            director      VARCHAR(150),
            direccion     VARCHAR(300),
            telefono      VARCHAR(20),
            distrito      VARCHAR(100),
            regional      VARCHAR(100),
            creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS usuarios (
            id        INT          NOT NULL AUTO_INCREMENT,
            nombre    VARCHAR(150) NOT NULL,
            usuario   VARCHAR(50)  NOT NULL,
            password  VARCHAR(255) NOT NULL,
            rol       ENUM('admin','director','docente','coordinador','secretaria') NOT NULL DEFAULT 'docente',
            activo    TINYINT(1)   NOT NULL DEFAULT 1,
            creado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_usuario (usuario)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS aulas (
            id           INT         NOT NULL AUTO_INCREMENT,
            grado        ENUM('1ro','2do','3ro','4to','5to','6to') NOT NULL,
            seccion      ENUM('A','B','C','D')                     NOT NULL,
            anio_escolar VARCHAR(20) NOT NULL DEFAULT '2025-2026',
            aula_numero  VARCHAR(20)          DEFAULT NULL,
            capacidad    TINYINT UNSIGNED     DEFAULT 35,
            creado_en    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_aula (grado, seccion, anio_escolar)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS maestros (
            id           INT          NOT NULL AUTO_INCREMENT,
            usuario_id   INT                   DEFAULT NULL,
            nombre       VARCHAR(150) NOT NULL,
            cedula       VARCHAR(20)           DEFAULT NULL,
            especialidad VARCHAR(100)          DEFAULT NULL,
            telefono     VARCHAR(20)           DEFAULT NULL,
            email        VARCHAR(100)          DEFAULT NULL,
            activo       TINYINT(1)   NOT NULL DEFAULT 1,
            creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_cedula (cedula),
            CONSTRAINT fk_maestro_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
                ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS asignaciones (
            id           INT          NOT NULL AUTO_INCREMENT,
            maestro_id   INT          NOT NULL,
            aula_id      INT          NOT NULL,
            asignatura   VARCHAR(100) NOT NULL,
            anio_escolar VARCHAR(20)  NOT NULL DEFAULT '2025-2026',
            creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_asignacion (aula_id, asignatura, anio_escolar),
            CONSTRAINT fk_asign_maestro FOREIGN KEY (maestro_id) REFERENCES maestros (id)
                ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_asign_aula    FOREIGN KEY (aula_id)    REFERENCES aulas (id)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS estudiantes (
            id               INT          NOT NULL AUTO_INCREMENT,
            aula_id          INT                   DEFAULT NULL,
            nombre           VARCHAR(150) NOT NULL,
            matricula        VARCHAR(50)  NOT NULL,
            cedula           VARCHAR(20)           DEFAULT NULL,
            fecha_nacimiento DATE                  DEFAULT NULL,
            sexo             ENUM('M','F')         DEFAULT NULL,
            grado            ENUM('1ro','2do','3ro','4to','5to','6to') NOT NULL,
            seccion          ENUM('A','B','C','D') DEFAULT NULL,
            tutor            VARCHAR(150)          DEFAULT NULL,
            parentesco_tutor VARCHAR(50)           DEFAULT NULL,
            telefono         VARCHAR(20)           DEFAULT NULL,
            direccion        VARCHAR(300)          DEFAULT NULL,
            observaciones    TEXT                  DEFAULT NULL,
            activo           TINYINT(1)   NOT NULL DEFAULT 1,
            creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_matricula (matricula),
            CONSTRAINT fk_estudiante_aula FOREIGN KEY (aula_id) REFERENCES aulas (id)
                ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS calificaciones (
            id             INT            NOT NULL AUTO_INCREMENT,
            estudiante_id  INT            NOT NULL,
            asignacion_id  INT                     DEFAULT NULL,
            asignatura     VARCHAR(100)   NOT NULL,
            competencia    VARCHAR(200)            DEFAULT NULL,
            parcial_1      DECIMAL(5,2)            DEFAULT NULL,
            parcial_2      DECIMAL(5,2)            DEFAULT NULL,
            final          DECIMAL(5,2)            DEFAULT NULL,
            observaciones  TEXT                    DEFAULT NULL,
            anio_escolar   VARCHAR(20)             DEFAULT '2025-2026',
            creado_en      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_calif_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
                ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_calif_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones (id)
                ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS asistencia (
            id             INT       NOT NULL AUTO_INCREMENT,
            estudiante_id  INT       NOT NULL,
            aula_id        INT                DEFAULT NULL,
            registrado_por INT                DEFAULT NULL,
            fecha          DATE      NOT NULL,
            estado         ENUM('presente','ausente','tardanza','excusa') NOT NULL DEFAULT 'presente',
            observacion    TEXT               DEFAULT NULL,
            creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_asistencia_dia (estudiante_id, fecha),
            CONSTRAINT fk_asist_estudiante  FOREIGN KEY (estudiante_id)  REFERENCES estudiantes (id)
                ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_asist_aula        FOREIGN KEY (aula_id)        REFERENCES aulas (id)
                ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT fk_asist_usuario     FOREIGN KEY (registrado_por) REFERENCES usuarios (id)
                ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS participaciones (
            id            INT          NOT NULL AUTO_INCREMENT,
            estudiante_id INT          NOT NULL,
            fecha         DATE         NOT NULL,
            descripcion   TEXT                  DEFAULT NULL,
            creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_part_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    const alteraciones = [
        `ALTER TABLE estudiantes ADD COLUMN aula_id          INT                   DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN cedula           VARCHAR(20)           DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN fecha_nacimiento DATE                  DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN sexo             ENUM('M','F')         DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN seccion          ENUM('A','B','C','D') DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN tutor            VARCHAR(150)          DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN parentesco_tutor VARCHAR(50)           DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN telefono         VARCHAR(20)           DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN direccion        VARCHAR(300)          DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN observaciones    TEXT                  DEFAULT NULL`,
        `ALTER TABLE estudiantes ADD COLUMN activo           TINYINT(1) NOT NULL DEFAULT 1`,
        `ALTER TABLE estudiantes ADD COLUMN creado_en        TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP`,
        `ALTER TABLE aulas ADD COLUMN maestro_guia_id        INT                   DEFAULT NULL`,
        `ALTER TABLE aulas ADD CONSTRAINT fk_aula_maestro_guia FOREIGN KEY (maestro_guia_id) REFERENCES maestros(id) ON DELETE SET NULL ON UPDATE CASCADE`
    ];

    const datos = [
        `INSERT IGNORE INTO configuracion (id, nombre_centro, anio_escolar, director, distrito, regional)
         VALUES (1, 'Centro Educativo', '2025-2026', '', '', '')`,
        `INSERT IGNORE INTO usuarios (nombre, usuario, password, rol)
         VALUES ('Administrador', 'admin', 'admin123', 'admin')`
    ];

    db.query("SET FOREIGN_KEY_CHECKS = 0", function() {
        let i = 0;
        function next() {
            if (i >= tablas.length) {
                // Phase 2: add new columns to existing tables (ignore ER_DUP_FIELDNAME = 1060)
                let a = 0;
                function nextAlter() {
                    if (a >= alteraciones.length) {
                        // Phase 3: seed data
                        let j = 0;
                        function nextDato() {
                            if (j >= datos.length) {
                                db.query("SET FOREIGN_KEY_CHECKS = 1", function() {
                                    console.log("Base de datos inicializada correctamente.");
                                });
                                return;
                            }
                            db.query(datos[j], function(err) {
                                if (err) console.error("Error en datos iniciales:", err.message);
                                j++; nextDato();
                            });
                        }
                        nextDato();
                        return;
                    }
                    db.query(alteraciones[a], function(err) {
                        if (err && err.errno !== 1060)
                            console.error("Error en ALTER TABLE:", err.message);
                        a++; nextAlter();
                    });
                }
                nextAlter();
                return;
            }
            db.query(tablas[i], function(err) {
                if (err) console.error("Error creando tabla:", err.message);
                i++; next();
            });
        }
        next();
    });
}

db.query("SELECT 1", function(err) {
    if (err) { console.error("Error conectando a MySQL:", err.message); return; }
    console.log("Conectado a MySQL correctamente.");
    initDB();
});

// =============================================
//  LOGIN
// =============================================
app.post("/api/login", function(req, res) {
    const { usuario, password } = req.body;
    if (!usuario || !password)
        return res.status(400).json({ error: "Faltan campos." });
    db.query("SELECT id, nombre, rol FROM usuarios WHERE usuario = ? AND password = ?",
        [usuario, password], function(err, results) {
            if (err) { console.error("Error en login:", err.message); return res.status(500).json({ error: "Error en servidor.", detalle: err.message }); }
            if (results.length === 0)
                return res.status(401).json({ error: "Usuario o contrasena incorrectos." });
            res.json({ ok: true, usuario: results[0] });
        });
});

// =============================================
//  ESTUDIANTES
// =============================================
app.get("/api/estudiantes", function(req, res) {
    db.query("SELECT * FROM estudiantes WHERE activo = 1 ORDER BY creado_en DESC", function(err, results) {
        if (err) { console.error("GET /api/estudiantes:", err.message); return res.status(500).json({ error: "Error al obtener estudiantes.", detalle: err.message }); }
        res.json(results);
    });
});

// --- Búsqueda (debe ir ANTES de cualquier ruta con :id) ---
app.get("/api/estudiantes/buscar", function(req, res) {
    const q       = req.query.q       || "";
    const grado   = req.query.grado   || "";
    const seccion = req.query.seccion || "";
    const term    = "%" + q + "%";
    let sql      = "SELECT * FROM estudiantes WHERE activo=1";
    const params = [];
    if (q) {
        sql += " AND (nombre LIKE ? OR matricula LIKE ? OR IFNULL(cedula,'') LIKE ?)";
        params.push(term, term, term);
    }
    if (grado)   { sql += " AND grado=?";   params.push(grado);   }
    if (seccion) { sql += " AND seccion=?"; params.push(seccion); }
    sql += " ORDER BY nombre LIMIT 100";
    db.query(sql, params, function(err, results) {
        if (err) { console.error("GET /api/estudiantes/buscar:", err.message); return res.status(500).json({ error: "Error al buscar.", detalle: err.message }); }
        res.json(results);
    });
});

app.post("/api/estudiantes", function(req, res) {
    const { nombre, matricula, cedula, fecha_nacimiento, sexo, grado, seccion, aula_id, tutor, parentesco_tutor, telefono, direccion, observaciones } = req.body;
    if (!nombre || !matricula || !grado)
        return res.status(400).json({ error: "Nombre, matricula y grado son obligatorios." });
    db.query(
        "INSERT INTO estudiantes (nombre, matricula, cedula, fecha_nacimiento, sexo, grado, seccion, aula_id, tutor, parentesco_tutor, telefono, direccion, observaciones) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [nombre, matricula, cedula||null, fecha_nacimiento||null, sexo||null, grado, seccion, aula_id||null, tutor, parentesco_tutor||null, telefono, direccion, observaciones],
        function(err, result) {
            if (err) {
                console.error("POST /api/estudiantes:", err.message);
                if (err.code === "ER_DUP_ENTRY")
                    return res.status(409).json({ error: "Ya existe un estudiante con esa matricula." });
                return res.status(500).json({ error: "Error al guardar estudiante.", detalle: err.message });
            }
            res.json({ ok: true, id: result.insertId });
        });
});

app.put("/api/estudiantes/:id", function(req, res) {
    const { nombre, matricula, cedula, fecha_nacimiento, sexo, grado, seccion, aula_id, tutor, parentesco_tutor, telefono, direccion, observaciones } = req.body;
    if (!nombre || !matricula || !grado)
        return res.status(400).json({ error: "Nombre, matricula y grado son obligatorios." });
    db.query(
        "UPDATE estudiantes SET nombre=?,matricula=?,cedula=?,fecha_nacimiento=?,sexo=?,grado=?,seccion=?,aula_id=?,tutor=?,parentesco_tutor=?,telefono=?,direccion=?,observaciones=? WHERE id=? AND activo=1",
        [nombre, matricula, cedula||null, fecha_nacimiento||null, sexo||null, grado, seccion, aula_id||null, tutor, parentesco_tutor||null, telefono, direccion, observaciones, req.params.id],
        function(err, result) {
            if (err) {
                if (err.code === "ER_DUP_ENTRY")
                    return res.status(409).json({ error: "Ya existe un estudiante con esa matricula." });
                return res.status(500).json({ error: "Error al actualizar estudiante." });
            }
            if (result.affectedRows === 0)
                return res.status(404).json({ error: "Estudiante no encontrado." });
            res.json({ ok: true });
        });
});

app.delete("/api/estudiantes/:id", function(req, res) {
    db.query("UPDATE estudiantes SET activo=0 WHERE id=?", [req.params.id], function(err, result) {
        if (err) return res.status(500).json({ error: "Error al eliminar estudiante." });
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Estudiante no encontrado." });
        res.json({ ok: true });
    });
});

// =============================================
//  CALIFICACIONES
// =============================================
app.get("/api/calificaciones", function(req, res) {
    db.query("SELECT c.*, e.nombre AS nombre_estudiante FROM calificaciones c JOIN estudiantes e ON c.estudiante_id = e.id ORDER BY c.creado_en DESC",
        function(err, results) {
            if (err) return res.status(500).json({ error: "Error al obtener calificaciones." });
            res.json(results);
        });
});

app.post("/api/calificaciones", function(req, res) {
    const { estudiante_id, asignatura, competencia, parcial_1, parcial_2, final, observaciones } = req.body;
    if (!estudiante_id || !asignatura)
        return res.status(400).json({ error: "Estudiante y asignatura son obligatorios." });
    db.query("INSERT INTO calificaciones (estudiante_id, asignatura, competencia, parcial_1, parcial_2, final, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [estudiante_id, asignatura, competencia, parcial_1, parcial_2, final, observaciones],
        function(err, result) {
            if (err) return res.status(500).json({ error: "Error al guardar calificacion." });
            res.json({ ok: true, id: result.insertId });
        });
});

// =============================================
//  ASISTENCIA
// =============================================
app.get("/api/asistencia", function(req, res) {
    db.query("SELECT a.id, DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha, a.estado, a.observacion, e.nombre AS nombre_estudiante FROM asistencia a JOIN estudiantes e ON a.estudiante_id = e.id ORDER BY a.fecha DESC",
        function(err, results) {
            if (err) return res.status(500).json({ error: "Error al obtener asistencia." });
            res.json(results);
        });
});

app.post("/api/asistencia", function(req, res) {
    const { registros } = req.body;
    if (!registros || registros.length === 0)
        return res.status(400).json({ error: "No hay registros de asistencia." });
    const values = registros.map(r => [r.estudiante_id, r.fecha, r.estado, r.observacion || ""]);
    db.query("INSERT INTO asistencia (estudiante_id, fecha, estado, observacion) VALUES ?", [values],
        function(err) {
            if (err) return res.status(500).json({ error: "Error al guardar asistencia." });
            res.json({ ok: true });
        });
});

// =============================================
//  USUARIOS
// =============================================
app.get("/api/usuarios", function(req, res) {
    db.query("SELECT id, nombre, usuario, rol FROM usuarios ORDER BY nombre",
        function(err, results) {
            if (err) return res.status(500).json({ error: "Error al obtener usuarios." });
            res.json(results);
        });
});

app.post("/api/usuarios", function(req, res) {
    const { nombre, usuario, password, rol } = req.body;
    if (!nombre || !usuario || !password || !rol)
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    db.query("INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)",
        [nombre, usuario, password, rol], function(err, result) {
            if (err) {
                if (err.code === "ER_DUP_ENTRY")
                    return res.status(409).json({ error: "Ese nombre de usuario ya existe." });
                return res.status(500).json({ error: "Error al crear usuario." });
            }
            res.json({ ok: true, id: result.insertId });
        });
});

app.delete("/api/usuarios/:id", function(req, res) {
    db.query("DELETE FROM usuarios WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Error al eliminar usuario." });
        res.json({ ok: true });
    });
});

// =============================================
//  AULAS
// =============================================
app.get("/api/aulas", function(req, res) {
    const sql = `SELECT a.*, m.nombre AS nombre_maestro, m.especialidad,
                 (SELECT COUNT(*) FROM estudiantes WHERE aula_id = a.id AND activo = 1) AS estudiantes_count
                 FROM aulas a LEFT JOIN maestros m ON a.maestro_guia_id = m.id
                 ORDER BY a.grado, a.seccion`;
    db.query(sql, function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener aulas." });
        res.json(results);
    });
});

app.post("/api/aulas", function(req, res) {
    const { aula_numero, grado, seccion, capacidad, maestro_guia_id, anio_escolar } = req.body;
    if (!grado || !seccion)
        return res.status(400).json({ error: "Grado y sección son obligatorios." });

    const año = anio_escolar || "2025-2026";
    db.query(
        "INSERT INTO aulas (aula_numero, grado, seccion, capacidad, maestro_guia_id, anio_escolar) VALUES (?, ?, ?, ?, ?, ?)",
        [aula_numero || null, grado, seccion, capacidad || 35, maestro_guia_id || null, año],
        function(err, result) {
            if (err) {
                if (err.code === "ER_DUP_ENTRY")
                    return res.status(409).json({ error: "Ya existe un aula con ese grado y sección." });
                return res.status(500).json({ error: "Error al crear aula." });
            }
            res.json({ ok: true, id: result.insertId });
        });
});

app.put("/api/aulas/:id", function(req, res) {
    const { aula_numero, grado, seccion, capacidad, maestro_guia_id } = req.body;
    if (!grado || !seccion)
        return res.status(400).json({ error: "Grado y sección son obligatorios." });

    db.query(
        "UPDATE aulas SET aula_numero=?, grado=?, seccion=?, capacidad=?, maestro_guia_id=? WHERE id=?",
        [aula_numero || null, grado, seccion, capacidad || 35, maestro_guia_id || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: "Error al actualizar aula." });
            res.json({ ok: true });
        });
});

app.delete("/api/aulas/:id", function(req, res) {
    db.query("DELETE FROM aulas WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Error al eliminar aula." });
        res.json({ ok: true });
    });
});

// =============================================
//  MAESTROS
// =============================================
app.get("/api/maestros", function(req, res) {
    db.query("SELECT * FROM maestros WHERE activo = 1 ORDER BY nombre", function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener maestros." });
        res.json(results);
    });
});

app.post("/api/maestros", function(req, res) {
    const { nombre, usuario_id, cedula, especialidad, telefono, email } = req.body;
    if (!nombre)
        return res.status(400).json({ error: "Nombre es obligatorio." });

    db.query(
        "INSERT INTO maestros (nombre, usuario_id, cedula, especialidad, telefono, email) VALUES (?, ?, ?, ?, ?, ?)",
        [nombre, usuario_id || null, cedula || null, especialidad || null, telefono || null, email || null],
        function(err, result) {
            if (err) {
                if (err.code === "ER_DUP_ENTRY")
                    return res.status(409).json({ error: "Ese número de cédula ya existe." });
                return res.status(500).json({ error: "Error al crear maestro." });
            }
            res.json({ ok: true, id: result.insertId });
        });
});

app.put("/api/maestros/:id", function(req, res) {
    const { nombre, usuario_id, cedula, especialidad, telefono, email } = req.body;
    if (!nombre)
        return res.status(400).json({ error: "Nombre es obligatorio." });

    db.query(
        "UPDATE maestros SET nombre=?, usuario_id=?, cedula=?, especialidad=?, telefono=?, email=? WHERE id=?",
        [nombre, usuario_id || null, cedula || null, especialidad || null, telefono || null, email || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: "Error al actualizar maestro." });
            res.json({ ok: true });
        });
});

app.delete("/api/maestros/:id", function(req, res) {
    db.query("UPDATE maestros SET activo = 0 WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Error al eliminar maestro." });
        res.json({ ok: true });
    });
});

// =============================================
//  ASIGNACIONES (Maestro + Aula + Asignatura)
// =============================================
app.get("/api/asignaciones", function(req, res) {
    const sql = `SELECT a.*, m.nombre AS nombre_maestro, m.especialidad,
                 CONCAT(au.grado, '-', au.seccion) AS aula_nombre
                 FROM asignaciones a
                 JOIN maestros m ON a.maestro_id = m.id
                 JOIN aulas au ON a.aula_id = au.id
                 ORDER BY au.grado, au.seccion, a.asignatura`;
    db.query(sql, function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener asignaciones." });
        res.json(results);
    });
});

app.get("/api/asignaciones/aula/:aulaId", function(req, res) {
    const sql = `SELECT a.*, m.nombre AS nombre_maestro, m.especialidad
                 FROM asignaciones a
                 JOIN maestros m ON a.maestro_id = m.id
                 WHERE a.aula_id = ? AND a.anio_escolar = '2025-2026'
                 ORDER BY a.asignatura`;
    db.query(sql, [req.params.aulaId], function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener asignaciones." });
        res.json(results);
    });
});

app.get("/api/asignaciones/maestro/:maestroId", function(req, res) {
    const sql = `SELECT a.*, au.grado, au.seccion
                 FROM asignaciones a
                 JOIN aulas au ON a.aula_id = au.id
                 WHERE a.maestro_id = ?
                 ORDER BY au.grado, au.seccion`;
    db.query(sql, [req.params.maestroId], function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener asignaciones." });
        res.json(results);
    });
});

app.post("/api/asignaciones", function(req, res) {
    const { maestro_id, aula_id, asignatura, anio_escolar } = req.body;
    if (!maestro_id || !aula_id || !asignatura)
        return res.status(400).json({ error: "Maestro, aula y asignatura son obligatorios." });

    const año = anio_escolar || "2025-2026";
    db.query(
        "INSERT INTO asignaciones (maestro_id, aula_id, asignatura, anio_escolar) VALUES (?, ?, ?, ?)",
        [maestro_id, aula_id, asignatura, año],
        function(err, result) {
            if (err) {
                if (err.code === "ER_DUP_ENTRY")
                    return res.status(409).json({ error: "Ya existe una asignación para esa materia en el aula." });
                return res.status(500).json({ error: "Error al crear asignación." });
            }
            res.json({ ok: true, id: result.insertId });
        });
});

app.delete("/api/asignaciones/:id", function(req, res) {
    db.query("DELETE FROM asignaciones WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Error al eliminar asignación." });
        res.json({ ok: true });
    });
});

// =============================================
//  CONFIGURACION
// =============================================
app.get("/api/configuracion", function(req, res) {
    db.query("SELECT * FROM configuracion LIMIT 1", function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener configuracion." });
        res.json(results[0] || {});
    });
});

app.put("/api/configuracion", function(req, res) {
    const { nombre_centro, anio_escolar, director, direccion, telefono, distrito, regional } = req.body;
    if (!nombre_centro || !anio_escolar)
        return res.status(400).json({ error: "Nombre del centro y ano escolar son obligatorios." });
    db.query("UPDATE configuracion SET nombre_centro=?, anio_escolar=?, director=?, direccion=?, telefono=?, distrito=?, regional=? WHERE id=1",
        [nombre_centro, anio_escolar, director, direccion, telefono, distrito, regional],
        function(err) {
            if (err) return res.status(500).json({ error: "Error al guardar configuracion." });
            res.json({ ok: true });
        });
});

// =============================================
//  EXPORTAR PDF
// =============================================
app.get("/api/exportar/pdf/:tipo", function(req, res) {
    const tipo = req.params.tipo;
    let sql = "", titulo = "", columnas = [];

    if (tipo === "estudiantes") {
        sql = "SELECT nombre, matricula, grado, seccion, tutor, telefono FROM estudiantes WHERE activo=1 ORDER BY nombre";
        titulo = "Listado de Estudiantes";
        columnas = ["Nombre", "Matricula", "Grado", "Seccion", "Tutor", "Telefono"];
    } else if (tipo === "calificaciones") {
        sql = "SELECT e.nombre AS estudiante, c.asignatura, c.parcial_1, c.parcial_2, c.final FROM calificaciones c JOIN estudiantes e ON c.estudiante_id = e.id ORDER BY e.nombre";
        titulo = "Reporte de Calificaciones";
        columnas = ["Estudiante", "Asignatura", "Parcial 1", "Parcial 2", "Final"];
    } else if (tipo === "asistencia") {
        sql = "SELECT e.nombre AS estudiante, DATE_FORMAT(a.fecha,'%d/%m/%Y') AS fecha, a.estado FROM asistencia a JOIN estudiantes e ON a.estudiante_id = e.id ORDER BY a.fecha DESC";
        titulo = "Reporte de Asistencia";
        columnas = ["Estudiante", "Fecha", "Estado"];
    } else {
        return res.status(400).json({ error: "Tipo no valido." });
    }

    db.query(sql, function(err, rows) {
        if (err) return res.status(500).json({ error: "Error al generar PDF." });
        const doc = new PDFKit({ margin: 40 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${tipo}.pdf"`);
        doc.pipe(res);
        doc.fontSize(18).fillColor("#0d2352").text(titulo, { align: "center" });
        doc.fontSize(10).fillColor("#666").text("Sistema de Registro de Grado Digital - MINERD", { align: "center" });
        doc.moveDown();
        const colW = (doc.page.width - 80) / columnas.length;
        let y = doc.y;
        doc.rect(40, y, doc.page.width - 80, 20).fill("#0d2352");
        columnas.forEach(function(col, i) {
            doc.fillColor("#fff").fontSize(10).text(col, 40 + i * colW + 4, y + 5, { width: colW - 8 });
        });
        y += 22;
        rows.forEach(function(row, idx) {
            const vals = Object.values(row);
            doc.rect(40, y, doc.page.width - 80, 18).fill(idx % 2 === 0 ? "#f4f7ff" : "#ffffff");
            vals.forEach(function(val, i) {
                doc.fillColor("#333").fontSize(9).text(
                    val !== null && val !== undefined ? String(val) : "-",
                    40 + i * colW + 4, y + 4, { width: colW - 8 }
                );
            });
            y += 20;
            if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        });
        doc.moveDown(2);
        doc.fontSize(8).fillColor("#aaa").text("Generado el " + new Date().toLocaleDateString("es-DO"), { align: "right" });
        doc.end();
    });
});

// =============================================
//  EXPORTAR EXCEL
// =============================================
app.get("/api/exportar/excel/:tipo", async function(req, res) {
    const tipo = req.params.tipo;
    let sql = "", titulo = "", columnas = [];

    if (tipo === "estudiantes") {
        sql = "SELECT nombre, matricula, grado, seccion, tutor, telefono, direccion FROM estudiantes WHERE activo=1 ORDER BY nombre";
        titulo = "Estudiantes";
        columnas = ["Nombre", "Matricula", "Grado", "Seccion", "Tutor", "Telefono", "Direccion"];
    } else if (tipo === "calificaciones") {
        sql = "SELECT e.nombre AS estudiante, c.asignatura, c.competencia, c.parcial_1, c.parcial_2, c.final FROM calificaciones c JOIN estudiantes e ON c.estudiante_id = e.id ORDER BY e.nombre";
        titulo = "Calificaciones";
        columnas = ["Estudiante", "Asignatura", "Competencia", "Parcial 1", "Parcial 2", "Final"];
    } else if (tipo === "asistencia") {
        sql = "SELECT e.nombre AS estudiante, DATE_FORMAT(a.fecha,'%d/%m/%Y') AS fecha, a.estado, a.observacion FROM asistencia a JOIN estudiantes e ON a.estudiante_id = e.id ORDER BY a.fecha DESC";
        titulo = "Asistencia";
        columnas = ["Estudiante", "Fecha", "Estado", "Observacion"];
    } else {
        return res.status(400).json({ error: "Tipo no valido." });
    }

    db.query(sql, async function(err, rows) {
        if (err) return res.status(500).json({ error: "Error al generar Excel." });
        const workbook  = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(titulo);
        worksheet.addRow(columnas);
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell(function(cell) {
            cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF0D2352" } };
            cell.font = { bold:true, color:{ argb:"FFFFFFFF" }, size:11 };
            cell.alignment = { vertical:"middle", horizontal:"center" };
            cell.border = { top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"} };
        });
        headerRow.height = 22;
        rows.forEach(function(row, idx) {
            const vals    = Object.values(row).map(v => v !== null && v !== undefined ? v : "-");
            const dataRow = worksheet.addRow(vals);
            dataRow.eachCell(function(cell) {
                cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: idx % 2 === 0 ? "FFF4F7FF" : "FFFFFFFF" } };
                cell.border = { top:{style:"thin",color:{argb:"FFE0E0E0"}}, left:{style:"thin",color:{argb:"FFE0E0E0"}}, bottom:{style:"thin",color:{argb:"FFE0E0E0"}}, right:{style:"thin",color:{argb:"FFE0E0E0"}} };
            });
        });
        worksheet.columns.forEach(function(col) { col.width = 20; });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${tipo}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    });
});

app.get("/api/estudiantes/:id/ficha", function(req, res) {
    const id = req.params.id;
    db.query(
        `SELECT e.*, a.anio_escolar FROM estudiantes e
         LEFT JOIN aulas a ON e.aula_id = a.id
         WHERE e.id = ? AND e.activo = 1`,
        [id], function(err, estRows) {
            if (err || estRows.length === 0)
                return res.status(404).json({ error: "Estudiante no encontrado." });
            const est = estRows[0];
            db.query(
                "SELECT * FROM calificaciones WHERE estudiante_id=? ORDER BY asignatura",
                [id], function(err2, califs) {
                    if (err2) return res.status(500).json({ error: "Error al obtener calificaciones." });
                    db.query(
                        "SELECT DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha, estado, observacion FROM asistencia WHERE estudiante_id=? ORDER BY fecha DESC LIMIT 60",
                        [id], function(err3, asist) {
                            if (err3) return res.status(500).json({ error: "Error al obtener asistencia." });
                            db.query(
                                "SELECT DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha, descripcion FROM participaciones WHERE estudiante_id=? ORDER BY fecha DESC",
                                [id], function(err4, parts) {
                                    if (err4) return res.status(500).json({ error: "Error al obtener participaciones." });
                                    const stats = { presente:0, ausente:0, tardanza:0, excusa:0 };
                                    asist.forEach(function(a) { if (stats[a.estado] !== undefined) stats[a.estado]++; });
                                    const finales = califs.filter(function(c) { return c.final !== null; }).map(function(c) { return parseFloat(c.final); });
                                    const promedio = finales.length ? (finales.reduce(function(a,b){return a+b;},0)/finales.length).toFixed(1) : null;
                                    res.json({
                                        estudiante:      est,
                                        calificaciones:  califs,
                                        asistencia:      { stats: stats, detalle: asist.slice(0, 10) },
                                        participaciones: parts,
                                        promedio_general: promedio
                                    });
                                });
                        });
                });
        });
});

app.post("/api/participaciones", function(req, res) {
    const { estudiante_id, fecha, descripcion } = req.body;
    if (!estudiante_id || !fecha)
        return res.status(400).json({ error: "Estudiante y fecha son obligatorios." });
    db.query(
        "INSERT INTO participaciones (estudiante_id, fecha, descripcion) VALUES (?,?,?)",
        [estudiante_id, fecha, descripcion || ""],
        function(err, result) {
            if (err) return res.status(500).json({ error: "Error al guardar participacion." });
            res.json({ ok: true, id: result.insertId });
        });
});

// =============================================
//  DIAGNOSTICO TEMPORAL (eliminar después de verificar)
// =============================================
app.get("/api/db-check", function(req, res) {
    db.query("DESCRIBE estudiantes", function(err, cols) {
        if (err) return res.json({ error: err.message });
        db.query("SELECT COUNT(*) AS total FROM estudiantes", function(err2, cnt) {
            db.query("SELECT id, nombre, grado, seccion, matricula, cedula, fecha_nacimiento, sexo, parentesco_tutor FROM estudiantes WHERE activo=1 ORDER BY id DESC LIMIT 10", function(err3, rows) {
                res.json({
                    columnas: cols.map(function(c){ return { nombre: c.Field, tipo: c.Type, nulo: c.Null }; }),
                    total_activos: err2 ? err2.message : cnt[0].total,
                    ultimos_10: err3 ? err3.message : rows
                });
            });
        });
    });
});

// =============================================
//  INICIAR SERVIDOR
// =============================================
app.listen(PORT, function() {
    console.log("Servidor corriendo en http://localhost:" + PORT);
});