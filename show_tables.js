
const { pool } = require('./src/config/db');
async function showTables() {
    const [rows] = await pool.query('SHOW TABLES');
    console.log('TABLAS_ACTUALES:', rows);
    process.exit(0);
}
showTables();
