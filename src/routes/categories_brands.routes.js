const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/categories
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT c.*, COUNT(p.id) AS total_productos
            FROM categorias c
            LEFT JOIN productos p ON c.id = p.categoria_id AND p.activo = TRUE
            WHERE c.activo = TRUE
            GROUP BY c.id
            ORDER BY c.id ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/brands
router.get('/brands', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT m.*, COUNT(p.id) AS total_productos
            FROM marcas_moto m
            LEFT JOIN productos p ON m.id = p.marca_moto_id AND p.activo = TRUE
            WHERE m.activo = TRUE
            GROUP BY m.id
            ORDER BY m.popularidad DESC, m.nombre ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
