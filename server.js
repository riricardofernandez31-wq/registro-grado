// =============================================
//  REGISTRO DE GRADO - SERVIDOR NODE.JS
//  server.js
// =============================================

require("dotenv").config();
const express  = require("express");
const mysql    = require("mysql2");
const cors     = require("cors");
const bcrypt   = require("bcrypt");
const PDFKit   = require("pdfkit");
const ExcelJS  = require("exceljs");

const app  = express();
const PORT = process.env.PORT || 8080;
const SALT_ROUNDS = 10;

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

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, function(err, rows) {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

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
            id                     INT            NOT NULL AUTO_INCREMENT,
            estudiante_id          INT            NOT NULL,
            asignacion_id          INT                     DEFAULT NULL,
            asignatura             VARCHAR(100)   NOT NULL,
            competencia            VARCHAR(200)            DEFAULT NULL,
            nota1                  DECIMAL(5,2)            DEFAULT 0,
            nota2                  DECIMAL(5,2)            DEFAULT 0,
            nota3                  DECIMAL(5,2)            DEFAULT 0,
            nota4                  DECIMAL(5,2)            DEFAULT 0,
            promedio               DECIMAL(5,2)            DEFAULT NULL,
            promedio_redondeado    INT                     DEFAULT NULL,
            observaciones          TEXT                    DEFAULT NULL,
            anio_escolar           VARCHAR(20)             DEFAULT '2025-2026',
            creado_en              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
            id             INT          NOT NULL AUTO_INCREMENT,
            estudiante_id  INT          NOT NULL,
            fecha          DATE         NOT NULL,
            puntuacion     TINYINT UNSIGNED          DEFAULT 0,
            observacion    TEXT                      DEFAULT NULL,
            registrado_por INT                       DEFAULT NULL,
            descripcion    TEXT                      DEFAULT NULL,
            creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_part_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
                ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_part_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios (id)
                ON DELETE SET NULL ON UPDATE CASCADE
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
        `ALTER TABLE aulas ADD CONSTRAINT fk_aula_maestro_guia FOREIGN KEY (maestro_guia_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE participaciones ADD COLUMN puntuacion TINYINT UNSIGNED DEFAULT 0`,
        `ALTER TABLE participaciones ADD COLUMN observacion TEXT DEFAULT NULL`,
        `ALTER TABLE participaciones ADD COLUMN registrado_por INT DEFAULT NULL`,
        `ALTER TABLE participaciones ADD COLUMN descripcion TEXT DEFAULT NULL`,
        `ALTER TABLE participaciones ADD CONSTRAINT fk_part_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE calificaciones ADD COLUMN asignacion_id INT DEFAULT NULL`,
        `ALTER TABLE calificaciones ADD CONSTRAINT fk_calif_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE calificaciones ADD COLUMN nota1 DECIMAL(5,2) DEFAULT 0 AFTER competencia`,
        `ALTER TABLE calificaciones ADD COLUMN nota2 DECIMAL(5,2) DEFAULT 0 AFTER nota1`,
        `ALTER TABLE calificaciones ADD COLUMN nota3 DECIMAL(5,2) DEFAULT 0 AFTER nota2`,
        `ALTER TABLE calificaciones ADD COLUMN nota4 DECIMAL(5,2) DEFAULT 0 AFTER nota3`,
        `ALTER TABLE calificaciones ADD COLUMN promedio DECIMAL(5,2) DEFAULT NULL`,
        `ALTER TABLE calificaciones ADD COLUMN promedio_redondeado INT DEFAULT NULL`
    ];

    const defaultAdminPasswordHash = bcrypt.hashSync('admin123', SALT_ROUNDS);
    const datos = [
        `INSERT IGNORE INTO configuracion (id, nombre_centro, anio_escolar, director, distrito, regional)
         VALUES (1, 'Centro Educativo', '2025-2026', '', '', '')`,
        `INSERT IGNORE INTO usuarios (nombre, usuario, password, rol)
         VALUES ('Administrador', 'admin', '${defaultAdminPasswordHash}', 'admin')`
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
    db.query("SELECT id, nombre, rol, password FROM usuarios WHERE usuario = ?", [usuario], function(err, results) {
        if (err) { console.error("Error en login:", err.message); return res.status(500).json({ error: "Error en servidor.", detalle: err.message }); }
        if (results.length === 0)
            return res.status(401).json({ error: "Usuario o contrasena incorrectos." });
        const user = results[0];
        bcrypt.compare(password, user.password, function(err2, match) {
            if (err2) { console.error("Error bcrypt compare:", err2.message); return res.status(500).json({ error: "Error en servidor.", detalle: err2.message }); }
            if (!match)
                return res.status(401).json({ error: "Usuario o contrasena incorrectos." });
            res.json({ ok: true, usuario: { id: user.id, nombre: user.nombre, rol: user.rol } });
        });
    });
});

