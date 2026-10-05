require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware de CORS y JSON con límite de 50MB para comprobantes Base64
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos del CRM & ERP
app.use(express.static(path.join(__dirname, 'public')));

// Módulos RESTful del CRM & ERP
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/products', require('./src/routes/products.routes'));
app.use('/api/orders', require('./src/routes/orders.routes'));
app.use('/api/stats', require('./src/routes/stats.routes'));
app.use('/api/crm', require('./src/routes/crm.routes'));
app.use('/api', require('./src/routes/categories_brands.routes'));
app.use('/api', require('./src/routes/store.routes'));

// Endpoint de Diagnóstico y Salud del CRM & ERP
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        system: 'DELTA-CRP Enterprise (CRM, ERP, POS & MySQL)',
        sede: process.env.STORE_CITY || 'Juigalpa, Chontales',
        port: PORT,
        database: process.env.DB_NAME || 'deltastore_db',
        timestamp: new Date().toISOString()
    });
});

// Ruta principal sirve la interfaz de gestión CRM & ERP
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar Servidor DELTA-CRP
app.listen(PORT, async () => {
    console.log('====================================================');
    console.log(`📊  DELTA-CRP (CRM & ERP) ACTIVO EN PUERTO: ${PORT}`);
    console.log(`💼  Panel de Gestión & POS:  http://localhost:${PORT}`);
    console.log(`🛢️  Base de Datos MySQL:     ${process.env.DB_NAME || 'deltastore_db'}`);
    console.log('====================================================');
    await testConnection();
});
