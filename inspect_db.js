
const { pool } = require('./src/config/db');
async function check() {
    try {
        const [p] = await pool.query('SELECT count(*) as total FROM productos');
        const [c] = await pool.query('SELECT count(*) as total FROM categorias');
        const [m] = await pool.query('SELECT count(*) as total FROM marcas_moto');
        console.log('ESTADO_DB:', { productos: p[0].total, categorias: c[0].total, marcas: m[0].total });
    } catch(e) {
        console.error('ERROR_DB:', e.message);
    }
    process.exit(0);
}
check();