// =============================================
//  ESTUDIANTES
// =============================================
app.get("/api/estudiantes", function(req, res) {
    const sql = `
        SELECT ROW_NUMBER() OVER (PARTITION BY aula_id ORDER BY SUBSTRING_INDEX(nombre, ' ', -1) ASC) AS orden, e.*
        FROM estudiantes e
        WHERE e.activo = 1
        ORDER BY e.aula_id, SUBSTRING_INDEX(e.nombre, ' ', -1) ASC
    `;
    db.query(sql, function(err, results) {
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

    let where = "1=1";
    const params = [];
    if (q) {
        where += " AND (nombre LIKE ? OR matricula LIKE ? OR IFNULL(cedula,'') LIKE ?)";
        params.push(term, term, term);
    }
    if (grado)   { where += " AND grado=?";   params.push(grado);   }
    if (seccion) { where += " AND seccion=?"; params.push(seccion); }

    const sql = `
        SELECT * FROM (
            SELECT ROW_NUMBER() OVER (PARTITION BY aula_id ORDER BY SUBSTRING_INDEX(nombre, ' ', -1) ASC) AS orden, e.*
            FROM estudiantes e WHERE e.activo = 1
        ) sub
        WHERE ${where}
        ORDER BY SUBSTRING_INDEX(nombre, ' ', -1) ASC
        LIMIT 100
    `;
    db.query(sql, params, function(err, results) {
        if (err) { console.error("GET /api/estudiantes/buscar:", err.message); return res.status(500).json({ error: "Error al buscar.", detalle: err.message }); }
        res.json(results);
    });
});

app.post("/api/estudiantes", function(req, res) {
    const { nombre, matricula, cedula, fecha_nacimiento, sexo, grado, seccion, aula_id, tutor, parentesco_tutor, telefono, direccion, observaciones } = req.body;
    if (!nombre || !matricula || !grado)
        return res.status(400).json({ error: "Nombre, matricula y grado son obligatorios." });
    // Si no se provee aula_id, intentar asignar según grado+seccion
    function doInsert(aulaToUse) {
        db.query(
            "INSERT INTO estudiantes (nombre, matricula, cedula, fecha_nacimiento, sexo, grado, seccion, aula_id, tutor, parentesco_tutor, telefono, direccion, observaciones) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [nombre, matricula, cedula||null, fecha_nacimiento||null, sexo||null, grado, seccion, aulaToUse||null, tutor, parentesco_tutor||null, telefono, direccion, observaciones],
            function(err, result) {
                if (err) {
                    console.error("POST /api/estudiantes:", err.message);
                    if (err.code === "ER_DUP_ENTRY")
                        return res.status(409).json({ error: "Ya existe un estudiante con esa matricula." });
                    return res.status(500).json({ error: "Error al guardar estudiante.", detalle: err.message });
                }
                res.json({ ok: true, id: result.insertId });
            });
    }

    if (aula_id) return doInsert(aula_id);
    // buscar anio escolar configurado
    db.query("SELECT anio_escolar FROM configuracion LIMIT 1", function(err, rows) {
        const anio = (rows && rows[0] && rows[0].anio_escolar) ? rows[0].anio_escolar : '2025-2026';
        if (!grado || !seccion) return doInsert(null);
        db.query("SELECT id FROM aulas WHERE grado = ? AND seccion = ? AND anio_escolar = ? LIMIT 1", [grado, seccion, anio], function(err2, rows2) {
            const aulaToUse = (rows2 && rows2[0]) ? rows2[0].id : null;
            doInsert(aulaToUse);
        });
    });
});

app.put("/api/estudiantes/:id", function(req, res) {
    const { nombre, matricula, cedula, fecha_nacimiento, sexo, grado, seccion, aula_id, tutor, parentesco_tutor, telefono, direccion, observaciones } = req.body;
    if (!nombre || !matricula || !grado)
        return res.status(400).json({ error: "Nombre, matricula y grado son obligatorios." });
    function doUpdate(aulaToUse) {
        db.query(
            "UPDATE estudiantes SET nombre=?,matricula=?,cedula=?,fecha_nacimiento=?,sexo=?,grado=?,seccion=?,aula_id=?,tutor=?,parentesco_tutor=?,telefono=?,direccion=?,observaciones=? WHERE id=? AND activo=1",
            [nombre, matricula, cedula||null, fecha_nacimiento||null, sexo||null, grado, seccion, aulaToUse||null, tutor, parentesco_tutor||null, telefono, direccion, observaciones, req.params.id],
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
    }

    if (aula_id) return doUpdate(aula_id);
    db.query("SELECT anio_escolar FROM configuracion LIMIT 1", function(err, rows) {
        const anio = (rows && rows[0] && rows[0].anio_escolar) ? rows[0].anio_escolar : '2025-2026';
        if (!grado || !seccion) return doUpdate(null);
        db.query("SELECT id FROM aulas WHERE grado = ? AND seccion = ? AND anio_escolar = ? LIMIT 1", [grado, seccion, anio], function(err2, rows2) {
            const aulaToUse = (rows2 && rows2[0]) ? rows2[0].id : null;
            doUpdate(aulaToUse);
        });
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
    const { estudiante_id, asignatura, competencia, nota1, nota2, nota3, nota4, observaciones, asignacion_id } = req.body;
    if (!estudiante_id || !asignatura)
        return res.status(400).json({ error: "Estudiante y asignatura son obligatorios." });

    const parseNota = (value) => {
        const numero = value != null && value !== '' && !isNaN(Number(value)) ? Number(value) : 0;
        return Math.min(100, Math.max(0, numero));
    };
    const n1 = parseNota(nota1);
    const n2 = parseNota(nota2);
    const n3 = parseNota(nota3);
    const n4 = parseNota(nota4);
    const promedio = Number(((n1 + n2 + n3 + n4) / 4).toFixed(2));
    const promedio_redondeado = Math.round(promedio);

    function insertCalificacion(asignacionIdToUse) {
        db.query(
            "INSERT INTO calificaciones (estudiante_id, asignacion_id, asignatura, competencia, nota1, nota2, nota3, nota4, promedio, promedio_redondeado, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [estudiante_id, asignacionIdToUse || null, asignatura, competencia || null, n1, n2, n3, n4, promedio, promedio_redondeado, observaciones || null],
            function(err, result) {
                if (err) {
                    console.error("Error INSERT calificaciones:", err.message);
                    return res.status(500).json({ error: "Error al guardar calificacion.", detalle: err.message });
                }
                res.json({ ok: true, id: result.insertId, promedio, promedio_redondeado });
            });
    }

    if (asignacion_id) return insertCalificacion(asignacion_id);

    db.query(
        `SELECT a.id
         FROM asignaciones a
         JOIN estudiantes e ON e.aula_id = a.aula_id
         WHERE e.id = ? AND a.asignatura = ?
         LIMIT 1`,
        [estudiante_id, asignatura], function(err2, rows2) {
            if (err2) {
                console.error("Error al buscar asignacion para calificacion:", err2.message);
                return res.status(500).json({ error: "Error al guardar calificacion.", detalle: err2.message });
            }
            const asignacionToUse = (rows2 && rows2[0]) ? rows2[0].id : null;
            insertCalificacion(asignacionToUse);
        });
});

// =============================================
//  ASISTENCIA
// =============================================
app.get("/api/asistencia", function(req, res) {
    const sql = `
        SELECT a.id, DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha, a.estado, a.observacion,
               e.nombre AS nombre_estudiante,
               ROW_NUMBER() OVER (PARTITION BY e.aula_id ORDER BY SUBSTRING_INDEX(e.nombre, ' ', -1) ASC) AS orden
        FROM asistencia a
        JOIN estudiantes e ON a.estudiante_id = e.id
        ORDER BY a.fecha DESC, SUBSTRING_INDEX(e.nombre, ' ', -1) ASC
    `;
    db.query(sql, function(err, results) {
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
    bcrypt.hash(password, SALT_ROUNDS, function(err, hash) {
        if (err) {
            console.error("Error bcrypt hash:", err.message);
            return res.status(500).json({ error: "Error en servidor.", detalle: err.message });
        }
        db.query("INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)",
            [nombre, usuario, hash, rol], function(err2, result) {
                if (err2) {
                    if (err2.code === "ER_DUP_ENTRY")
                        return res.status(409).json({ error: "Ese nombre de usuario ya existe." });
                    return res.status(500).json({ error: "Error al crear usuario." });
                }
                res.json({ ok: true, id: result.insertId });
            });
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
    const sql = `SELECT a.*, u.nombre AS nombre_maestro, u.rol AS maestro_rol,
                 (SELECT COUNT(*) FROM estudiantes WHERE aula_id = a.id AND activo = 1) AS estudiantes_count
                 FROM aulas a LEFT JOIN usuarios u ON a.maestro_guia_id = u.id
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
    const { aula_numero, grado, seccion, capacidad } = req.body;
    const maestroGuiaId = req.body.maestro_guia_id || null;
    if (!grado || !seccion)
        return res.status(400).json({ error: "Grado y sección son obligatorios." });

    db.query(
        "UPDATE aulas SET aula_numero=?, grado=?, seccion=?, capacidad=?, maestro_guia_id=? WHERE id=?",
        [aula_numero || null, grado, seccion, capacidad || 35, maestroGuiaId, req.params.id],
        function(err) {
            if (err) {
                console.error("Error UPDATE /api/aulas/:id", err.message);
                return res.status(500).json({ error: "Error al actualizar aula.", detalle: err.message });
            }
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
//  DOCENTES - AULAS ASIGNADAS
// =============================================

// GET /api/docente/mis-aulas?usuario_id=X
app.get("/api/docente/mis-aulas", function(req, res) {
    const usuario_id = parseInt(req.query.usuario_id, 10);
    if (!usuario_id) return res.status(400).json({ error: "usuario_id requerido." });

    const sql = `
        SELECT DISTINCT a.id, a.grado, a.seccion, a.aula_numero, a.capacidad,
               u.nombre AS nombre_maestro,
               (SELECT COUNT(*) FROM estudiantes WHERE aula_id = a.id AND activo = 1) AS cantidad_estudiantes
        FROM aulas a
        LEFT JOIN usuarios u ON a.maestro_guia_id = u.id
        WHERE a.maestro_guia_id = ?
           OR a.id IN (
               SELECT DISTINCT aula_id FROM asignaciones
               JOIN maestros m ON asignaciones.maestro_id = m.id
               WHERE m.usuario_id = ?
           )
        ORDER BY a.grado, a.seccion
    `;

    db.query(sql, [usuario_id, usuario_id], function(err, results) {
        if (err) {
            console.error("GET /api/docente/mis-aulas:", err.message);
            return res.status(500).json({ error: "Error al obtener aulas.", detalle: err.message });
        }
        res.json(results || []);
    });
});

app.get("/api/docente/:usuario_id/mis-aulas", function(req, res) {
    const usuario_id = parseInt(req.params.usuario_id, 10);
    
    // Obtener aulas donde el docente es maestro_guía OR tiene asignaciones
    const sql = `
        SELECT DISTINCT a.id, a.grado, a.seccion, a.aula_numero, a.capacidad,
               u.nombre AS nombre_maestro,
               (SELECT COUNT(*) FROM estudiantes WHERE aula_id = a.id AND activo = 1) AS cantidad_estudiantes
        FROM aulas a
        LEFT JOIN usuarios u ON a.maestro_guia_id = u.id
        WHERE a.maestro_guia_id = ?
           OR a.id IN (
               SELECT DISTINCT aula_id FROM asignaciones
               JOIN maestros m ON asignaciones.maestro_id = m.id
               WHERE m.usuario_id = ?
           )
        ORDER BY a.grado, a.seccion
    `;
    
    db.query(sql, [usuario_id, usuario_id], function(err, results) {
        if (err) {
            console.error("GET /api/docente/mis-aulas:", err.message);
            return res.status(500).json({ error: "Error al obtener aulas.", detalle: err.message });
        }
        res.json(results || []);
    });
});

// =============================================
//  MAESTROS
// =============================================
// Retorna usuarios activos que pueden ser asignados como Maestro Guía en Aulas.
app.get("/api/maestros", function(req, res) {
    const sql = `SELECT id, nombre, rol FROM usuarios WHERE rol IN ('docente','admin','director','coordinador') ORDER BY nombre`;
    db.query(sql, function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener maestros." });
        res.json(results);
    });
});

// Devuelve solo maestros cuyo usuario tiene rol 'docente' (para dropdowns)
app.get("/api/maestros/docentes", function(req, res) {
    const sql = `SELECT m.* FROM maestros m JOIN usuarios u ON m.usuario_id = u.id WHERE m.activo = 1 AND u.rol = 'docente' ORDER BY m.nombre`;
    db.query(sql, function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener maestros docentes." });
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

app.get("/api/maestros/para-asignaciones", function(req, res) {
    const sql = "SELECT id, nombre, especialidad FROM maestros WHERE activo = 1 ORDER BY nombre";
    db.query(sql, function(err, results) {
        if (err) return res.status(500).json({ error: "Error al obtener maestros." });
        res.json(results);
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
    const aulaId = req.query.aulaId ? parseInt(req.query.aulaId) : null;
    let sql = "", titulo = "", columnas = [], params = [], landscape = false;

    if (tipo === "estudiantes") {
        sql = "SELECT nombre, matricula, grado, seccion, tutor, telefono FROM estudiantes WHERE activo=1 ORDER BY nombre";
        titulo = "Listado de Estudiantes";
        columnas = ["Nombre", "Matricula", "Grado", "Seccion", "Tutor", "Telefono"];
    } else if (tipo === "calificaciones") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre AS estudiante, e.grado, e.seccion, c.asignatura,
                      COALESCE(c.nota1,0) AS p1, COALESCE(c.nota2,0) AS p2,
                      COALESCE(c.nota3,0) AS p3, COALESCE(c.nota4,0) AS p4,
                      COALESCE(c.promedio_redondeado,0) AS promedio,
                      CASE WHEN c.promedio_redondeado>=70 THEN 'Aprobado'
                           WHEN c.promedio_redondeado>0 THEN 'Recuperacion'
                           ELSE '-' END AS condicion
               FROM calificaciones c JOIN estudiantes e ON c.estudiante_id=e.id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               ORDER BY e.grado, e.seccion, SUBSTRING_INDEX(e.nombre,' ',-1), c.asignatura`;
        titulo = "Reporte de Notas";
        columnas = ["N\xb0", "Estudiante", "Asignatura", "P1", "P2", "P3", "P4", "Promedio", "Condicion"];
        landscape = true;
    } else if (tipo === "asistencia") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre AS estudiante, DATE_FORMAT(a.fecha,'%d/%m/%Y') AS fecha, a.estado
               FROM asistencia a JOIN estudiantes e ON a.estudiante_id=e.id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               ORDER BY a.fecha DESC, e.nombre`;
        titulo = "Reporte de Asistencia";
        columnas = ["Estudiante", "Fecha", "Estado"];
    } else if (tipo === "asistencia-resumen") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre,
                      SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END) AS presentes,
                      SUM(CASE WHEN a.estado='ausente' THEN 1 ELSE 0 END) AS ausentes,
                      SUM(CASE WHEN a.estado='tardanza' THEN 1 ELSE 0 END) AS tardanzas,
                      ROUND(SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END)/NULLIF(COUNT(DISTINCT a.id),0)*100,1) AS pct
               FROM estudiantes e LEFT JOIN asistencia a ON e.id=a.estudiante_id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               GROUP BY e.id, e.nombre
               ORDER BY SUBSTRING_INDEX(e.nombre,' ',-1) ASC`;
        titulo = "Resumen de Asistencia";
        columnas = ["N\xb0", "Nombre", "Presentes", "Ausentes", "Tardanzas", "% Asistencia"];
    } else if (tipo === "participaciones-resumen") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre,
                      COALESCE(ROUND(AVG(NULLIF(p.puntuacion,0)),1),0) AS promedio,
                      COUNT(p.id) AS total
               FROM estudiantes e LEFT JOIN participaciones p ON e.id=p.estudiante_id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               GROUP BY e.id, e.nombre
               ORDER BY SUBSTRING_INDEX(e.nombre,' ',-1) ASC`;
        titulo = "Resumen de Participaciones";
        columnas = ["N\xb0", "Nombre", "Promedio Participacion", "Total Registros"];
    } else {
        return res.status(400).json({ error: "Tipo no valido." });
    }

    db.query(sql, params, function(err, rows) {
        if (err) return res.status(500).json({ error: "Error al generar PDF." });
        const margin = landscape ? 30 : 40;
        const doc = new PDFKit({ margin, layout: landscape ? 'landscape' : 'portrait' });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${tipo}.pdf"`);
        doc.pipe(res);
        doc.fontSize(16).fillColor("#0d2352").text(titulo, { align: "center" });
        doc.fontSize(9).fillColor("#666").text("Sistema de Registro de Grado Digital - MINERD", { align: "center" });
        doc.moveDown(0.5);

        const usableW = doc.page.width - margin * 2;
        let colWidths;
        if (tipo === "calificaciones") {
            colWidths = [28, 155, 130, 30, 30, 30, 30, 55, 75];
        } else {
            const cw = usableW / columnas.length;
            colWidths = columnas.map(() => cw);
        }
        const totalW = colWidths.reduce((a, b) => a + b, 0);

        let y = doc.y;
        doc.rect(margin, y, totalW, 20).fill("#0d2352");
        columnas.forEach(function(col, i) {
            const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.fillColor("#fff").fontSize(8).text(col, x + 3, y + 6, { width: colWidths[i] - 6 });
        });
        y += 22;

        let nRow = 0, currentGroup = null;
        rows.forEach(function(row) {
            const raw = Object.values(row);
            let vals;

            if (tipo === "calificaciones") {
                if (!aulaId) {
                    const group = raw[1] + " " + raw[2];
                    if (group !== currentGroup) {
                        currentGroup = group;
                        if (y > doc.page.height - 80) { doc.addPage(); y = margin + 10; }
                        doc.rect(margin, y, totalW, 18).fill("#dde8f5");
                        doc.fillColor("#0d2352").fontSize(8)
                           .text("  " + raw[1] + " Secc. " + raw[2], margin + 6, y + 5, { width: totalW - 12 });
                        y += 20;
                    }
                }
                nRow++;
                vals = [nRow, raw[0], raw[3], raw[4], raw[5], raw[6], raw[7], raw[8], raw[9]];
            } else if (columnas[0] === "N\xb0") {
                nRow++;
                vals = [nRow].concat(raw);
            } else {
                nRow++;
                vals = raw;
            }

            if (y > doc.page.height - 60) { doc.addPage(); y = margin + 10; }
            doc.rect(margin, y, totalW, 18).fill(nRow % 2 === 0 ? "#f4f7ff" : "#ffffff");
            vals.forEach(function(val, i) {
                if (i >= colWidths.length) return;
                const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
                doc.fillColor("#333").fontSize(8).text(
                    val !== null && val !== undefined ? String(val) : "-",
                    x + 3, y + 4, { width: colWidths[i] - 6 }
                );
            });
            y += 20;
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
    const aulaId = req.query.aulaId ? parseInt(req.query.aulaId) : null;
    let sql = "", titulo = "", columnas = [], params = [];

    if (tipo === "estudiantes") {
        sql = "SELECT nombre, matricula, grado, seccion, tutor, telefono, direccion FROM estudiantes WHERE activo=1 ORDER BY nombre";
        titulo = "Estudiantes";
        columnas = ["Nombre", "Matricula", "Grado", "Seccion", "Tutor", "Telefono", "Direccion"];
    } else if (tipo === "calificaciones") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre AS estudiante, e.grado, e.seccion, c.asignatura,
                      COALESCE(c.nota1,0) AS p1, COALESCE(c.nota2,0) AS p2,
                      COALESCE(c.nota3,0) AS p3, COALESCE(c.nota4,0) AS p4,
                      COALESCE(c.promedio_redondeado,0) AS promedio,
                      CASE WHEN c.promedio_redondeado>=70 THEN 'Aprobado'
                           WHEN c.promedio_redondeado>0 THEN 'Recuperacion'
                           ELSE '-' END AS condicion
               FROM calificaciones c JOIN estudiantes e ON c.estudiante_id=e.id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               ORDER BY e.grado, e.seccion, SUBSTRING_INDEX(e.nombre,' ',-1), c.asignatura`;
        titulo = "Notas";
        columnas = ["N\xb0", "Estudiante", "Asignatura", "P1", "P2", "P3", "P4", "Promedio", "Condicion"];
    } else if (tipo === "asistencia") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre AS estudiante, DATE_FORMAT(a.fecha,'%d/%m/%Y') AS fecha, a.estado, a.observacion
               FROM asistencia a JOIN estudiantes e ON a.estudiante_id=e.id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               ORDER BY a.fecha DESC, e.nombre`;
        titulo = "Asistencia";
        columnas = ["Estudiante", "Fecha", "Estado", "Observacion"];
    } else if (tipo === "asistencia-resumen") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre,
                      SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END) AS presentes,
                      SUM(CASE WHEN a.estado='ausente' THEN 1 ELSE 0 END) AS ausentes,
                      SUM(CASE WHEN a.estado='tardanza' THEN 1 ELSE 0 END) AS tardanzas,
                      ROUND(SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END)/NULLIF(COUNT(DISTINCT a.id),0)*100,1) AS pct
               FROM estudiantes e LEFT JOIN asistencia a ON e.id=a.estudiante_id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               GROUP BY e.id, e.nombre
               ORDER BY SUBSTRING_INDEX(e.nombre,' ',-1) ASC`;
        titulo = "Asistencia Resumen";
        columnas = ["N\xb0", "Nombre", "Presentes", "Ausentes", "Tardanzas", "% Asistencia"];
    } else if (tipo === "participaciones-resumen") {
        if (aulaId) params.push(aulaId);
        sql = `SELECT e.nombre,
                      COALESCE(ROUND(AVG(NULLIF(p.puntuacion,0)),1),0) AS promedio,
                      COUNT(p.id) AS total
               FROM estudiantes e LEFT JOIN participaciones p ON e.id=p.estudiante_id
               WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
               GROUP BY e.id, e.nombre
               ORDER BY SUBSTRING_INDEX(e.nombre,' ',-1) ASC`;
        titulo = "Participaciones Resumen";
        columnas = ["N\xb0", "Nombre", "Promedio Participacion", "Total Registros"];
    } else {
        return res.status(400).json({ error: "Tipo no valido." });
    }

    db.query(sql, params, async function(err, rows) {
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
        let nRow = 0, currentGroup = null;
        rows.forEach(function(row) {
            const raw = Object.values(row).map(v => v !== null && v !== undefined ? v : "-");
            let vals;
            if (tipo === "calificaciones") {
                if (!aulaId) {
                    const group = String(raw[1]) + " " + String(raw[2]);
                    if (group !== currentGroup) {
                        currentGroup = group;
                        const sub = worksheet.addRow([String(raw[1]) + " Secc. " + String(raw[2])]);
                        sub.eachCell(function(cell) {
                            cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFD8E8F5" } };
                            cell.font = { bold:true, color:{ argb:"FF0D2352" }, size:10 };
                        });
                        sub.height = 18;
                        const rn = worksheet.rowCount;
                        worksheet.mergeCells(rn, 1, rn, columnas.length);
                    }
                }
                nRow++;
                vals = [nRow, raw[0], raw[3], raw[4], raw[5], raw[6], raw[7], raw[8], raw[9]];
            } else if (columnas[0] === "N\xb0") {
                nRow++;
                vals = [nRow].concat(raw);
            } else {
                nRow++;
                vals = raw;
            }
            const dataRow = worksheet.addRow(vals);
            dataRow.eachCell(function(cell) {
                cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: nRow % 2 === 0 ? "FFF4F7FF" : "FFFFFFFF" } };
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

// =============================================
//  BOLETÍN ESTUDIANTIL MINERD
// =============================================

app.get("/api/exportar/boletin/pdf/:estudianteId", function(req, res) {
    const estudianteId = parseInt(req.params.estudianteId);
    if (isNaN(estudianteId)) return res.status(400).json({ error: "ID de estudiante inválido." });

    // Obtener configuración del centro
    db.query("SELECT * FROM configuracion LIMIT 1", function(err, config) {
        if (err || !config.length) return res.status(500).json({ error: "Error al obtener configuración." });
        const cfg = config[0];

        // Obtener datos del estudiante
        db.query(
            "SELECT * FROM estudiantes WHERE id = ? AND activo = 1",
            [estudianteId], function(err1, estudiantes) {
                if (err1 || !estudiantes.length)
                    return res.status(404).json({ error: "Estudiante no encontrado." });
                const est = estudiantes[0];

                // Obtener calificaciones del estudiante (consulta robusta: no asumir anio_escolar obligatorio)
                // Obtener calificaciones del estudiante. No dependemos de la columna asignacion_id
                // (algunas instalaciones antiguas pueden no tenerla). En su lugar, intentamos
                // resolver el nombre del maestro por asignatura + aula mediante subconsulta.
                // Prefer JOIN with fallback: link calificaciones -> asignaciones (por asignatura + aula) -> maestros
                // Si no existe asignacion para esa asignatura/aula, maestro_nombre quedará NULL.
                const sqlCalifs = `
                    SELECT c.*, m.nombre AS maestro_nombre
                    FROM calificaciones c
                    LEFT JOIN asignaciones a ON a.asignatura COLLATE utf8mb4_0900_ai_ci = c.asignatura COLLATE utf8mb4_0900_ai_ci
                        AND a.aula_id = ?
                    LEFT JOIN maestros m ON m.id = a.maestro_id
                    WHERE c.estudiante_id = ?
                    ORDER BY c.asignatura
                `;

                db.query(sqlCalifs, [est.aula_id || null, estudianteId], function(err2, calificaciones) {
                    if (err2) {
                        console.error("Error consulta calificaciones (boletin - join):", err2.message);
                        return res.status(500).json({ error: "Error al obtener calificaciones.", detalle: err2.message });
                    }

                        // Obtener resumen de asistencia del período
                        db.query(
                            `SELECT estado, COUNT(*) as cantidad
                             FROM asistencia
                             WHERE estudiante_id = ? AND YEAR(fecha) = YEAR(CURDATE())
                             GROUP BY estado`,
                            [estudianteId], function(err3, asistencia) {
                                if (err3) return res.status(500).json({ error: "Error al obtener asistencia." });

                                db.query(
                                    `SELECT AVG(puntuacion) AS promedio_participacion
                                     FROM participaciones
                                     WHERE estudiante_id = ? AND YEAR(fecha) = YEAR(CURDATE())`,
                                    [estudianteId], function(err4, participacionRows) {
                                        if (err4) return res.status(500).json({ error: "Error al obtener participaciones." });
                                        const promedioParticipacion = (participacionRows && participacionRows[0] && participacionRows[0].promedio_participacion != null)
                                            ? parseFloat(participacionRows[0].promedio_participacion).toFixed(2)
                                            : "S.D.";

                                        // Calcular promedio
                                        const finales = calificaciones
                                            .filter(c => c.final !== null)
                                            .map(c => parseFloat(c.final));
                                        const promedio = finales.length > 0
                                            ? (finales.reduce((a, b) => a + b, 0) / finales.length).toFixed(2)
                                            : "S.D.";

                                        // Estructurar datos de asistencia
                                        const stats = { presente: 0, ausente: 0, tardanza: 0, excusa: 0 };
                                        asistencia.forEach(a => {
                                            if (stats[a.estado] !== undefined) stats[a.estado] = a.cantidad;
                                        });

                                        // Generar PDF
                                        const doc = new PDFKit({ margin: 40, size: 'letter' });
                                res.setHeader("Content-Type", "application/pdf");
                                res.setHeader("Content-Disposition", `attachment; filename="boletin_${est.matricula}.pdf"`);
                                doc.pipe(res);

                                // Encabezado MINERD
                                doc.fontSize(14).fillColor("#0d2352").text("MINISTERIO DE EDUCACIÓN", { align: "center" });
                                doc.fontSize(12).fillColor("#0d2352").text("REPÚBLICA DOMINICANA", { align: "center" });
                                doc.moveDown(0.3);
                                doc.fontSize(11).fillColor("#333").text(cfg.nombre_centro || "Centro Educativo", { align: "center" });
                                doc.fontSize(9).fillColor("#666").text(`Año Escolar: ${cfg.anio_escolar}`, { align: "center" });
                                doc.moveDown(0.5);

                                // Línea separadora
                                doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke("#0d2352");
                                doc.moveDown(0.5);

                                // Título
                                doc.fontSize(14).fillColor("#0d2352").text("BOLETÍN ESTUDIANTIL", { align: "center" });
                                doc.moveDown(0.5);

                                // Datos del estudiante y del centro en formato de dos columnas
                                const infoTop = doc.y;
                                doc.lineWidth(1).strokeColor("#0d2352").rect(40, infoTop, 60, 60).stroke();
                                doc.fontSize(8).fillColor("#0d2352").text("ESCUDO\nMINERD", 40, infoTop + 16, { width: 60, align: "center" });

                                const leftCol = 110;
                                const rightCol = doc.page.width / 2 + 20;
                                const infoLineGap = 16;

                                doc.font("Helvetica-Bold").fontSize(10).fillColor("#0d2352").text("DATOS DEL ESTUDIANTE", leftCol, infoTop);
                                doc.font("Helvetica").fontSize(9).fillColor("#333");
                                doc.text(`Nombre: ${est.nombre}`, leftCol, infoTop + infoLineGap);
                                doc.text(`Matrícula: ${est.matricula}`, leftCol, infoTop + infoLineGap * 2);
                                doc.text(`Grado y Sección: ${est.grado}${est.seccion ? ' - ' + est.seccion : ''}`, leftCol, infoTop + infoLineGap * 3);
                                doc.text(`Tutor: ${est.tutor || "N/A"}`, leftCol, infoTop + infoLineGap * 4);
                                doc.text(`Teléfono: ${est.telefono || "N/A"}`, leftCol, infoTop + infoLineGap * 5);

                                doc.font("Helvetica-Bold").fontSize(10).fillColor("#0d2352").text("DATOS DEL CENTRO", rightCol, infoTop);
                                doc.font("Helvetica").fontSize(9).fillColor("#333");
                                doc.text(`Centro: ${cfg.nombre_centro || "Centro Educativo"}`, rightCol, infoTop + infoLineGap);
                                doc.text(`Año Escolar: ${cfg.anio_escolar}`, rightCol, infoTop + infoLineGap * 2);
                                doc.text(`Director(a): ${cfg.director || "____________________"}`, rightCol, infoTop + infoLineGap * 3);
                                doc.text(`Distrito: ${cfg.distrito || "N/D"}`, rightCol, infoTop + infoLineGap * 4);
                                doc.text(`Regional: ${cfg.regional || "N/D"}`, rightCol, infoTop + infoLineGap * 5);

                                doc.moveDown(5);

                                // Tabla de Calificaciones con formato MINERD
                                doc.fontSize(10).fillColor("#0d2352").text("CALIFICACIONES", { underline: true });
                                doc.moveDown(0.3);

                                const tableTop = doc.y;
                                const colWidths = [140, 55, 55, 55, 55, 60, 85];
                                const headers = ["ASIGNATURA", "P1", "P2", "P3", "P4", "PROMEDIO", "CONDICIÓN"];

                                let tableX = 40;
                                doc.fontSize(9).fillColor("#ffffff");
                                doc.rect(40, tableTop, doc.page.width - 80, 20).fill("#0d2352");
                                headers.forEach((h, i) => {
                                    doc.text(h, tableX + 3, tableTop + 5, { width: colWidths[i] - 6, align: i > 0 ? "center" : "left" });
                                    tableX += colWidths[i];
                                });

                                let currentRow = tableTop + 22;
                                calificaciones.forEach((calif, idx) => {
                                    const bg = idx % 2 === 0 ? "#f4f7ff" : "#ffffff";
                                    tableX = 40;
                                    doc.rect(40, currentRow, doc.page.width - 80, 18).fill(bg);
                                    doc.fillColor("#333").fontSize(8);

                                    const nota1 = calif.nota1 != null ? Number(calif.nota1).toFixed(2) : "-";
                                    const nota2 = calif.nota2 != null ? Number(calif.nota2).toFixed(2) : "-";
                                    const nota3 = calif.nota3 != null ? Number(calif.nota3).toFixed(2) : "-";
                                    const nota4 = calif.nota4 != null ? Number(calif.nota4).toFixed(2) : "-";
                                    const promedioFinal = calif.promedio != null ? Number(calif.promedio).toFixed(2) : "-";
                                    const condicion = calif.promedio != null && !isNaN(Number(calif.promedio))
                                        ? (Number(calif.promedio) >= 70 ? "APROBADO" : "PENDIENTE")
                                        : "S/D";

                                    doc.text(calif.asignatura || "-", tableX + 3, currentRow + 3, { width: colWidths[0] - 6 });
                                    tableX += colWidths[0];
                                    doc.text(nota1, tableX, currentRow + 3, { width: colWidths[1] - 6, align: "center" });
                                    tableX += colWidths[1];
                                    doc.text(nota2, tableX, currentRow + 3, { width: colWidths[2] - 6, align: "center" });
                                    tableX += colWidths[2];
                                    doc.text(nota3, tableX, currentRow + 3, { width: colWidths[3] - 6, align: "center" });
                                    tableX += colWidths[3];
                                    doc.text(nota4, tableX, currentRow + 3, { width: colWidths[4] - 6, align: "center" });
                                    tableX += colWidths[4];
                                    doc.text(promedioFinal, tableX, currentRow + 3, { width: colWidths[5] - 6, align: "center" });
                                    tableX += colWidths[5];
                                    doc.text(condicion, tableX + 3, currentRow + 3, { width: colWidths[6] - 6, align: "center" });

                                    currentRow += 18;
                                    if (currentRow > doc.page.height - 140) {
                                        doc.addPage();
                                        currentRow = 40;
                                    }
                                });

                                doc.moveDown(0.5);
                                doc.fillColor("#0d2352").fontSize(10).text("RESUMEN DE ASISTENCIA", { underline: true });
                                doc.moveDown(0.3);
                                doc.fontSize(9).fillColor("#333");
                                doc.text(`Presentes: ${stats.presente}     Ausentes: ${stats.ausente}`);
                                doc.text(`Tardanzas: ${stats.tardanza}     Excusas: ${stats.excusa}`);

                                doc.moveDown(1);
                                doc.fillColor("#0d2352").fontSize(10).text("FIRMAS", { underline: true });
                                doc.moveDown(0.8);

                                const firmaStart = doc.y;
                                doc.moveTo(70, firmaStart + 30).lineTo(220, firmaStart + 30).stroke("#333");
                                doc.text("Maestro/Tutor", 70, firmaStart + 32, { width: 150, align: "center" });

                                doc.moveTo(320, firmaStart + 30).lineTo(470, firmaStart + 30).stroke("#333");
                                doc.text("Director(a)", 320, firmaStart + 32, { width: 150, align: "center" });

                                doc.moveDown(3);
                                doc.fontSize(8).fillColor("#666").text(`Generado el ${new Date().toLocaleDateString("es-DO")} a las ${new Date().toLocaleTimeString("es-DO")}`, { align: "right" });

                                doc.end();
                            });
                    });
            });
    });
});
});

app.get("/api/exportar/boletin/excel/:estudianteId", async function(req, res) {
    const estudianteId = parseInt(req.params.estudianteId);
    if (isNaN(estudianteId)) return res.status(400).json({ error: "ID de estudiante inválido." });

    try {
        const configRows = await queryAsync("SELECT * FROM configuracion LIMIT 1");
        const cfg = configRows && configRows.length ? configRows[0] : {};
        const estudiantes = await queryAsync("SELECT * FROM estudiantes WHERE id = ? AND activo = 1", [estudianteId]);
        if (!estudiantes.length) return res.status(404).json({ error: "Estudiante no encontrado." });
        const est = estudiantes[0];

        const calificaciones = await queryAsync("SELECT * FROM calificaciones WHERE estudiante_id = ? ORDER BY asignatura", [estudianteId]);
        const participacionRows = await queryAsync(
            "SELECT AVG(puntuacion) AS promedio_participacion FROM participaciones WHERE estudiante_id = ? AND YEAR(fecha) = YEAR(CURDATE())",
            [estudianteId]
        );
        const promedioParticipacion = (participacionRows[0] && participacionRows[0].promedio_participacion != null)
            ? parseFloat(participacionRows[0].promedio_participacion).toFixed(2)
            : "S.D.";

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Boletín", { pageSetup: { paperSize: 9, orientation: 'portrait' } });

        let row = 1;
        worksheet.mergeCells(`A${row}:D${row}`);
        worksheet.getCell(`A${row}`).value = "BOLETÍN ESTUDIANTIL MINERD";
        worksheet.getCell(`A${row}`).font = { bold: true, size: 14, color: { argb: "FF0D2352" } };
        worksheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "center" };

        row++;
        worksheet.mergeCells(`A${row}:D${row}`);
        worksheet.getCell(`A${row}`).value = cfg.nombre_centro || "Centro Educativo";
        worksheet.getCell(`A${row}`).font = { size: 11 };
        worksheet.getCell(`A${row}`).alignment = { horizontal: "center" };

        row += 2;
        worksheet.getCell(`A${row}`).value = "Estudiante:";
        worksheet.getCell(`B${row}`).value = est.nombre;
        row++;

        worksheet.getCell(`A${row}`).value = "Matrícula:";
        worksheet.getCell(`B${row}`).value = est.matricula;
        row++;

        worksheet.getCell(`A${row}`).value = "Grado:";
        worksheet.getCell(`B${row}`).value = est.grado;
        worksheet.getCell(`C${row}`).value = "Sección:";
        worksheet.getCell(`D${row}`).value = est.seccion;
        row++;

        worksheet.getCell(`A${row}`).value = "Tutor:";
        worksheet.getCell(`B${row}`).value = est.tutor || "N/A";
        row += 2;

        worksheet.getCell(`A${row}`).value = "CALIFICACIONES";
        worksheet.getCell(`A${row}`).font = { bold: true, size: 11 };
        row++;

        const headers = ["Asignatura", "P1", "P2", "Promedio"];
        headers.forEach((h, i) => {
            const cell = worksheet.getCell(row, i + 1);
            cell.value = h;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D2352" } };
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.alignment = { horizontal: "center", vertical: "center" };
        });
        row++;

        calificaciones.forEach((calif, idx) => {
            worksheet.getCell(row, 1).value = calif.asignatura;
            worksheet.getCell(row, 2).value = calif.parcial_1 !== null ? parseFloat(calif.parcial_1) : "-";
            worksheet.getCell(row, 3).value = calif.parcial_2 !== null ? parseFloat(calif.parcial_2) : "-";
            worksheet.getCell(row, 4).value = calif.final !== null ? parseFloat(calif.final) : "-";
            if (idx % 2 === 0) {
                for (let i = 1; i <= 4; i++) {
                    worksheet.getCell(row, i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FF" } };
                }
            }
            row++;
        });

        worksheet.getCell(`A${row}`).value = "PROMEDIO";
        worksheet.getCell(`B${row}`).value = est.promedio_general !== null ? parseFloat(est.promedio_general).toFixed(2) : "S.D.";
        worksheet.getCell(`A${row}`).font = { bold: true };
        row++;
        worksheet.getCell(`A${row}`).value = "PROMEDIO PARTICIPACIÓN";
        worksheet.getCell(`B${row}`).value = promedioParticipacion;
        worksheet.getCell(`A${row}`).font = { bold: true };

        worksheet.columns = [
            { width: 25 },
            { width: 12 },
            { width: 12 },
            { width: 12 }
        ];

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="boletin_${est.matricula}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("Error exportando boletín excel:", err);
        res.status(500).json({ error: "Error al generar Excel de boletín." });
    }
});

app.get("/api/exportar/boletin/excel", async function(req, res) {
    const estudianteId = req.query.estudianteId ? parseInt(req.query.estudianteId) : null;
    const grado = req.query.grado || null;
    const seccion = req.query.seccion || null;

    let whereClause = "WHERE e.activo = 1";
    let params = [];

    if (estudianteId) {
        whereClause += " AND e.id = ?";
        params.push(estudianteId);
    } else if (grado && seccion) {
        whereClause += " AND e.grado = ? AND e.seccion = ?";
        params.push(grado, seccion);
    }

    const sql = `SELECT e.*,
                    (SELECT COUNT(*) FROM calificaciones WHERE estudiante_id = e.id) as total_asignaturas,
                    (SELECT AVG(final) FROM calificaciones WHERE estudiante_id = e.id) as promedio_general
                 FROM estudiantes e
                 ${whereClause}
                 ORDER BY e.nombre`;

    db.query(sql, params, async function(err, estudiantes) {
        if (err) return res.status(500).json({ error: "Error al generar Excel de boletines." });
        if (!estudiantes.length) return res.status(404).json({ error: "No hay estudiantes para exportar." });

        const workbook = new ExcelJS.Workbook();

        // Obtener configuración
        db.query("SELECT * FROM configuracion LIMIT 1", async function(err0, config) {
            const cfg = config ? config[0] : {};

            // Para cada estudiante, crear una hoja con su boletín
            for (const est of estudiantes) {
                const sheetName = (est.nombre.substring(0, 20) || "Estudiante").replace(/[^a-zA-Z0-9 ]/g, "");
                const worksheet = workbook.addWorksheet(sheetName, { pageSetup: { paperSize: 9, orientation: 'portrait' } });

                // Encabezado
                let row = 1;
                worksheet.mergeCells(`A${row}:D${row}`);
                let cell = worksheet.getCell(`A${row}`);
                cell.value = "BOLETÍN ESTUDIANTIL MINERD";
                cell.font = { bold: true, size: 14, color: { argb: "FF0D2352" } };
                cell.alignment = { horizontal: "center", vertical: "center" };

                row++;
                worksheet.mergeCells(`A${row}:D${row}`);
                cell = worksheet.getCell(`A${row}`);
                cell.value = cfg.nombre_centro || "Centro Educativo";
                cell.font = { size: 11 };
                cell.alignment = { horizontal: "center" };

                row += 2;
                worksheet.getCell(`A${row}`).value = "Estudiante:";
                worksheet.getCell(`B${row}`).value = est.nombre;
                row++;

                worksheet.getCell(`A${row}`).value = "Matrícula:";
                worksheet.getCell(`B${row}`).value = est.matricula;
                row++;

                worksheet.getCell(`A${row}`).value = "Grado:";
                worksheet.getCell(`B${row}`).value = est.grado;
                worksheet.getCell(`C${row}`).value = "Sección:";
                worksheet.getCell(`D${row}`).value = est.seccion;
                row++;

                worksheet.getCell(`A${row}`).value = "Tutor:";
                worksheet.getCell(`B${row}`).value = est.tutor || "N/A";
                row += 2;

                // Tabla de calificaciones
                worksheet.getCell(`A${row}`).value = "CALIFICACIONES";
                worksheet.getCell(`A${row}`).font = { bold: true, size: 11 };
                row++;

                const headers = ["Asignatura", "P1", "P2", "Promedio"];
                headers.forEach((h, i) => {
                    const cell = worksheet.getCell(row, i + 1);
                    cell.value = h;
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D2352" } };
                    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                    cell.alignment = { horizontal: "center", vertical: "center" };
                });
                row++;

                // Calificaciones del estudiante
                db.query(
                    "SELECT * FROM calificaciones WHERE estudiante_id = ? ORDER BY asignatura",
                    [est.id], function(err, califs) {
                        if (err) califs = [];

                        califs.forEach((calif, idx) => {
                            worksheet.getCell(row, 1).value = calif.asignatura;
                            worksheet.getCell(row, 2).value = calif.parcial_1 !== null ? parseFloat(calif.parcial_1) : "-";
                            worksheet.getCell(row, 3).value = calif.parcial_2 !== null ? parseFloat(calif.parcial_2) : "-";
                            worksheet.getCell(row, 4).value = calif.final !== null ? parseFloat(calif.final) : "-";

                            if (idx % 2 === 0) {
                                for (let i = 1; i <= 4; i++) {
                                    worksheet.getCell(row, i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FF" } };
                                }
                            }
                            row++;
                        });

                        // Promedio
                        worksheet.getCell(row, 1).value = "PROMEDIO";
                        worksheet.getCell(row, 2).value = est.promedio_general !== null ? parseFloat(est.promedio_general).toFixed(2) : "S.D.";
                        worksheet.getCell(row, 1).font = { bold: true };

                        // Ajustar ancho de columnas
                        worksheet.columns = [
                            { width: 25 },
                            { width: 12 },
                            { width: 12 },
                            { width: 12 }
                        ];
                    }
                );
            }

            // Enviar archivo
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="boletines_${new Date().getTime()}.xlsx"`);
            await workbook.xlsx.write(res);
            res.end();
        });
    });
});

