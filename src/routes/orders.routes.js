const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// POST /api/orders
router.post('/', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            cliente_nombre, cliente_telefono, cliente_email,
            departamento = 'Chontales', municipio = 'Juigalpa',
            direccion_exacta, punto_referencia,
            tipo_entrega = 'domicilio_gratis_juigalpa',
            metodo_pago, banco_transferencia, referencia_bancaria,
            comprobante_pago_base64, paypal_order_id,
            notas_cliente, items
        } = req.body;

        if (!cliente_nombre || !cliente_telefono || !direccion_exacta || !metodo_pago) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'Nombre, teléfono, dirección y método de pago son obligatorios.'
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'El carrito no contiene repuestos.' });
        }

        
        // Normalización segura para MySQL ENUM
        let normalizedMetodo = 'efectivo_contraentrega';
        if (metodo_pago === 'transferencia_bancaria' || metodo_pago === 'transferencia') {
            normalizedMetodo = 'transferencia_bancaria';
        } else if (metodo_pago === 'tarjeta_online' || metodo_pago === 'tarjeta') {
            normalizedMetodo = 'tarjeta_online';
        } else if (metodo_pago === 'paypal') {
            normalizedMetodo = 'paypal';
        } else {
            normalizedMetodo = 'efectivo_contraentrega';
        }

        let normalizedEntrega = 'domicilio_gratis_juigalpa';
        if (tipo_entrega === 'retiro_tienda' || tipo_entrega === 'retiro') {
            normalizedEntrega = 'retiro_tienda';
        } else if (tipo_entrega === 'envio_nacional' || tipo_entrega === 'departamental') {
            normalizedEntrega = 'envio_nacional';
        } else {
            normalizedEntrega = 'domicilio_gratis_juigalpa';
        }

        const randomHex = Math.floor(1000 + Math.random() * 9000);
        const numero_orden = `ORD-2026-JUIG-${Date.now().toString().slice(-4)}-${randomHex}`;

        const esJuigalpa = municipio.trim().toLowerCase().includes('juigalpa');
        const costo_envio = (esJuigalpa && tipo_entrega === 'domicilio_gratis_juigalpa') ? 0.00 : (tipo_entrega === 'retiro_tienda' ? 0.00 : 80.00);

        let subtotalCalculado = 0;
        const validatedItems = [];

        for (const item of items) {
            const [prods] = await conn.query('SELECT id, nombre, codigo, precio, precio_oferta, stock FROM productos WHERE id = ? FOR UPDATE', [item.producto_id]);
            if (prods.length === 0) {
                await conn.rollback();
                return res.status(400).json({ success: false, message: `El repuesto ID ${item.producto_id} no existe.` });
            }

            const p = prods[0];
            const cant = parseInt(item.cantidad) || 1;

            if (p.stock < cant) {
                await conn.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente para "${p.nombre}". Disponible: ${p.stock} unidades.`
                });
            }

            const precioUnit = p.precio_oferta ? parseFloat(p.precio_oferta) : parseFloat(p.precio);
            const lineSubtotal = precioUnit * cant;
            subtotalCalculado += lineSubtotal;

            validatedItems.push({
                producto_id: p.id,
                nombre: p.nombre,
                codigo: p.codigo,
                cantidad: cant,
                precio_unitario: precioUnit,
                subtotal: lineSubtotal,
                stock_restante: p.stock - cant
            });
        }

        const total = subtotalCalculado + costo_envio;

        const [ordRes] = await conn.query(
            `INSERT INTO pedidos 
             (numero_orden, cliente_nombre, cliente_telefono, cliente_email, departamento, municipio, direccion_exacta, punto_referencia, tipo_entrega, metodo_pago, banco_transferencia, referencia_bancaria, comprobante_pago_base64, paypal_order_id, subtotal, costo_envio, total, estado, notas_cliente)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nuevo', ?)`,
            [
                numero_orden, cliente_nombre, cliente_telefono, cliente_email || null,
                departamento, municipio, direccion_exacta, punto_referencia || null,
                normalizedEntrega, normalizedMetodo, banco_transferencia || null, referencia_bancaria || null,
                comprobante_pago_base64 || null, paypal_order_id || null,
                subtotalCalculado, costo_envio, total, notas_cliente || null
            ]
        );

        const pedidoId = ordRes.insertId;

        for (const it of validatedItems) {
            await conn.query(
                `INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, codigo_producto, cantidad, precio_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [pedidoId, it.producto_id, it.nombre, it.codigo, it.cantidad, it.precio_unitario, it.subtotal]
            );

            await conn.query('UPDATE productos SET stock = ? WHERE id = ?', [it.stock_restante, it.producto_id]);

            await conn.query(
                `INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
                 VALUES (?, 'venta', ?, ?, ?, ?, 'Cliente Tienda Online')`,
                [it.producto_id, it.cantidad, it.stock_restante + it.cantidad, it.stock_restante, `Venta Pedido #${numero_orden}`]
            );
        }

        await conn.commit();

        res.status(201).json({
            success: true,
            message: '¡Pedido registrado con éxito! En Juigalpa el despacho urbano es rápido y gratis.',
            pedido_id: pedidoId,
            numero_orden: numero_orden,
            subtotal: subtotalCalculado,
            costo_envio: costo_envio,
            total: total,
            envio_gratis: costo_envio === 0
        });

    } catch (err) {
        await conn.rollback();
        console.error('Error procesando pedido:', err);
        res.status(500).json({ success: false, message: 'Fallo al procesar pedido: ' + err.message });
    } finally {
        conn.release();
    }
});

