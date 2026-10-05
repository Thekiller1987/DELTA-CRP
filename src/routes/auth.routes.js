const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'deltastore_secret_key_juigalpa';

// POST /api/auth/login - Inicio de sesión con Bcrypt y JWT
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
        }

        const [users] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND activo = TRUE', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Acceso concedido',
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                rol: user.rol,
                ciudad: user.ciudad,
                telefono: user.telefono
            }
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ success: false, message: 'Error interno en servidor' });
    }
});

// GET /api/auth/me - Perfil actual desde Token JWT
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        if (!authHeader) return res.status(401).json({ success: false, message: 'No autenticado' });

        const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
        const decoded = jwt.verify(token, JWT_SECRET);

        const [rows] = await pool.query('SELECT id, nombre, email, rol, ciudad, telefono, activo FROM usuarios WHERE id = ?', [decoded.id]);
        if (rows.length === 0 || !rows[0].activo) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
        }

        res.json({ success: true, user: rows[0] });
    } catch (err) {
        res.status(401).json({ success: false, message: 'Token expirado o inválido' });
    }
});

// GET /api/auth/roles - Definición y matriz de roles
router.get('/roles', (req, res) => {
    res.json({
        success: true,
        roles: [
            {
                id: 'admin',
                nombre: 'Super Administrador',
                icono: '👑',
                color: '#f59e0b',
                descripcion: 'Acceso irrestricto: Finanzas, Auditorías, Configuración, Inventario, CRM y POS.',
                permisos: ['all']
            },
            {
                id: 'cajero',
                nombre: 'Cajero / Mostrador POS',
                icono: '💵',
                color: '#10b981',
                descripcion: 'Terminal POS, cobro en efectivo/transferencia, cálculo de cambio y facturas térmicas.',
                permisos: ['pos', 'sales', 'read_products']
            },
            {
                id: 'bodeguero',
                nombre: 'Bodeguero / Almacén',
                icono: '📦',
                color: '#3b82f6',
                descripcion: 'Gestión de existencias, ajuste de stock, alertas de stock mínimo y kardex.',
                permisos: ['inventory', 'adjust_stock', 'read_products']
            },
            {
                id: 'vendedor',
                nombre: 'Asesor de Ventas',
                icono: '💼',
                color: '#8b5cf6',
                descripcion: 'Gestión de pipeline de clientes, pedidos online, seguimiento WhatsApp.',
                permisos: ['pipeline', 'orders', 'read_products', 'pos']
            },
            {
                id: 'repartidor',
                nombre: 'Motorizado / Repartidor',
                icono: '🛵',
                color: '#00f2fe',
                descripcion: 'Despacho urbano Juigalpa, confirmación de entregas y cobros contraentrega.',
                permisos: ['routes', 'mark_delivered', 'read_orders']
            }
        ]
    });
});

// GET /api/auth/users - Lista de usuarios del sistema
router.get('/users', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, email, rol, telefono, ciudad, activo, creado_en FROM usuarios ORDER BY id ASC');
        res.json({ success: true, count: rows.length, users: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/users - Crear nuevo usuario con rol
router.post('/users', async (req, res) => {
    try {
        const { nombre, email, password, rol = 'vendedor', telefono, ciudad = 'Juigalpa' } = req.body;
        if (!nombre || !email || !password) {
            return res.status(400).json({ success: false, message: 'Nombre, email y contraseña requeridos' });
        }

        const [exists] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (exists.length > 0) {
            return res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, ciudad, activo) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [nombre, email, hash, rol, telefono || null, ciudad]
        );

        res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente',
            user: { id: result.insertId, nombre, email, rol }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/auth/users/:id/role - Cambiar rol de usuario
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { rol } = req.body;
        const validRoles = ['admin', 'gerente', 'vendedor', 'cajero', 'bodeguero', 'repartidor', 'cliente'];
        if (!validRoles.includes(rol)) {
            return res.status(400).json({ success: false, message: 'Rol inválido' });
        }

        await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, req.params.id]);
        res.json({ success: true, message: `Rol de usuario actualizado a: ${rol}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