// =============================================
//  DASHBOARD - ESTADÍSTICAS
// =============================================

app.get("/api/dashboard/stats", function(req, res) {
    // Obtener configuración para año escolar
    db.query("SELECT anio_escolar FROM configuracion LIMIT 1", function(err, config) {
        const anioEscolar = config && config.length ? config[0].anio_escolar : "2025-2026";

        // Queries en paralelo
        const promises = [
            new Promise((resolve) => {
                db.query("SELECT COUNT(*) as total FROM estudiantes WHERE activo=1", function(err, rows) {
                    resolve(err ? 0 : (rows[0]?.total || 0));
                });
            }),
            new Promise((resolve) => {
                // Asistencia hoy
                db.query(`
                    SELECT
                        SUM(CASE WHEN estado='presente' THEN 1 ELSE 0 END) as presentes,
                        COUNT(*) as total
                    FROM asistencia WHERE DATE(fecha)=CURDATE()
                `, function(err, rows) {
                    if (err || !rows[0] || rows[0].total === 0) {
                        resolve(0);
                    } else {
                        resolve((rows[0].presentes / rows[0].total) * 100);
                    }
                });
            }),
            new Promise((resolve) => {
                // Promedio general — solo calificaciones con valor > 0
                db.query(`
                    SELECT ROUND(AVG(promedio_redondeado), 1) as promedio
                    FROM calificaciones
                    WHERE promedio_redondeado > 0 AND anio_escolar=?
                `, [anioEscolar], function(err, rows) {
                    resolve(err || !rows[0]?.promedio ? 0 : rows[0].promedio);
                });
            }),
            new Promise((resolve) => {
                // Alertas académicas — mismos criterios que la tabla Top 5
                db.query(`
                    SELECT COUNT(*) as total FROM (
                        SELECT e.id
                        FROM estudiantes e
                        LEFT JOIN calificaciones c ON e.id = c.estudiante_id AND c.promedio_redondeado > 0
                        LEFT JOIN asistencia a ON e.id = a.estudiante_id
                        WHERE e.activo = 1
                        GROUP BY e.id
                        HAVING
                            (COUNT(c.id) > 0 AND AVG(c.promedio_redondeado) < 70)
                            OR (COUNT(DISTINCT a.id) > 0
                                AND (SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END)
                                     / NULLIF(COUNT(DISTINCT a.id), 0)) * 100 < 80)
                    ) conteo
                `, function(err, rows) {
                    resolve(err ? 0 : (rows[0]?.total || 0));
                });
            }),
            new Promise((resolve) => {
                // Total aulas
                db.query("SELECT COUNT(*) as total FROM aulas", function(err, rows) {
                    resolve(err ? 0 : (rows[0]?.total || 0));
                });
            }),
            new Promise((resolve) => {
                // Total maestros activos
                db.query("SELECT COUNT(*) as total FROM maestros WHERE activo=1", function(err, rows) {
                    resolve(err ? 0 : (rows[0]?.total || 0));
                });
            })
        ];

        Promise.all(promises).then(([estudiantes, asistencia, promedio, alertas, aulas, maestros]) => {
            try {
                const asistenciaNum = Number(asistencia) || 0;
                const promedioNum = Number(promedio) || 0;
                res.json({
                    total_estudiantes: estudiantes,
                    asistencia_hoy: parseFloat(asistenciaNum.toFixed(1)),
                    promedio_general: parseFloat(promedioNum.toFixed(2)),
                    alertas_academicas: alertas,
                    total_aulas: aulas,
                    total_maestros: maestros
                });
            } catch (e) {
                console.error('Error formateando stats:', e.message);
                res.json({
                    total_estudiantes: estudiantes,
                    asistencia_hoy: 0,
                    promedio_general: 0,
                    alertas_academicas: alertas,
                    total_aulas: aulas,
                    total_maestros: maestros
                });
            }
        });
    });
});