// GET /api/orders
router.get('/', async (req, res) => {
    try {
        const { estado, search, limit = 50 } = req.query;
        let query = `
            SELECT p.*, COUNT(dp.id) AS total_items
            FROM pedidos p
            LEFT JOIN detalle_pedidos dp ON p.id = dp.pedido_id
            WHERE 1=1
        `;
        const params = [];

        if (estado && estado !== 'todos') {
            query += ' AND p.estado = ?';
            params.push(estado);
        }

        if (search) {
            query += ' AND (p.numero_orden LIKE ? OR p.cliente_nombre LIKE ? OR p.cliente_telefono LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        query += ' GROUP BY p.id ORDER BY p.id DESC LIMIT ?';
        params.push(parseInt(limit));

        const [orders] = await pool.query(query, params);
        res.json({ success: true, count: orders.length, data: orders });
    } catch (err) {
        console.error('Error listando pedidos:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// GET /api/orders/track/:code (Rastreo público de pedido para frontend)
router.get('/track/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const [orders] = await pool.query('SELECT * FROM pedidos WHERE numero_orden = ?', [code]);
        if (orders.length === 0) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        }
        const order = orders[0];
        const [items] = await pool.query(`
            SELECT dp.*, p.imagen_base64, p.codigo
            FROM detalle_pedidos dp
            LEFT JOIN productos p ON dp.producto_id = p.id
            WHERE dp.pedido_id = ?
        `, [order.id]);
        order.items = items;
        res.json({ success: true, order, data: order });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al rastrear pedido: ' + err.message });
    }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
        if (orders.length === 0) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

        const order = orders[0];
        const [items] = await pool.query(`
            SELECT dp.*, p.imagen_base64, p.codigo
            FROM detalle_pedidos dp
            LEFT JOIN productos p ON dp.producto_id = p.id
            WHERE dp.pedido_id = ?
        `, [order.id]);

        order.items = items;
        res.json({ success: true, data: order });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req, res) => {
    try {
        const { estado, repartidor_asignado, notas_admin } = req.body;
        const validStates = ['nuevo', 'confirmado', 'en_preparacion', 'en_ruta', 'entregado', 'cancelado'];

        if (!validStates.includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado inválido' });
        }

        let query = 'UPDATE pedidos SET estado = ?';
        const params = [estado];

        if (repartidor_asignado !== undefined) {
            query += ', repartidor_asignado = ?';
            params.push(repartidor_asignado);
        }

        if (notas_admin !== undefined) {
            query += ', notas_admin = ?';
            params.push(notas_admin);
        }

        query += ' WHERE id = ?';
        params.push(req.params.id);

        await pool.query(query, params);
        res.json({ success: true, message: `Pedido actualizado a: ${estado}` });
    } catch (err) {
        console.error('Error cambiando estado de pedido:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
