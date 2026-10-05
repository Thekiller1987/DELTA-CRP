const express = require('express');
const { pool } = require('../config/db');
const router = express.Router();

// -------------------------------------------------------------
// AUTENTICACIÓN ADMIN WASKAR & PERSONAL
// -------------------------------------------------------------
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const input = (email || '').toLowerCase().trim();
        if ((input.includes('admin') || input.includes('waskar')) && (password === '1987' || password === 'admin123')) {
            return res.json({
                success: true,
                token: 'jwt_admin_waskar_session_token_1987',
                user: { id: 1, nombre: 'Admin Waskar', rol: 'admin', email: 'admin@deltastore.com' }
            });
        }
        const [rows] = await pool.query('SELECT id, nombre, email, rol, activo FROM usuarios WHERE (LOWER(email) = ? OR LOWER(nombre) LIKE ?) AND activo = 1', [input, `%${input}%`]);
        if (rows.length > 0) {
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

// -------------------------------------------------------------
// 1. PRIMORDIAL: PRODUCTOS (CRUD COMPLETO)
// -------------------------------------------------------------
router.get('/products', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.*, 
                   c.nombre AS categoria_nombre, 
                   b.nombre AS marca_nombre,
                   pr.nombre_comercial AS proveedor_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN marcas_moto b ON p.marca_moto_id = b.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            WHERE p.activo = 1
            ORDER BY p.id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error en productos CRM:', error);
        res.status(500).json({ error: 'Error al obtener repuestos' });
    }
});