app.get("/api/dashboard/asistencia-mensual", function(req, res) {
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                   "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const hoy = new Date();
    const hace6meses = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);

    const sql = `
        SELECT
            DATE_FORMAT(fecha, '%Y-%m') as periodo,
            MONTH(fecha) as mes,
            SUM(CASE WHEN estado='presente' THEN 1 ELSE 0 END) as presentes,
            COUNT(*) as total
        FROM asistencia
        WHERE fecha >= ?
        GROUP BY DATE_FORMAT(fecha, '%Y-%m')
        ORDER BY fecha ASC
        LIMIT 6
    `;

    db.query(sql, [hace6meses], function(err, rows) {
        if (err || !rows.length) {
            return res.json(Array(6).fill(0).map((_, i) => ({
                mes: meses[(hoy.getMonth() - 5 + i + 12) % 12],
                porcentaje: 0
            })));
        }

        const resultado = rows.map(r => ({
            mes: meses[r.mes - 1],
            porcentaje: r.total > 0 ? parseFloat(((r.presentes / r.total) * 100).toFixed(1)) : 0
        }));

        res.json(resultado);
    });
});

app.get("/api/dashboard/promedios-por-grado", function(req, res) {
    const grados = ["1ro", "2do", "3ro", "4to", "5to", "6to"];

    const sql = `
        SELECT
            e.grado,
            ROUND(AVG(c.promedio_redondeado), 1) as promedio
        FROM estudiantes e
        LEFT JOIN calificaciones c ON e.id = c.estudiante_id AND c.promedio_redondeado > 0
        WHERE e.activo = 1
        GROUP BY e.grado
    `;

        db.query(sql, function(err, rows) {
        if (err || !rows || rows.length === 0) {
            return res.json(grados.map(g => ({ grado: g, promedio: 0 })));
        }

        const mapa = {};
        rows.forEach(r => {
            const val = r.promedio !== null && r.promedio !== undefined ? Number(r.promedio) : 0;
            mapa[r.grado] = isFinite(val) ? parseFloat(val.toFixed(2)) : 0;
        });

        const resultado = grados.map(g => ({
            grado: g,
            promedio: mapa[g] || 0
        }));

        res.json(resultado);
    });
});

