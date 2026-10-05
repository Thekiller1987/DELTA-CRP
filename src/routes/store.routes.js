const express = require('express');
const { pool } = require('../config/db');
const router = express.Router();

// GET /categories - Todas las categorías activas
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// GET /brands - Marcas de motocicletas
router.get('/brands', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM marcas_moto WHERE activo = 1 ORDER BY popularidad DESC, nombre ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener marcas:', error);
        res.status(500).json({ error: 'Error al obtener marcas' });
    }
});

// GET /motorcycles - Modelos de motos para el selector YMM
router.get('/motorcycles', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT m.id, m.nombre, m.cilindrada, m.anio_inicio, m.anio_fin, b.id AS marca_id, b.nombre AS marca
            FROM modelos_moto m
            JOIN marcas_moto b ON m.marca_moto_id = b.id
            ORDER BY b.nombre ASC, m.nombre ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener modelos de moto:', error);
        res.status(500).json({ error: 'Error al obtener modelos de moto' });
    }
});

// GET /products - Catálogo con filtros avanzados
router.get('/products', async (req, res) => {
    const { search, categoria_id, marca_moto_id, modelo, min_price, max_price, solo_ofertas, limit = 50, offset = 0 } = req.query;
    let query = `
        SELECT p.*, c.nombre AS categoria_nombre, b.nombre AS marca_nombre
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN marcas_moto b ON p.marca_moto_id = b.id
        WHERE p.activo = 1
    `;
    const params = [];

    if (search && search.trim() !== '') {
        query += ' AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.descripcion LIKE ? OR p.modelo_compatible LIKE ?)';
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term);
    }

    if (categoria_id) {
        query += ' AND p.categoria_id = ?';
        params.push(categoria_id);
    }

    if (marca_moto_id) {
        query += ' AND p.marca_moto_id = ?';
        params.push(marca_moto_id);
    }

    if (modelo && modelo.trim() !== '') {
        query += ' AND (p.modelo_compatible LIKE ? OR p.modelo_compatible LIKE "%Universal%")';
        params.push(`%${modelo.trim()}%`);
    }

    if (min_price) {
        query += ' AND p.precio >= ?';
        params.push(parseFloat(min_price));
    }

    if (max_price) {
        query += ' AND p.precio <= ?';
        params.push(parseFloat(max_price));
    }

    if (solo_ofertas === 'true' || solo_ofertas === '1') {
        query += ' AND p.precio_oferta IS NOT NULL AND p.precio_oferta < p.precio';
    }

    query += ' ORDER BY p.destacado DESC, p.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    try {
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// GET /products/:id - Ficha técnica completa de un repuesto
router.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT p.*, c.nombre AS categoria_nombre, b.nombre AS marca_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN marcas_moto b ON p.marca_moto_id = b.id
            WHERE p.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        const product = rows[0];
        if (typeof product.caracteristicas === 'string') {
            try { product.caracteristicas = JSON.parse(product.caracteristicas); } catch (e) {}
        }
        res.json(product);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

// POST /orders - Crear pedido con transacción ACID y envío gratis en Juigalpa
router.post('/orders', async (req, res) => {
    const {
        cliente_nombre,
        cliente_telefono,
        cliente_email = '',
        direccion_exacta,
        punto_referencia = '',
        tipo_entrega = 'domicilio_gratis_juigalpa',
        metodo_pago: rawMetodoPago,
        banco_transferencia = null,
        referencia_bancaria = null,
        comprobante_pago_base64 = null,
        paypal_order_id = null,
        notas_cliente = '',
        items
    } = req.body;

    const methodMap = {
        'contra_entrega': 'efectivo_contraentrega',
        'efectivo': 'efectivo_contraentrega',
        'efectivo_contraentrega': 'efectivo_contraentrega',
        'transferencia_bancaria': 'transferencia_bancaria',
        'transferencia': 'transferencia_bancaria',
        'tarjeta': 'tarjeta_online',
        'tarjeta_online': 'tarjeta_online',
        'paypal': 'paypal'
    };
    const metodo_pago = methodMap[rawMetodoPago] || 'efectivo_contraentrega';

    if (!cliente_nombre || !cliente_telefono || !direccion_exacta || !metodo_pago || !items || !items.length) {
        return res.status(400).json({ error: 'Datos incompletos para registrar el pedido' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let subtotal = 0;
        const validatedItems = [];

        // Validar existencias y calcular precios
        for (const item of items) {
            const [prodRows] = await connection.query('SELECT id, nombre, codigo, precio, precio_oferta, stock FROM productos WHERE id = ? FOR UPDATE', [item.producto_id]);
            if (prodRows.length === 0) {
                throw new Error(`El repuesto ID ${item.producto_id} ya no está disponible.`);
            }
            const prod = prodRows[0];
            const qty = parseInt(item.cantidad) || 1;
            if (prod.stock < qty) {
                throw new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}, Solicitado: ${qty}`);
            }
            const unitPrice = prod.precio_oferta ? parseFloat(prod.precio_oferta) : parseFloat(prod.precio);
            const lineSubtotal = unitPrice * qty;
            subtotal += lineSubtotal;

            validatedItems.push({
                producto_id: prod.id,
                nombre: prod.nombre,
                codigo: prod.codigo,
                cantidad: qty,
                precio: unitPrice,
                subtotal: lineSubtotal,
                stock_actual: prod.stock
            });
        }

        const costo_envio = 0.00; // Envíos Gratis en Juigalpa
        const total = subtotal + costo_envio;

        // Generar número de orden estilo DS-XXXXX
        const orderNumber = 'DS-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);

        // Insertar en tabla pedidos
        const [orderResult] = await connection.query(`
            INSERT INTO pedidos (
                numero_orden, cliente_nombre, cliente_telefono, cliente_email,
                departamento, municipio, direccion_exacta, punto_referencia,
                tipo_entrega, metodo_pago, banco_transferencia, referencia_bancaria,
                comprobante_pago_base64, paypal_order_id, subtotal, costo_envio,
                total, moneda, estado, notas_cliente, origen
            ) VALUES (?, ?, ?, ?, 'Chontales', 'Juigalpa', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NIO', 'nuevo', ?, 'web')
        `, [
            orderNumber, cliente_nombre, cliente_telefono, cliente_email,
            direccion_exacta, punto_referencia, tipo_entrega, metodo_pago,
            banco_transferencia, referencia_bancaria, comprobante_pago_base64,
            paypal_order_id, subtotal, costo_envio, total, notas_cliente
        ]);

        const pedidoId = orderResult.insertId;

        // Insertar detalle_pedidos y actualizar stock y auditoría
        for (const item of validatedItems) {
            await connection.query(`
                INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, codigo_producto, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [pedidoId, item.producto_id, item.nombre, item.codigo, item.cantidad, item.precio, item.subtotal]);

            const nuevoStock = item.stock_actual - item.cantidad;
            await connection.query('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, item.producto_id]);

            await connection.query(`
                INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
                VALUES (?, 'venta', ?, ?, ?, ?, 'Web Checkout Cliente')
            `, [item.producto_id, item.cantidad, item.stock_actual, nuevoStock, `Venta Pedido ${orderNumber}`]);
        }

        await connection.commit();
        res.json({
            success: true,
            numero_orden: orderNumber,
            pedido_id: pedidoId,
            subtotal,
            total,
            moneda: 'NIO',
            mensaje: '¡Pedido registrado exitosamente! Envío gratis en Juigalpa.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al procesar orden:', error);
        res.status(400).json({ error: error.message || 'Error al procesar el pedido' });
    } finally {
        connection.release();
    }
});

// GET /orders/track/:order_number - Rastreo en tiempo real para el cliente
router.get('/orders/track/:order_number', async (req, res) => {
    const { order_number } = req.params;
    try {
        const [orders] = await pool.query(`
            SELECT id, numero_orden, cliente_nombre, estado, total, metodo_pago,
                   direccion_exacta, punto_referencia, tipo_entrega, repartidor_asignado,
                   creado_en, actualizado_en
            FROM pedidos
            WHERE numero_orden = ? OR cliente_telefono = ?
        `, [order_number, order_number]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'No se encontró ningún pedido con ese número de guía.' });
        }

        const pedido = orders[0];
        const [items] = await pool.query(`
            SELECT dp.*, p.imagen_base64
            FROM detalle_pedidos dp
            LEFT JOIN productos p ON dp.producto_id = p.id
            WHERE dp.pedido_id = ?
        `, [pedido.id]);

        pedido.items = items;
        res.json(pedido);
    } catch (error) {
        console.error('Error al rastrear pedido:', error);
        res.status(500).json({ error: 'Error al rastrear pedido' });
    }
});

module.exports = router;
