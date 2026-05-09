-- ============================================================
--  SISTEMA DE GESTIÓN ESCOLAR - MINERD
--  Esquema completo para Railway MySQL
--  Modelo: Aulas fijas + Maestros rotativos
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '-04:00'; -- Zona horaria República Dominicana (AST)

-- ============================================================
--  1. CONFIGURACIÓN INSTITUCIONAL
-- ============================================================
DROP TABLE IF EXISTS configuracion;
CREATE TABLE configuracion (
    id           INT          NOT NULL AUTO_INCREMENT,
    nombre_centro VARCHAR(200) NOT NULL DEFAULT 'Centro Educativo',
    anio_escolar VARCHAR(20)  NOT NULL DEFAULT '2025-2026',
    director     VARCHAR(150),
    direccion    VARCHAR(300),
    telefono     VARCHAR(20),
    distrito     VARCHAR(100),
    regional     VARCHAR(100),
    creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO configuracion (nombre_centro, anio_escolar, director, distrito, regional)
VALUES ('Centro Educativo', '2025-2026', '', '', '');

-- ============================================================
--  2. USUARIOS DEL SISTEMA
-- ============================================================
DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
    id         INT          NOT NULL AUTO_INCREMENT,
    nombre     VARCHAR(150) NOT NULL,
    usuario    VARCHAR(50)  NOT NULL,
    password   VARCHAR(255) NOT NULL,
    rol        ENUM('admin','director','docente','coordinador','secretaria')
               NOT NULL DEFAULT 'docente',
    activo     TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuario administrador por defecto (cambiar contraseña después)
INSERT INTO usuarios (nombre, usuario, password, rol)
VALUES ('Administrador', 'admin', 'admin123', 'admin');

-- ============================================================
--  3. AULAS FIJAS
--     Cada aula representa un grupo estable de estudiantes
--     identificado por grado + sección + año escolar.
-- ============================================================
DROP TABLE IF EXISTS aulas;
CREATE TABLE aulas (
    id           INT         NOT NULL AUTO_INCREMENT,
    grado        ENUM('1ro','2do','3ro','4to','5to','6to') NOT NULL,
    seccion      ENUM('A','B','C','D')                     NOT NULL,
    anio_escolar VARCHAR(20) NOT NULL DEFAULT '2025-2026',
    aula_numero  VARCHAR(20)          DEFAULT NULL,  -- ej. "Aula 3", "Bloque B-2"
    capacidad    TINYINT UNSIGNED     DEFAULT 35,
    creado_en    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_aula (grado, seccion, anio_escolar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aulas de ejemplo para el año 2025-2026
INSERT INTO aulas (grado, seccion, anio_escolar, aula_numero) VALUES
('1ro','A','2025-2026','Aula 1'),
('1ro','B','2025-2026','Aula 2'),
('2do','A','2025-2026','Aula 3'),
('2do','B','2025-2026','Aula 4'),
('3ro','A','2025-2026','Aula 5'),
('3ro','B','2025-2026','Aula 6'),
('4to','A','2025-2026','Aula 7'),
('4to','B','2025-2026','Aula 8'),
('5to','A','2025-2026','Aula 9'),
('5to','B','2025-2026','Aula 10'),
('6to','A','2025-2026','Aula 11'),
('6to','B','2025-2026','Aula 12');

-- ============================================================
--  4. MAESTROS (ROTATIVOS)
--     Un maestro puede estar asignado a varias aulas y
--     enseñar distintas asignaturas según la asignación.
-- ============================================================
DROP TABLE IF EXISTS maestros;
CREATE TABLE maestros (
    id           INT          NOT NULL AUTO_INCREMENT,
    usuario_id   INT                   DEFAULT NULL, -- vínculo opcional con usuarios
    nombre       VARCHAR(150) NOT NULL,
    cedula       VARCHAR(20)           DEFAULT NULL,
    especialidad VARCHAR(100)          DEFAULT NULL, -- asignatura principal
    telefono     VARCHAR(20)           DEFAULT NULL,
    email        VARCHAR(100)          DEFAULT NULL,
    activo       TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cedula (cedula),
    CONSTRAINT fk_maestro_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  5. ASIGNACIONES (MAESTRO → AULA → ASIGNATURA)
--     Controla qué maestro rotativo enseña qué asignatura
--     en cada aula fija durante el año escolar.
--     Restricción: una asignatura solo puede tener un maestro
--     por aula por año escolar.
-- ============================================================
DROP TABLE IF EXISTS asignaciones;
CREATE TABLE asignaciones (
    id           INT          NOT NULL AUTO_INCREMENT,
    maestro_id   INT          NOT NULL,
    aula_id      INT          NOT NULL,
    asignatura   VARCHAR(100) NOT NULL,
    anio_escolar VARCHAR(20)  NOT NULL DEFAULT '2025-2026',
    creado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asignacion (aula_id, asignatura, anio_escolar),
    CONSTRAINT fk_asign_maestro
        FOREIGN KEY (maestro_id) REFERENCES maestros (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_asign_aula
        FOREIGN KEY (aula_id)   REFERENCES aulas (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  6. ESTUDIANTES
--     Cada estudiante pertenece a un aula fija.
-- ============================================================
DROP TABLE IF EXISTS estudiantes;
CREATE TABLE estudiantes (
    id            INT          NOT NULL AUTO_INCREMENT,
    aula_id       INT                   DEFAULT NULL,
    nombre        VARCHAR(150) NOT NULL,
    matricula     VARCHAR(50)  NOT NULL,
    grado         ENUM('1ro','2do','3ro','4to','5to','6to') NOT NULL,
    seccion       ENUM('A','B','C','D')  DEFAULT NULL,
    tutor         VARCHAR(150)           DEFAULT NULL,
    telefono      VARCHAR(20)            DEFAULT NULL,
    direccion     VARCHAR(300)           DEFAULT NULL,
    observaciones TEXT                   DEFAULT NULL,
    activo        TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_matricula (matricula),
    CONSTRAINT fk_estudiante_aula
        FOREIGN KEY (aula_id) REFERENCES aulas (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  7. CALIFICACIONES
--     Vinculadas al estudiante y opcionalmente a la asignación
--     (maestro + aula + asignatura) para trazabilidad completa.
-- ============================================================
DROP TABLE IF EXISTS calificaciones;
CREATE TABLE calificaciones (
    id             INT            NOT NULL AUTO_INCREMENT,
    estudiante_id  INT            NOT NULL,
    asignacion_id  INT                     DEFAULT NULL, -- maestro responsable
    asignatura     VARCHAR(100)   NOT NULL,
    competencia    VARCHAR(200)            DEFAULT NULL,
    parcial_1      DECIMAL(5,2)            DEFAULT NULL,
    parcial_2      DECIMAL(5,2)            DEFAULT NULL,
    final          DECIMAL(5,2)            DEFAULT NULL, -- calculado: (p1+p2)/2
    observaciones  TEXT                    DEFAULT NULL,
    anio_escolar   VARCHAR(20)             DEFAULT '2025-2026',
    creado_en      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_calif_estudiante
        FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_calif_asignacion
        FOREIGN KEY (asignacion_id) REFERENCES asignaciones (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger: calcula automáticamente el promedio final al insertar
DELIMITER //
CREATE TRIGGER trg_calcular_final_insert
BEFORE INSERT ON calificaciones
FOR EACH ROW
BEGIN
    IF NEW.parcial_1 IS NOT NULL AND NEW.parcial_2 IS NOT NULL THEN
        SET NEW.final = ROUND((NEW.parcial_1 + NEW.parcial_2) / 2, 2);
    END IF;
END;
//

-- Trigger: recalcula el promedio final al actualizar parciales
CREATE TRIGGER trg_calcular_final_update
BEFORE UPDATE ON calificaciones
FOR EACH ROW
BEGIN
    IF NEW.parcial_1 IS NOT NULL AND NEW.parcial_2 IS NOT NULL THEN
        SET NEW.final = ROUND((NEW.parcial_1 + NEW.parcial_2) / 2, 2);
    END IF;
END;
//
DELIMITER ;

-- ============================================================
--  8. ASISTENCIA
--     Registro diario por estudiante.
--     La restricción UNIQUE evita duplicados por día.
-- ============================================================
DROP TABLE IF EXISTS asistencia;
CREATE TABLE asistencia (
    id              INT       NOT NULL AUTO_INCREMENT,
    estudiante_id   INT       NOT NULL,
    aula_id         INT                DEFAULT NULL,
    registrado_por  INT                DEFAULT NULL, -- usuario que registró
    fecha           DATE      NOT NULL,
    estado          ENUM('presente','ausente','tardanza','excusa')
                              NOT NULL DEFAULT 'presente',
    observacion     TEXT               DEFAULT NULL,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asistencia_dia (estudiante_id, fecha),
    CONSTRAINT fk_asist_estudiante
        FOREIGN KEY (estudiante_id)  REFERENCES estudiantes (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_asist_aula
        FOREIGN KEY (aula_id)        REFERENCES aulas (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_asist_usuario
        FOREIGN KEY (registrado_por) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  9. ÍNDICES ADICIONALES (rendimiento en consultas frecuentes)
-- ============================================================
CREATE INDEX idx_estudiantes_aula     ON estudiantes  (aula_id);
CREATE INDEX idx_estudiantes_grado    ON estudiantes  (grado, seccion);
CREATE INDEX idx_calif_estudiante     ON calificaciones (estudiante_id);
CREATE INDEX idx_calif_asignatura     ON calificaciones (asignatura);
CREATE INDEX idx_asist_fecha          ON asistencia   (fecha);
CREATE INDEX idx_asist_estudiante     ON asistencia   (estudiante_id);
CREATE INDEX idx_asignaciones_maestro ON asignaciones (maestro_id);
CREATE INDEX idx_asignaciones_aula    ON asignaciones (aula_id);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  FIN DEL ESQUEMA
-- ============================================================