app.get("/api/dashboard/distribucion-notas", function(req, res) {
    db.query("SELECT anio_escolar FROM configuracion LIMIT 1", function(err, config) {
        const anioEscolar = config && config.length ? config[0].anio_escolar : "2025-2026";

        const sql = `
            SELECT
                CASE
                    WHEN promedio >= 90 THEN 'excelente'
                    WHEN promedio >= 80 THEN 'bueno'
                    WHEN promedio >= 70 THEN 'regular'
                    ELSE 'bajo'
                END as categoria,
                COUNT(*) as cantidad
            FROM (
                SELECT e.id, ROUND(AVG(c.promedio_redondeado), 1) as promedio
                FROM estudiantes e
                LEFT JOIN calificaciones c ON e.id = c.estudiante_id
                    AND c.anio_escolar = ? AND c.promedio_redondeado > 0
                WHERE e.activo = 1
                GROUP BY e.id
                HAVING AVG(c.promedio_redondeado) IS NOT NULL
            ) as stats
            GROUP BY categoria
        `;

        db.query(sql, [anioEscolar], function(err, rows) {
            const result = {
                excelente: 0,
                bueno: 0,
                regular: 0,
                bajo: 0
            };

            if (!err && rows && rows.length) {
                rows.forEach(r => {
                    result[r.categoria] = Number(r.cantidad) || 0;
                });
            }

            res.json(result);
        });
    });
});

