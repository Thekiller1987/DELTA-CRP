const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const [salesRes] = await pool.query(`
            SELECT 
                COALESCE(SUM(total), 0) AS total_ventas,
                COUNT(id) AS total_pedidos
            FROM pedidos 
            WHERE estado != 'cancelado'
        `);

        const [statesRes] = await pool.query(`
            SELECT estado, COUNT(id) AS cantidad 
            FROM pedidos 
            GROUP BY estado
        `);

        const stateCounts = {
            nuevo: 0,
            confirmado: 0,
            en_preparacion: 0,
            en_ruta: 0,
            entregado: 0,
            cancelado: 0
        };
        statesRes.forEach(r => stateCounts[r.estado] = r.cantidad);

        const [lowStock] = await pool.query(`
            SELECT id, codigo, nombre, stock, stock_minimo, precio 
            FROM productos 
            WHERE stock <= stock_minimo AND activo = TRUE
            ORDER BY stock ASC
        `);

        const [topProducts] = await pool.query(`
            SELECT dp.nombre_producto, SUM(dp.cantidad) as total_vendido, SUM(dp.subtotal) as total_recaudado
            FROM detalle_pedidos dp
            INNER JOIN pedidos p ON dp.pedido_id = p.id
            WHERE p.estado != 'cancelado'
            GROUP BY dp.producto_id, dp.nombre_producto
            ORDER BY total_vendido DESC
            LIMIT 5
        `);

        const [prodCount] = await pool.query('SELECT COUNT(id) as total FROM productos WHERE activo = TRUE');

        res.json({
            success: true,
            data: {
                total_ventas: salesRes[0].total_ventas,
                total_pedidos: salesRes[0].total_pedidos,
                estados: stateCounts,
                productos_alerta_stock: lowStock,
                total_alertas_stock: lowStock.length,
                top_productos: topProducts,
                total_catalogo: prodCount[0].total
            }
        });
    } catch (err) {
        console.error('Error obteniendo stats:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
