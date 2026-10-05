
const { pool } = require('./src/config/db');
async function catBrands() {
    try {
        const [c] = await pool.query('SELECT id, nombre, slug FROM categorias');
        const [m] = await pool.query('SELECT id, nombre FROM marcas_moto');
        console.log('CATEGORIAS:', JSON.stringify(c));
        console.log('MARCAS:', JSON.stringify(m));
    } catch(e) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
}
catBrands();
