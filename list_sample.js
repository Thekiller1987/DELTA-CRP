
const { pool } = require('./src/config/db');
async function list() {
    try {
        const [rows] = await pool.query('SELECT p.id, p.codigo, p.nombre, p.precio, p.stock, c.nombre as categoria, m.nombre as marca FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN marcas_moto m ON p.marca_moto_id = m.id LIMIT 10');
        console.log('PRODUCTOS_MUESTRA:', JSON.stringify(rows, null, 2));
    } catch(e) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
}
list();