app.get("/api/dashboard/alertas-academicas", function(req, res) {
    const sql = `
        SELECT
            e.id,
            e.nombre,
            e.grado,
            e.seccion,
            ROUND(AVG(CASE WHEN c.promedio_redondeado > 0 THEN c.promedio_redondeado ELSE NULL END), 1) AS promedio,
            ROUND(
                SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END) /
                NULLIF(COUNT(DISTINCT a.id), 0) * 100, 1
            ) AS asistencia
        FROM estudiantes e
        LEFT JOIN calificaciones c ON e.id = c.estudiante_id AND c.promedio_redondeado > 0
        LEFT JOIN asistencia a ON e.id = a.estudiante_id
        WHERE e.activo = 1
        GROUP BY e.id, e.nombre, e.grado, e.seccion
        HAVING
            (COUNT(c.id) > 0 AND AVG(CASE WHEN c.promedio_redondeado > 0 THEN c.promedio_redondeado ELSE NULL END) < 70)
            OR (COUNT(DISTINCT a.id) > 0
                AND SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END) /
                    NULLIF(COUNT(DISTINCT a.id), 0) * 100 < 80)
        ORDER BY 5 ASC
    `;

    db.query(sql, function(err, rows) {
        if (err) {
            console.error("Error en alertas-academicas:", err.message, err.sqlMessage || "");
            return res.status(500).json({ error: "Error al obtener alertas academicas.", detalle: err.message });
        }
        const alertas = (rows || []).map(r => ({
            id: r.id,
            nombre: r.nombre,
            grado: r.grado,
            seccion: r.seccion || "—",
            promedio: r.promedio,
            asistencia: r.asistencia
        }));
        res.json(alertas);
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
                                "SELECT id, DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha, puntuacion, observacion, descripcion FROM participaciones WHERE estudiante_id=? ORDER BY fecha DESC",
                                [id], function(err4, parts) {
                                    if (err4) return res.status(500).json({ error: "Error al obtener participaciones." });
                                    const stats = { presente:0, ausente:0, tardanza:0, excusa:0 };
                                    asist.forEach(function(a) { if (stats[a.estado] !== undefined) stats[a.estado]++; });
                                    const finales = califs.filter(function(c) { return c.promedio !== null; }).map(function(c) { return parseFloat(c.promedio); });
                                    const promedio = finales.length ? (finales.reduce(function(a,b){return a+b;},0)/finales.length).toFixed(1) : null;
                                    const participacionScores = parts
                                        .filter(function(p) { return p.puntuacion !== null && p.puntuacion > 0; })
                                        .map(function(p) { return Number(p.puntuacion); });
                                    const promedio_participacion = participacionScores.length
                                        ? (participacionScores.reduce(function(a,b){return a+b;},0) / participacionScores.length).toFixed(1)
                                        : null;
                                    res.json({
                                        estudiante:          est,
                                        calificaciones:      califs,
                                        asistencia:          { stats: stats, detalle: asist.slice(0, 10) },
                                        participaciones:     parts,
                                        promedio_general:    promedio,
                                        promedio_participacion: promedio_participacion
                                    });
                                });
                        });
                });
        });
});

