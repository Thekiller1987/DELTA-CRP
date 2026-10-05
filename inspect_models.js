
const { pool } = require('./src/config/db');

async function inspect() {
    try {
        const [models] = await pool.query('SELECT m.id, m.nombre, m.cilindrada, b.nombre as marca FROM modelos_moto m JOIN marcas_moto b ON m.marca_id = b.id ORDER BY b.nombre, m.nombre');
        models.forEach(m => console.log(' - ' + m.marca + ' ' + m.nombre + ' (' + m.cilindrada + 'cc)'));
        process.exit(0);
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
inspect();
