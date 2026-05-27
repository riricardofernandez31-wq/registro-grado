require("dotenv").config();
const mysql = require("mysql2");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;
const nuevoPassword = process.argv[2] || "admin123";

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

bcrypt.hash(nuevoPassword, SALT_ROUNDS, function(err, hash) {
    if (err) {
        console.error("Error hashing password:", err.message);
        process.exit(1);
    }
    db.query("UPDATE usuarios SET password = ? WHERE usuario = 'admin'", [hash], function(err2, result) {
        if (err2) {
            console.error("Error actualizando usuario admin:", err2.message);
            process.exit(1);
        }
        if (result.affectedRows === 0) {
            console.warn("No se encontró el usuario 'admin' para actualizar.");
        } else {
            console.log(`Contraseña del usuario admin actualizada correctamente. Nuevo hash aplicado.`);
        }
        db.end();
    });
});