app.post("/api/participaciones", function(req, res) {
    const { estudiante_id, fecha, puntuacion, observacion, descripcion, registrado_por } = req.body;
    if (!estudiante_id || !fecha)
        return res.status(400).json({ error: "Estudiante y fecha son obligatorios." });
    const nota = Number(puntuacion);
    const valorPuntuacion = !isNaN(nota) && nota > 0 ? Math.min(5, Math.max(1, nota)) : 0;
    const observacionText = typeof observacion === 'string' ? observacion.trim() : (typeof descripcion === 'string' ? descripcion.trim() : "");
    db.query(
        "INSERT INTO participaciones (estudiante_id, fecha, puntuacion, observacion, descripcion, registrado_por) VALUES (?,?,?,?,?,?)",
        [estudiante_id, fecha, valorPuntuacion, observacionText, observacionText, registrado_por || null],
        function(err, result) {
            if (err) return res.status(500).json({ error: "Error al guardar participacion." });
            res.json({ ok: true, id: result.insertId });
        });
});

app.get("/api/participaciones/aula/:aulaId/fecha/:fecha", function(req, res) {
    const aulaId = parseInt(req.params.aulaId);
    const fecha = req.params.fecha;
    if (isNaN(aulaId) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha)) {
        return res.status(400).json({ error: "Aula o fecha inválida." });
    }
    db.query(
        `SELECT p.id, p.estudiante_id, p.fecha, p.puntuacion, p.observacion, p.descripcion,
                e.nombre AS estudiante_nombre,
                ROW_NUMBER() OVER (PARTITION BY e.aula_id ORDER BY SUBSTRING_INDEX(e.nombre, ' ', -1) ASC) AS orden
         FROM participaciones p
         JOIN estudiantes e ON e.id = p.estudiante_id
         WHERE e.aula_id = ? AND p.fecha = ? AND e.activo = 1
         ORDER BY SUBSTRING_INDEX(e.nombre, ' ', -1) ASC`,
        [aulaId, fecha], function(err, rows) {
            if (err) return res.status(500).json({ error: "Error al obtener participaciones por aula." });
            res.json(rows || []);
        });
});