router.post('/products', async (req, res) => {
    const {
        codigo, nombre, categoria_id, proveedor_id = null, marca_moto_id = null, 
        modelo_compatible = 'Universal', descripcion = '', precio, precio_oferta = null, 
        costo_compra = 0, stock = 0, stock_minimo = 5, color = 'Estándar', 
        caracteristicas = null, imagen_base64 = null, destacado = false
    } = req.body;

    if (!codigo || !nombre || !categoria_id || !precio) {
        return res.status(400).json({ error: 'Código, nombre, categoría y precio son obligatorios.' });
    }

    try {
        const [result] = await pool.query(`
            INSERT INTO productos (
                codigo, nombre, categoria_id, proveedor_id, marca_moto_id, modelo_compatible,
                descripcion, precio, precio_oferta, costo_compra, stock, stock_minimo,
                color, caracteristicas, imagen_base64, destacado, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            codigo, nombre, parseInt(categoria_id), proveedor_id ? parseInt(proveedor_id) : null,
            marca_moto_id ? parseInt(marca_moto_id) : null, modelo_compatible,
            descripcion, parseFloat(precio), precio_oferta ? parseFloat(precio_oferta) : null,
            parseFloat(costo_compra || 0), parseInt(stock || 0), parseInt(stock_minimo || 5),
            color, typeof caracteristicas === 'object' ? JSON.stringify(caracteristicas) : caracteristicas,
            imagen_base64, destacado ? 1 : 0
        ]);

        if (stock > 0) {
            await pool.query(`
                INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
                VALUES (?, 'entrada', ?, 0, ?, 'Alta inicial de repuesto', 'Admin Waskar')
            `, [result.insertId, parseInt(stock), parseInt(stock)]);
        }

        res.json({ success: true, id: result.insertId, message: 'Repuesto registrado exitosamente en MySQL deltastore_db' });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: error.message || 'Error al guardar repuesto' });
    }
});

router.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const {
        codigo, nombre, categoria_id, proveedor_id, marca_moto_id, modelo_compatible,
        descripcion, precio, precio_oferta, costo_compra, stock, stock_minimo,
        color, caracteristicas, imagen_base64, destacado
    } = req.body;

    try {
        let updateQuery = `
            UPDATE productos SET
                codigo = ?, nombre = ?, categoria_id = ?, proveedor_id = ?, marca_moto_id = ?,
                modelo_compatible = ?, descripcion = ?, precio = ?, precio_oferta = ?, costo_compra = ?,
                stock = ?, stock_minimo = ?, color = ?,
                caracteristicas = ?, destacado = ?
        `;
        const params = [
            codigo, nombre, parseInt(categoria_id), proveedor_id ? parseInt(proveedor_id) : null,
            marca_moto_id ? parseInt(marca_moto_id) : null, modelo_compatible,
            descripcion, parseFloat(precio), precio_oferta ? parseFloat(precio_oferta) : null,
            parseFloat(costo_compra || 0), parseInt(stock || 0), parseInt(stock_minimo || 5),
            color, typeof caracteristicas === 'object' ? JSON.stringify(caracteristicas) : caracteristicas,
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

// -------------------------------------------------------------
// 2. PRIMORDIAL: CATEGORÍAS (CRUD COMPLETO)
// -------------------------------------------------------------
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT c.*, COUNT(p.id) AS total_productos
            FROM categorias c
            LEFT JOIN productos p ON c.id = p.categoria_id AND p.activo = 1
            WHERE c.activo = 1
            GROUP BY c.id
            ORDER BY c.nombre ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

router.post('/categories', async (req, res) => {
    const { nombre, slug, icono = '🏍️', descripcion = '' } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre de la categoría es requerido' });

    const finalSlug = slug ? slug.toLowerCase().trim() : nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    try {
        const [result] = await pool.query(`
            INSERT INTO categorias (nombre, slug, icono, descripcion, activo)
            VALUES (?, ?, ?, ?, 1)
        `, [nombre, finalSlug, icono, descripcion]);
        res.json({ success: true, id: result.insertId, message: 'Categoría creada con éxito' });
    } catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, slug, icono, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    try {
        await pool.query(`
            UPDATE categorias 
            SET nombre = ?, slug = ?, icono = ?, descripcion = ?
            WHERE id = ?
        `, [nombre, slug, icono || '🏍️', descripcion || '', id]);
        res.json({ success: true, message: 'Categoría actualizada' });
    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE categorias SET activo = 0 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Categoría desactivada' });
    } catch (error) {
        console.error('Error al desactivar categoría:', error);
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// 3. PRIMORDIAL: PROVEEDORES (CRUD COMPLETO)
// -------------------------------------------------------------
router.get('/suppliers', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT pr.*, COUNT(p.id) AS total_productos
            FROM proveedores pr
            LEFT JOIN productos p ON pr.id = p.proveedor_id AND p.activo = 1
            WHERE pr.activo = 1
            GROUP BY pr.id
            ORDER BY pr.nombre_comercial ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});
router.get('/proveedores', (req, res) => res.redirect('/api/crm/suppliers'));

router.post('/suppliers', async (req, res) => {
    const {
        nombre_comercial, razon_social = '', ruc = '', contacto_nombre = '',
        telefono = '', email = '', direccion = '', ciudad = 'Juigalpa', notas = ''
    } = req.body;

    if (!nombre_comercial) {
        return res.status(400).json({ error: 'El nombre comercial del proveedor es obligatorio' });
    }

    try {
        const [result] = await pool.query(`
            INSERT INTO proveedores (
                nombre_comercial, razon_social, ruc, contacto_nombre,
                telefono, email, direccion, ciudad, notas, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [nombre_comercial, razon_social, ruc, contacto_nombre, telefono, email, direccion, ciudad, notas]);

        res.json({ success: true, id: result.insertId, message: 'Proveedor registrado exitosamente' });
    } catch (error) {
        console.error('Error al crear proveedor:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/proveedores', (req, res) => router.handle(req, res));

router.put('/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    const {
        nombre_comercial, razon_social = '', ruc = '', contacto_nombre = '',
        telefono = '', email = '', direccion = '', ciudad = 'Juigalpa', notas = ''
    } = req.body;

    try {
        await pool.query(`
            UPDATE proveedores SET
                nombre_comercial = ?, razon_social = ?, ruc = ?, contacto_nombre = ?,
                telefono = ?, email = ?, direccion = ?, ciudad = ?, notas = ?
            WHERE id = ?
        `, [nombre_comercial, razon_social, ruc, contacto_nombre, telefono, email, direccion, ciudad, notas, id]);

        res.json({ success: true, message: 'Proveedor actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE proveedores SET activo = 0 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Proveedor desactivado' });
    } catch (error) {
        console.error('Error al desactivar proveedor:', error);
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// 4. PRIMORDIAL: CLIENTES (CRUD COMPLETO)
// -------------------------------------------------------------
router.get('/customers', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT c.*, c.total_pedidos AS pedidos_count, c.total_gastado AS total_compras FROM clientes c WHERE c.activo = 1 ORDER BY c.nombre ASC");
        res.json(rows);
    } catch (error) {
        console.error('Error en clientes CRM:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});
router.get('/clientes', (req, res) => res.redirect('/api/crm/customers'));

router.post('/customers', async (req, res) => {
    const {
        nombre, telefono, email = '', cedula_ruc = '',
        direccion = '', municipio = 'Juigalpa', punto_referencia = '', notas = ''
    } = req.body;

    if (!nombre || !telefono) {
        return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
    }

    try {
        const [result] = await pool.query(`
            INSERT INTO clientes (
                nombre, telefono, email, cedula_ruc, direccion,
                municipio, punto_referencia, notas, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [nombre, telefono, email, cedula_ruc, direccion, municipio, punto_referencia, notas]);

        res.json({ success: true, id: result.insertId, message: 'Cliente registrado exitosamente' });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/customers/:id', async (req, res) => {
    const { id } = req.params;
    const {
        nombre, telefono, email = '', cedula_ruc = '',
        direccion = '', municipio = 'Juigalpa', punto_referencia = '', notas = ''
    } = req.body;

    try {
        await pool.query(`
            UPDATE clientes SET
                nombre = ?, telefono = ?, email = ?, cedula_ruc = ?,
                direccion = ?, municipio = ?, punto_referencia = ?, notas = ?
            WHERE id = ?
        `, [nombre, telefono, email, cedula_ruc, direccion, municipio, punto_referencia, notas, id]);

        res.json({ success: true, message: 'Cliente actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE clientes SET activo = 0 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Cliente desactivado' });
    } catch (error) {
        console.error('Error al desactivar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// MARCAS DE MOTO
// -------------------------------------------------------------
router.get('/brands', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM marcas_moto WHERE activo = 1 ORDER BY popularidad DESC, nombre ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener marcas:', error);
        res.status(500).json({ error: 'Error al obtener marcas' });
    }
});

// -------------------------------------------------------------
// KPIS DEL DASHBOARD
// -------------------------------------------------------------
router.get('/stats/dashboard', async (req, res) => {
    try {
        const [[ventasHoy]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS total FROM pedidos WHERE DATE(creado_en) = CURDATE() AND estado != 'cancelado'");
        const [[ventasMes]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS total FROM pedidos WHERE MONTH(creado_en) = MONTH(CURDATE()) AND YEAR(creado_en) = YEAR(CURDATE()) AND estado != 'cancelado'");
        const [[pedidosPendientes]] = await pool.query("SELECT COUNT(*) AS total FROM pedidos WHERE estado IN ('nuevo', 'confirmado', 'en_preparacion')");
        const [[stockBajo]] = await pool.query("SELECT COUNT(*) AS total FROM productos WHERE stock <= stock_minimo AND activo = 1");
        const [[totalProductos]] = await pool.query("SELECT COUNT(*) AS total, COALESCE(SUM(precio * stock), 0) AS valor_inventario FROM productos WHERE activo = 1");
        const [[totalProveedores]] = await pool.query("SELECT COUNT(*) AS total FROM proveedores WHERE activo = 1");
        const [[totalClientes]] = await pool.query("SELECT COUNT(*) AS total FROM clientes WHERE activo = 1");
        const [[totalCategorias]] = await pool.query("SELECT COUNT(*) AS total FROM categorias WHERE activo = 1");

        const [topProductos] = await pool.query(`
            SELECT dp.nombre_producto, SUM(dp.cantidad) AS total_vendido
            FROM detalle_pedidos dp
            JOIN pedidos p ON dp.pedido_id = p.id
            WHERE p.estado != 'cancelado'
            GROUP BY dp.producto_id, dp.nombre_producto
            ORDER BY total_vendido DESC
            LIMIT 5
        `);

        const [ultimosPedidos] = await pool.query(`
            SELECT id, numero_orden, cliente_nombre, total, estado, creado_en
            FROM pedidos
            ORDER BY id DESC
            LIMIT 6
        `);

        const [tendencia] = await pool.query(`
            SELECT DATE(creado_en) AS fecha, COALESCE(SUM(total), 0) AS total
            FROM pedidos
            WHERE creado_en >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND estado != 'cancelado'
            GROUP BY DATE(creado_en)
            ORDER BY fecha ASC
        `);

        res.json({
            ventas_hoy: Number(ventasHoy.total || 0),
            ventas_mes: Number(ventasMes.total || 0),
            pedidos_pendientes: pedidosPendientes.total,
            stock_bajo: stockBajo.total,
            total_productos: totalProductos.total,
            valor_inventario: Number(totalProductos.valor_inventario || 0),
            total_proveedores: totalProveedores.total,
            total_clientes: totalClientes.total,
            total_categorias: totalCategorias.total,
            top_productos: topProductos,
            ultimos_pedidos: ultimosPedidos,
            tendencia_ventas: tendencia
        });
    } catch (error) {
        console.error('Error en KPIs:', error);
        res.status(500).json({ error: 'Error al obtener analítica' });
    }
});

// -------------------------------------------------------------
// PEDIDOS PIPELINE KANBAN
// -------------------------------------------------------------
router.get('/orders', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM pedidos ORDER BY id DESC LIMIT 100');
        const [details] = await pool.query('SELECT * FROM detalle_pedidos');

        const fullOrders = orders.map(ord => ({
            ...ord,
            items: details.filter(d => d.pedido_id === ord.id)
        }));

        res.json(fullOrders);
    } catch (error) {
        console.error('Error al obtener pedidos CRM:', error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

router.patch('/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { estado, repartidor_asignado } = req.body;
    try {
        let q = 'UPDATE pedidos SET estado = ?';
        const params = [estado];
        if (repartidor_asignado !== undefined) {
            q += ', repartidor_asignado = ?';
            params.push(repartidor_asignado);
        }
        q += ' WHERE id = ?';
        params.push(id);

        await pool.query(q, params);
        res.json({ success: true, message: 'Estado actualizado' });
    } catch (error) {
        console.error('Error actualizando pedido:', error);
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
});

// -------------------------------------------------------------
// POS MOSTRADOR FISICO & VENTA EN TIENDA
// -------------------------------------------------------------
router.post('/pos/sale', async (req, res) => {
    const { cliente_nombre = 'Cliente Mostrador Juigalpa', cliente_telefono = 'N/A', metodo_pago = 'efectivo_contraentrega', items = [] } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'El carrito POS está vacío' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            const [prods] = await connection.query('SELECT * FROM productos WHERE id = ? AND activo = 1 FOR UPDATE', [item.producto_id]);
            if (prods.length === 0) throw new Error(`Repuesto ID ${item.producto_id} no disponible`);

            const prod = prods[0];
            if (prod.stock < item.cantidad) throw new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}`);

            const price = Number(prod.precio_oferta || prod.precio);
            const lineSub = price * item.cantidad;
            subtotal += lineSub;

            await connection.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [item.cantidad, prod.id]);

            await connection.query(`
                INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
                VALUES (?, 'venta', ?, ?, ?, 'Venta directa en Mostrador POS', 'Admin Waskar')
            `, [prod.id, item.cantidad, prod.stock, prod.stock - item.cantidad]);

            processedItems.push({
                producto_id: prod.id,
                nombre: prod.nombre,
                codigo: prod.codigo,
                precio_unitario: price,
                cantidad: item.cantidad,
                subtotal: lineSub
            });
        }

        const numOrden = 'POS-' + Date.now().toString().slice(-6);

        const [ordRes] = await connection.query(`
            INSERT INTO pedidos (
                numero_orden, cliente_nombre, cliente_telefono, departamento, municipio,
                direccion_exacta, tipo_entrega, metodo_pago, subtotal, costo_envio, total,
                moneda, estado, origen
            ) VALUES (?, ?, ?, 'Chontales', 'Juigalpa', 'Mostrador DeltaStore Juigalpa', 'retiro_tienda', ?, ?, 0.00, ?, 'NIO', 'entregado', 'crm_pos')
        `, [numOrden, cliente_nombre, cliente_telefono, metodo_pago, subtotal, subtotal]);

        for (const pi of processedItems) {
            await connection.query(`
                INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, codigo_producto, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [ordRes.insertId, pi.producto_id, pi.nombre, pi.codigo, pi.cantidad, pi.precio_unitario, pi.subtotal]);
        }

        await connection.commit();
        res.json({
            success: true,
            numero_orden: numOrden,
            pedido_id: ordRes.insertId,
            total: subtotal,
            items: processedItems
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error en cobro POS:', error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// -------------------------------------------------------------
// ARQUEO DE CAJA
// -------------------------------------------------------------
router.get('/cash-closing/current', async (req, res) => {
    try {
        const [[efectivo]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS conteo FROM pedidos WHERE DATE(creado_en) = CURDATE() AND estado != 'cancelado' AND (metodo_pago = 'efectivo_contraentrega' OR metodo_pago = 'efectivo')");
        const [[transferencias]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS conteo FROM pedidos WHERE DATE(creado_en) = CURDATE() AND estado != 'cancelado' AND (metodo_pago = 'transferencia_bancaria' OR metodo_pago = 'transferencia')");
        const [[tarjetas]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS conteo FROM pedidos WHERE DATE(creado_en) = CURDATE() AND estado != 'cancelado' AND (metodo_pago = 'tarjeta_online' OR metodo_pago = 'tarjeta')");

        const totalE = parseFloat(efectivo.total);
        const totalT = parseFloat(transferencias.total);
        const totalC = parseFloat(tarjetas.total);

        res.json({
            efectivo: { total: totalE, pedidos: efectivo.conteo },
            transferencias: { total: totalT, pedidos: transferencias.conteo },
            tarjetas: { total: totalC, pedidos: tarjetas.conteo },
            total_general: totalE + totalT + totalC
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/cash-closing', async (req, res) => {
    const { cajero, fondo_inicial, total_efectivo_declarado, total_efectivo_sistema, diferencia, total_transferencias, total_tarjetas, total_general, desglose_billetes, observaciones, sucursal } = req.body;
    try {
        const [result] = await pool.query(`
            INSERT INTO cierres_caja (
                cajero, fondo_inicial, total_efectivo_declarado, total_efectivo_sistema,
                diferencia, total_transferencias, total_tarjetas, total_general,
                desglose_billetes, observaciones, sucursal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cajero || 'Admin Waskar', fondo_inicial || 1000, total_efectivo_declarado || 0,
            total_efectivo_sistema || 0, diferencia || 0, total_transferencias || 0,
            total_tarjetas || 0, total_general || 0, JSON.stringify(desglose_billetes || {}),
            observaciones || '', sucursal || 'Juigalpa Central'
        ]);
        res.json({ success: true, cierre_id: result.insertId });
    } catch (error) {
        console.error('Error guardando cierre:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ajuste manual de stock
router.post('/inventory/adjust', async (req, res) => {
    const { producto_id, tipo_movimiento, cantidad, motivo = '', usuario = 'Admin Waskar' } = req.body;
    const qty = parseInt(cantidad);
    try {
        const [prods] = await pool.query('SELECT stock FROM productos WHERE id = ?', [producto_id]);
        if (prods.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

        const prev = prods[0].stock;
        let next = prev;
        if (tipo_movimiento === 'entrada') next += qty;
        else next = Math.max(0, prev - qty);

        await pool.query('UPDATE productos SET stock = ? WHERE id = ?', [next, producto_id]);
        await pool.query(`
            INSERT INTO auditorias_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [producto_id, tipo_movimiento, qty, prev, next, motivo, usuario]);

        res.json({ success: true, stock_anterior: prev, stock_nuevo: next });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
