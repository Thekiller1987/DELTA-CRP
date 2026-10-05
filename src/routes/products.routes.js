const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/products (con filtros por categoría, marca de moto, búsqueda y destacados)
router.get('/', async (req, res) => {
    try {
        const { search, categoria, marca, min_precio, max_precio, destacado, limit = 50 } = req.query;

        let query = `
            SELECT p.id, p.codigo, p.nombre, p.descripcion, p.precio, p.precio_oferta,
                   p.stock, p.stock_minimo, p.color, p.modelo_compatible, p.imagen_base64,
                   p.caracteristicas, p.destacado, p.activo,
                   c.id AS categoria_id, c.nombre AS categoria_nombre, c.slug AS categoria_slug,
                   m.id AS marca_id, m.nombre AS marca_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN marcas_moto m ON p.marca_moto_id = m.id
            WHERE p.activo = TRUE
        `;
        const params = [];

        if (search) {
            query += ` AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.modelo_compatible LIKE ? OR p.descripcion LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (categoria) {
            query += ` AND (c.slug = ? OR c.id = ?)`;
            params.push(categoria, categoria);
        }

        if (marca) {
            query += ` AND (m.id = ? OR m.nombre LIKE ?)`;
            params.push(marca, `%${marca}%`);
        }

        if (min_precio) {
            query += ` AND p.precio >= ?`;
            params.push(parseFloat(min_precio));
        }

        if (max_precio) {
            query += ` AND p.precio <= ?`;
            params.push(parseFloat(max_precio));
        }

        if (destacado === 'true' || destacado === '1') {
            query += ` AND p.destacado = TRUE`;
        }

        query += ` ORDER BY p.destacado DESC, p.id DESC LIMIT ?`;
        params.push(parseInt(limit));

        const [products] = await pool.query(query, params);

        const formatted = products.map(p => ({
            ...p,
            caracteristicas: typeof p.caracteristicas === 'string' ? JSON.parse(p.caracteristicas || '{}') : p.caracteristicas
        }));

        res.json({ success: true, count: formatted.length, data: formatted });
    } catch (err) {
        console.error('Error listando productos:', err);
        res.status(500).json({ success: false, message: 'Error obteniendo catálogo' });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.*, c.nombre AS categoria_nombre, c.slug AS categoria_slug, m.nombre AS marca_nombre
             FROM productos p
             LEFT JOIN categorias c ON p.categoria_id = c.id
             LEFT JOIN marcas_moto m ON p.marca_moto_id = m.id
             WHERE p.id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Repuesto no encontrado' });
        }

        const p = rows[0];
        p.caracteristicas = typeof p.caracteristicas === 'string' ? JSON.parse(p.caracteristicas || '{}') : p.caracteristicas;
        res.json({ success: true, data: p });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/products (Crear nuevo producto con Base64 desde el CRM)
router.post('/', async (req, res) => {
    try {
        const {
            codigo, nombre, categoria_id, marca_moto_id, modelo_compatible,
            descripcion, precio, precio_oferta, stock, stock_minimo,
            color, caracteristicas, imagen_base64, destacado
        } = req.body;

        if (!codigo || !nombre || !categoria_id || !precio) {
            return res.status(400).json({ success: false, message: 'Código, nombre, categoría y precio son obligatorios.' });
        }

        const [result] = await pool.query(
            `INSERT INTO productos 
             (codigo, nombre, categoria_id, marca_moto_id, modelo_compatible, descripcion, precio, precio_oferta, stock, stock_minimo, color, caracteristicas, imagen_base64, destacado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                codigo, nombre, categoria_id, marca_moto_id || null, modelo_compatible || 'Universal',
                descripcion || '', parseFloat(precio), precio_oferta ? parseFloat(precio_oferta) : null,
                parseInt(stock || 0), parseInt(stock_minimo || 5), color || 'Estándar',
                JSON.stringify(caracteristicas || {}), imagen_base64 || null, destacado ? 1 : 0
            ]
        );

        await pool.query(
            `INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
             VALUES (?, 'entrada', ?, 0, ?, 'Alta inicial de producto en CRM', 'Admin')`,
            [result.insertId, parseInt(stock || 0), parseInt(stock || 0)]
        );

        res.status(201).json({ success: true, message: 'Repuesto agregado con éxito', id: result.insertId });
    } catch (err) {
        console.error('Error creando producto:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/products/:id (Actualizar producto o stock)
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const {
            codigo, nombre, categoria_id, marca_moto_id, modelo_compatible,
            descripcion, precio, precio_oferta, stock, stock_minimo,
            color, caracteristicas, imagen_base64, destacado, activo
        } = req.body;

        const [prev] = await pool.query('SELECT stock FROM productos WHERE id = ?', [id]);
        if (prev.length === 0) return res.status(404).json({ success: false, message: 'Producto no existe' });

        const prevStock = prev[0].stock;
        const newStock = stock !== undefined ? parseInt(stock) : prevStock;

        let query = 'UPDATE productos SET ';
        const updates = [];
        const params = [];

        if (codigo !== undefined) { updates.push('codigo = ?'); params.push(codigo); }
        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
        if (categoria_id !== undefined) { updates.push('categoria_id = ?'); params.push(categoria_id); }
        if (marca_moto_id !== undefined) { updates.push('marca_moto_id = ?'); params.push(marca_moto_id); }
        if (modelo_compatible !== undefined) { updates.push('modelo_compatible = ?'); params.push(modelo_compatible); }
        if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
        if (precio !== undefined) { updates.push('precio = ?'); params.push(parseFloat(precio)); }
        if (precio_oferta !== undefined) { updates.push('precio_oferta = ?'); params.push(precio_oferta ? parseFloat(precio_oferta) : null); }
        if (stock !== undefined) { updates.push('stock = ?'); params.push(newStock); }
        if (stock_minimo !== undefined) { updates.push('stock_minimo = ?'); params.push(parseInt(stock_minimo)); }
        if (color !== undefined) { updates.push('color = ?'); params.push(color); }
        if (caracteristicas !== undefined) { updates.push('caracteristicas = ?'); params.push(JSON.stringify(caracteristicas)); }
        if (imagen_base64 !== undefined) { updates.push('imagen_base64 = ?'); params.push(imagen_base64); }
        if (destacado !== undefined) { updates.push('destacado = ?'); params.push(destacado ? 1 : 0); }
        if (activo !== undefined) { updates.push('activo = ?'); params.push(activo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay datos para actualizar' });
        }

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);

        if (stock !== undefined && newStock !== prevStock) {
            const diff = newStock - prevStock;
            await pool.query(
                `INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
                 VALUES (?, 'ajuste', ?, ?, ?, 'Ajuste manual de inventario desde CRM', 'Admin')`,
                [id, Math.abs(diff), prevStock, newStock]
            );
        }

        res.json({ success: true, message: 'Repuesto actualizado correctamente' });
    } catch (err) {
        console.error('Error actualizando producto:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/products/:id (Soft delete)
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('UPDATE productos SET activo = FALSE WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Producto desactivado del catálogo' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