app.get("/api/participaciones/:estudianteId", function(req, res) {
    const estudianteId = parseInt(req.params.estudianteId);
    if (isNaN(estudianteId)) return res.status(400).json({ error: "ID de estudiante inválido." });
    db.query(
        "SELECT id, DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha, puntuacion, observacion, descripcion FROM participaciones WHERE estudiante_id=? ORDER BY fecha DESC",
        [estudianteId], function(err, rows) {
            if (err) return res.status(500).json({ error: "Error al obtener participaciones." });
            res.json(rows || []);
        });
});

app.delete("/api/participaciones/:id", function(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido." });
    db.query("DELETE FROM participaciones WHERE id = ?", [id], function(err, result) {
        if (err) return res.status(500).json({ error: "Error al eliminar participacion." });
        if (result.affectedRows === 0) return res.status(404).json({ error: "Participacion no encontrada." });
        res.json({ ok: true });
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
//  REPORTES JSON (para front-end)
// =============================================
app.get("/api/reportes/calificaciones", function(req, res) {
    const aulaId = req.query.aulaId ? parseInt(req.query.aulaId) : null;
    const params = aulaId ? [aulaId] : [];
    const sql = `
        SELECT e.nombre AS nombre_estudiante, e.grado, e.seccion, c.asignatura,
               COALESCE(c.nota1,0) AS nota1, COALESCE(c.nota2,0) AS nota2,
               COALESCE(c.nota3,0) AS nota3, COALESCE(c.nota4,0) AS nota4,
               COALESCE(c.promedio_redondeado,0) AS promedio,
               CASE WHEN c.promedio_redondeado>=70 THEN 'Aprobado'
                    WHEN c.promedio_redondeado>0 THEN 'Recuperacion'
                    ELSE '-' END AS condicion
        FROM calificaciones c JOIN estudiantes e ON c.estudiante_id=e.id
        WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
        ORDER BY e.grado, e.seccion, SUBSTRING_INDEX(e.nombre,' ',-1), c.asignatura`;
    db.query(sql, params, function(err, rows) {
        if (err) return res.status(500).json({ error: "Error al obtener reporte de calificaciones." });
        res.json(rows);
    });
});

app.get("/api/reportes/asistencia-resumen", function(req, res) {
    const aulaId = req.query.aulaId ? parseInt(req.query.aulaId) : null;
    const params = aulaId ? [aulaId] : [];
    const sql = `
        SELECT e.nombre, e.grado, e.seccion,
               SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END) AS presentes,
               SUM(CASE WHEN a.estado='ausente' THEN 1 ELSE 0 END) AS ausentes,
               SUM(CASE WHEN a.estado='tardanza' THEN 1 ELSE 0 END) AS tardanzas,
               ROUND(SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END)/NULLIF(COUNT(DISTINCT a.id),0)*100,1) AS pct_asistencia
        FROM estudiantes e LEFT JOIN asistencia a ON e.id=a.estudiante_id
        WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
        GROUP BY e.id, e.nombre, e.grado, e.seccion
        ORDER BY e.grado, e.seccion, SUBSTRING_INDEX(e.nombre,' ',-1) ASC`;
    db.query(sql, params, function(err, rows) {
        if (err) return res.status(500).json({ error: "Error al obtener resumen de asistencia." });
        res.json(rows);
    });
});

app.get("/api/reportes/participaciones-resumen", function(req, res) {
    const aulaId = req.query.aulaId ? parseInt(req.query.aulaId) : null;
    const params = aulaId ? [aulaId] : [];
    const sql = `
        SELECT e.nombre, e.grado, e.seccion,
               COALESCE(ROUND(AVG(NULLIF(p.puntuacion,0)),1),0) AS promedio_participacion,
               COUNT(p.id) AS total_registros
        FROM estudiantes e LEFT JOIN participaciones p ON e.id=p.estudiante_id
        WHERE e.activo=1 ${aulaId ? 'AND e.aula_id=?' : ''}
        GROUP BY e.id, e.nombre, e.grado, e.seccion
        ORDER BY e.grado, e.seccion, SUBSTRING_INDEX(e.nombre,' ',-1) ASC`;
    db.query(sql, params, function(err, rows) {
        if (err) return res.status(500).json({ error: "Error al obtener resumen de participaciones." });
        res.json(rows);
    });
});

// =============================================
//  INICIAR SERVIDOR
// =============================================
app.listen(PORT, function() {
    console.log("Servidor corriendo en http://localhost:" + PORT);
});

// Endpoint de diagnóstico: Describe calificaciones (útil para verificar esquema en producción)
app.get("/api/debug/calificaciones/describe", function(req, res) {
    db.query("DESCRIBE calificaciones", function(err, rows) {
        if (err) return res.status(500).json({ error: "Error al describir calificaciones.", detalle: err.message });
        res.json(rows);
    });
});