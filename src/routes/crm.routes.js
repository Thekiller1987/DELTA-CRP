const express = require('express');
const { pool } = require('../config/db');
const router = express.Router();

// POST /auth/login - Autenticación de personal
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if (email === 'admin@deltastore.com' && password === 'admin123') {
            return res.json({
                success: true,
                token: 'mock_jwt_token_deltastore_admin',
                user: { id: 1, nombre: 'Administrador DeltaStore', rol: 'admin', email }
            });
        }
        const [rows] = await pool.query('SELECT id, nombre, email, rol, activo FROM usuarios WHERE email = ?', [email]);
        if (rows.length > 0 && rows[0].activo) {
            return res.json({
                success: true,
                token: 'mock_jwt_token_' + rows[0].id,
                user: rows[0]
            });
        }
        res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
    } catch (error) {
        console.error('Error en login CRM:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// GET /stats/dashboard - KPIs y analítica ejecutiva
router.get('/stats/dashboard', async (req, res) => {
    try {
        const [[ventasHoy]] = await pool.query(`
            SELECT COALESCE(SUM(total), 0) AS total 
            FROM pedidos 
            WHERE DATE(creado_en) = CURDATE() AND estado != 'cancelado'
        `);

        const [[ventasMes]] = await pool.query(`
            SELECT COALESCE(SUM(total), 0) AS total 
            FROM pedidos 
            WHERE MONTH(creado_en) = MONTH(CURDATE()) AND YEAR(creado_en) = YEAR(CURDATE()) AND estado != 'cancelado'
        `);

        const [[pedidosPendientes]] = await pool.query(`
            SELECT COUNT(*) AS total 
            FROM pedidos 
            WHERE estado IN ('nuevo', 'confirmado', 'en_preparacion')
        `);

        const [[stockBajo]] = await pool.query(`
            SELECT COUNT(*) AS total 
            FROM productos 
            WHERE stock <= stock_minimo AND activo = 1
        `);

        const [[totalProductos]] = await pool.query(`
            SELECT COUNT(*) AS total, COALESCE(SUM(precio * stock), 0) AS valor_inventario 
            FROM productos 
            WHERE activo = 1
        `);

        // Ventas últimos 7 días
        const [ventas7Dias] = await pool.query(`
            SELECT DATE(creado_en) AS fecha, COALESCE(SUM(total), 0) AS total
            FROM pedidos
            WHERE creado_en >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND estado != 'cancelado'
            GROUP BY DATE(creado_en)
            ORDER BY fecha ASC
        `);

        // Top 5 repuestos más vendidos
        const [topProductos] = await pool.query(`
            SELECT dp.nombre_producto, SUM(dp.cantidad) AS total_vendido, SUM(dp.subtotal) AS ingreso_total
            FROM detalle_pedidos dp
            JOIN pedidos p ON dp.pedido_id = p.id
            WHERE p.estado != 'cancelado'
            GROUP BY dp.nombre_producto
            ORDER BY total_vendido DESC
            LIMIT 5
        `);

        // Últimos 5 pedidos
        const [ultimosPedidos] = await pool.query(`
            SELECT id, numero_orden, cliente_nombre, total, metodo_pago, estado, origen, creado_en
            FROM pedidos
            ORDER BY id DESC
            LIMIT 5
        `);

        res.json({
            ventas_hoy: parseFloat(ventasHoy.total),
            ventas_mes: parseFloat(ventasMes.total),
            pedidos_pendientes: pedidosPendientes.total,
            stock_bajo: stockBajo.total,
            total_productos: totalProductos.total,
            valor_inventario: parseFloat(totalProductos.valor_inventario),
            ventas_ultimos_7_dias: ventas7Dias,
            top_productos: topProductos,
            ultimos_pedidos: ultimosPedidos
        });
    } catch (error) {
        console.error('Error al obtener KPIs:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
    }
});


// GET /pipeline - Kanban categorizado
router.get('/pipeline', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM pedidos ORDER BY id DESC');
        for (const p of orders) {
            const [items] = await pool.query('SELECT * FROM detalle_pedidos WHERE pedido_id = ?', [p.id]);
            p.items = items;
        }
        const pipeline = {
            nuevo: orders.filter(o => o.estado === 'nuevo'),
            confirmado: orders.filter(o => o.estado === 'confirmado' || o.estado === 'en_preparacion'),
            en_ruta: orders.filter(o => o.estado === 'en_ruta'),
            entregado: orders.filter(o => o.estado === 'entregado')
        };
        res.json(pipeline);
    } catch (err) {
        console.error('Error en pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /orders - Lista de pedidos para el Pipeline Kanban
router.get('/orders', async (req, res) => {
    const { estado } = req.query;
    try {
        let query = 'SELECT * FROM pedidos';
        const params = [];
        if (estado) {
            query += ' WHERE estado = ?';
            params.push(estado);
        }
        query += ' ORDER BY id DESC';
        const [pedidos] = await pool.query(query, params);

        // Cargar items de cada pedido
        for (const p of pedidos) {
            const [items] = await pool.query('SELECT * FROM detalle_pedidos WHERE pedido_id = ?', [p.id]);
            p.items = items;
        }

        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

// PUT /orders/:id/status - Actualizar estado y motorizado en Kanban
router.put('/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { estado, repartidor_asignado } = req.body;
    try {
        await pool.query('UPDATE pedidos SET estado = ?, repartidor_asignado = COALESCE(?, repartidor_asignado) WHERE id = ?', [estado, repartidor_asignado, id]);
        res.json({ success: true, message: 'Estado de pedido actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ error: 'Error al actualizar estado del pedido' });
    }
});

// PUT /orders/:id/verify-payment - Aprobar comprobante de transferencia bancaria
router.put('/orders/:id/verify-payment', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE pedidos SET comprobante_verificado = TRUE, estado = IF(estado="nuevo", "confirmado", estado) WHERE id = ?', [id]);
        res.json({ success: true, message: 'Comprobante verificado y pago aprobado exitosamente' });
    } catch (error) {
        console.error('Error al verificar comprobante:', error);
        res.status(500).json({ error: 'Error al verificar comprobante' });
    }
});

// GET /inventory - Inventario y existencias con alerta de stock
router.get('/inventory', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.codigo, p.nombre, p.stock, p.stock_minimo, p.precio, p.precio_oferta,
                   c.nombre AS categoria, b.nombre AS marca, p.color,
                   IF(p.stock <= p.stock_minimo, TRUE, FALSE) AS alerta_stock_bajo
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN marcas_moto b ON p.marca_moto_id = b.id
            WHERE p.activo = 1
            ORDER BY alerta_stock_bajo DESC, p.stock ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener inventario:', error);
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

// POST /inventory/movement - Registro de movimiento de inventario (ACID)
router.post('/inventory/movement', async (req, res) => {
    const { producto_id, tipo_movimiento, cantidad, motivo = '', usuario = 'Admin CRM' } = req.body;
    const qty = parseInt(cantidad);
    if (!producto_id || !tipo_movimiento || !qty || qty <= 0) {
        return res.status(400).json({ error: 'Datos de movimiento inválidos' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [prodRows] = await connection.query('SELECT stock, nombre FROM productos WHERE id = ? FOR UPDATE', [producto_id]);
        if (prodRows.length === 0) {
            throw new Error('Producto no encontrado');
        }
        const prod = prodRows[0];
        let nuevoStock = prod.stock;

        if (tipo_movimiento === 'entrada' || tipo_movimiento === 'devolucion') {
            nuevoStock += qty;
        } else if (tipo_movimiento === 'venta' || tipo_movimiento === 'ajuste') {
            if (nuevoStock < qty && tipo_movimiento === 'venta') {
                throw new Error(`Stock insuficiente. Actual: ${prod.stock}, Solicitado: ${qty}`);
            }
            nuevoStock = Math.max(0, nuevoStock - qty);
        }

        await connection.query('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, producto_id]);
        await connection.query(`
            INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [producto_id, tipo_movimiento, qty, prod.stock, nuevoStock, motivo, usuario]);

        await connection.commit();
        res.json({ success: true, stock_anterior: prod.stock, stock_nuevo: nuevoStock });
    } catch (error) {
        await connection.rollback();
        console.error('Error en movimiento de stock:', error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// GET /products - CRUD Catálogo para CRM
router.get('/products', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.*, c.nombre AS categoria_nombre, b.nombre AS marca_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN marcas_moto b ON p.marca_moto_id = b.id
            WHERE p.activo = 1
            ORDER BY p.id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error en productos CRM:', error);
        res.status(500).json({ error: 'Error al obtener repuestos' });
    }
});

// POST /products - Crear nuevo repuesto con foto Base64
router.post('/products', async (req, res) => {
    const {
        codigo, nombre, categoria_id, marca_moto_id = null, modelo_compatible = 'Universal',
        descripcion = '', precio, precio_oferta = null, stock = 0, stock_minimo = 5,
        color = 'Estándar', caracteristicas = null, imagen_base64 = null, destacado = false
    } = req.body;

    if (!codigo || !nombre || !categoria_id || !precio) {
        return res.status(400).json({ error: 'Código, nombre, categoría y precio son obligatorios.' });
    }

    try {
        const [result] = await pool.query(`
            INSERT INTO productos (
                codigo, nombre, categoria_id, marca_moto_id, modelo_compatible,
                descripcion, precio, precio_oferta, stock, stock_minimo,
                color, caracteristicas, imagen_base64, destacado, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            codigo, nombre, categoria_id, marca_moto_id, modelo_compatible,
            descripcion, precio, precio_oferta, stock, stock_minimo,
            color, typeof caracteristicas === 'object' ? JSON.stringify(caracteristicas) : caracteristicas,
            imagen_base64, destacado ? 1 : 0
        ]);

        res.json({ success: true, id: result.insertId, message: 'Repuesto registrado exitosamente' });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: error.message || 'Error al guardar repuesto' });
    }
});

// PUT /products/:id - Editar repuesto
router.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const {
        codigo, nombre, categoria_id, marca_moto_id, modelo_compatible,
        descripcion, precio, precio_oferta, stock, stock_minimo,
        color, caracteristicas, imagen_base64, destacado
    } = req.body;

    try {
        let updateQuery = `
            UPDATE productos SET
                codigo = ?, nombre = ?, categoria_id = ?, marca_moto_id = ?,
                modelo_compatible = ?, descripcion = ?, precio = ?, precio_oferta = ?,
                stock = ?, stock_minimo = ?, color = ?,
                caracteristicas = ?, destacado = ?
        `;
        const params = [
            codigo, nombre, categoria_id, marca_moto_id,
            modelo_compatible, descripcion, precio, precio_oferta,
            stock, stock_minimo, color,
            typeof caracteristicas === 'object' ? JSON.stringify(caracteristicas) : caracteristicas,
            destacado ? 1 : 0
        ];

        if (imagen_base64) {
            updateQuery += ', imagen_base64 = ?';
            params.push(imagen_base64);
        }

        updateQuery += ' WHERE id = ?';
        params.push(id);

        await pool.query(updateQuery, params);
        res.json({ success: true, message: 'Repuesto actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar repuesto:', error);
        res.status(500).json({ error: 'Error al actualizar repuesto' });
    }
});

// DELETE /products/:id - Desactivar repuesto (Soft Delete)
router.delete('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Repuesto desactivado del catálogo' });
    } catch (error) {
        console.error('Error al desactivar repuesto:', error);
        res.status(500).json({ error: 'Error al desactivar repuesto' });
    }
});

// POST /pos/sale - Terminal POS Mostrador para venta física en Juigalpa
router.post('/pos/sale', async (req, res) => {
    const { cliente_nombre = 'Cliente Mostrador', cliente_telefono = 'N/A', metodo_pago = 'efectivo_contraentrega', items, notas = '' } = req.body;
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
    if (!items || !items.length) {
        return res.status(400).json({ error: 'No hay productos seleccionados para la venta POS.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let subtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const [prodRows] = await connection.query('SELECT id, nombre, codigo, precio, precio_oferta, stock FROM productos WHERE id = ? FOR UPDATE', [item.producto_id]);
            if (prodRows.length === 0) throw new Error(`Repuesto ID ${item.producto_id} no encontrado`);
            const prod = prodRows[0];
            const qty = parseInt(item.cantidad) || 1;
            if (prod.stock < qty) throw new Error(`Stock insuficiente para ${prod.nombre}. En tienda: ${prod.stock}`);
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

        const total = subtotal;
        const orderNumber = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);

        const [orderResult] = await connection.query(`
            INSERT INTO pedidos (
                numero_orden, cliente_nombre, cliente_telefono, departamento, municipio,
                direccion_exacta, punto_referencia, tipo_entrega, metodo_pago,
                subtotal, costo_envio, total, moneda, estado, repartidor_asignado,
                notas_cliente, origen, comprobante_verificado
            ) VALUES (?, ?, ?, 'Chontales', 'Juigalpa', 'Tienda Física Juigalpa', 'Venta en Mostrador', 'retiro_tienda', ?, ?, 0.00, ?, 'NIO', 'entregado', 'Mostrador POS', ?, 'crm_pos', TRUE)
        `, [orderNumber, cliente_nombre, cliente_telefono, normalizedMetodo, subtotal, total, notas]);

        const pedidoId = orderResult.insertId;

        for (const item of validatedItems) {
            await connection.query(`
                INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, codigo_producto, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [pedidoId, item.producto_id, item.nombre, item.codigo, item.cantidad, item.precio, item.subtotal]);

            const nuevoStock = item.stock_actual - item.cantidad;
            await connection.query('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, item.producto_id]);

            await connection.query(`
                INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
                VALUES (?, 'venta', ?, ?, ?, ?, 'Cajero Mostrador POS')
            `, [item.producto_id, item.cantidad, item.stock_actual, nuevoStock, `Venta POS ${orderNumber}`]);
        }

        await connection.commit();
        res.status(201).json({
            success: true,
            numero_orden: orderNumber,
            pedido_id: pedidoId,
            total,
            items: validatedItems,
            fecha: new Date().toISOString()
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error en venta POS:', error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// GET /customers - Directorio CRM de clientes con compras y WhatsApp directo
router.get('/customers', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT cliente_nombre AS nombre,
                   cliente_telefono AS telefono,
                   cliente_email AS email,
                   direccion_exacta AS direccion,
                   COUNT(*) AS total_pedidos,
                   COALESCE(SUM(total), 0) AS total_gastado,
                   MAX(creado_en) AS ultima_compra
            FROM pedidos
            WHERE cliente_telefono IS NOT NULL AND cliente_telefono != ''
            GROUP BY cliente_nombre, cliente_telefono, cliente_email, direccion_exacta
            ORDER BY total_gastado DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error en clientes CRM:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});


// GET /categories - Categorías activas
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// GET /brands - Marcas de moto activas
router.get('/brands', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM marcas_moto WHERE activo = 1 ORDER BY popularidad DESC, nombre ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener marcas:', error);
        res.status(500).json({ error: 'Error al obtener marcas' });
    }
});

// ==========================================================================
// ARQUEO DE CAJA / CIERRE DE TURNO — JUIGALPA (CÓRDOBAS Y DÓLARES)
// ==========================================================================

async function ensureCierresTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cierres_caja (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fecha_cierre TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cajero VARCHAR(100) NOT NULL DEFAULT 'Cajero Mostrador',
                fondo_inicial DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
                total_efectivo_declarado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_efectivo_sistema DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                diferencia DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_transferencias DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_tarjetas DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_general DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                desglose_billetes JSON,
                observaciones TEXT,
                sucursal VARCHAR(100) DEFAULT 'Juigalpa Central'
            ) ENGINE=InnoDB;
        `);
    } catch (e) {
        console.error('Error creando tabla cierres_caja:', e.message);
    }
}
ensureCierresTable();

// GET /cash-closing/current — Resumen en vivo de ventas de caja
router.get('/cash-closing/current', async (req, res) => {
    try {
        const [[efectivo]] = await pool.query(`
            SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS conteo
            FROM pedidos
            WHERE DATE(creado_en) = CURDATE() 
              AND estado != 'cancelado' 
              AND (metodo_pago = 'efectivo_contraentrega' OR metodo_pago = 'efectivo')
        `);

        const [[transferencias]] = await pool.query(`
            SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS conteo
            FROM pedidos
            WHERE DATE(creado_en) = CURDATE() 
              AND estado != 'cancelado' 
              AND (metodo_pago = 'transferencia_bancaria' OR metodo_pago = 'transferencia')
        `);

        const [[tarjetas]] = await pool.query(`
            SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS conteo
            FROM pedidos
            WHERE DATE(creado_en) = CURDATE() 
              AND estado != 'cancelado' 
              AND (metodo_pago = 'tarjeta_online' OR metodo_pago = 'tarjeta')
        `);

        const totalEfectivo = parseFloat(efectivo.total);
        const totalTransf = parseFloat(transferencias.total);
        const totalTarj = parseFloat(tarjetas.total);
        const totalGlobal = totalEfectivo + totalTransf + totalTarj;

        res.json({
            fecha: new Date().toLocaleDateString('es-NI'),
            hora: new Date().toLocaleTimeString('es-NI'),
            efectivo: { total: totalEfectivo, pedidos: efectivo.conteo },
            transferencias: { total: totalTransf, pedidos: transferencias.conteo },
            tarjetas: { total: totalTarj, pedidos: tarjetas.conteo },
            total_general: totalGlobal,
            total_pedidos: efectivo.conteo + transferencias.conteo + tarjetas.conteo
        });
    } catch (error) {
        console.error('Error obteniendo estado de caja:', error);
        res.status(500).json({ error: 'Error al consultar corte de caja' });
    }
});

// POST /cash-closing — Guardar Acta de Cierre de Caja
router.post('/cash-closing', async (req, res) => {
    const {
        cajero = 'Cajero Mostrador',
        fondo_inicial = 1000.00,
        total_efectivo_declarado = 0.00,
        total_efectivo_sistema = 0.00,
        diferencia = 0.00,
        total_transferencias = 0.00,
        total_tarjetas = 0.00,
        total_general = 0.00,
        desglose_billetes = {},
        observaciones = ''
    } = req.body;

    try {
        await ensureCierresTable();

        const [result] = await pool.query(`
            INSERT INTO cierres_caja (
                cajero, fondo_inicial, total_efectivo_declarado, total_efectivo_sistema,
                diferencia, total_transferencias, total_tarjetas, total_general,
                desglose_billetes, observaciones, sucursal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Juigalpa Central')
        `, [
            cajero, fondo_inicial, total_efectivo_declarado, total_efectivo_sistema,
            diferencia, total_transferencias, total_tarjetas, total_general,
            JSON.stringify(desglose_billetes), observaciones
        ]);

        res.status(201).json({
            success: true,
            cierre_id: result.insertId,
            message: 'Cierre de caja registrado exitosamente',
            fecha: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error registrando cierre de caja:', error);
        res.status(500).json({ error: 'Error al guardar cierre de caja' });
    }
});

// GET /cash-closing/history — Historial de Arqueos y Cierres
router.get('/cash-closing/history', async (req, res) => {
    try {
        await ensureCierresTable();
        const [rows] = await pool.query('SELECT * FROM cierres_caja ORDER BY id DESC LIMIT 15');
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo historial de cierres:', error);
        res.status(500).json({ error: 'Error al consultar historial' });
    }
});

module.exports = router;
