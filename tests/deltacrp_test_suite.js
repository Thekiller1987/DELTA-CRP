// ==========================================================
// DELTA-CRP - SUITE DE AUDITORÍA Y PRUEBAS AUTOMATIZADAS
// E2E Test Suite: MySQL, Base64, Bcrypt, Checkout Juigalpa & CRM
// ==========================================================

const http = require('http');
const mysql = require('C:/Users/waska/Desktop/DeltaStore/node_modules/mysql2/promise');
const bcrypt = require('C:/Users/waska/Desktop/DeltaStore/node_modules/bcryptjs');
const jwt = require('C:/Users/waska/Desktop/DeltaStore/node_modules/jsonwebtoken');

const SERVER_URL = 'http://localhost:3005';
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passedTests++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failedTests++;
    }
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, SERVER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTestSuite() {
    console.log('====================================================');
    console.log('🧪 INICIANDO SUITE DE AUDITORÍA Y PRUEBAS DELTA-CRP');
    console.log('====================================================\n');

    // 1. Health Endpoint
    console.log('▶ TEST 1: Diagnóstico y Salud del Servidor Express');
    try {
        const res = await apiRequest('/api/health');
        assert(res.status === 200, 'Servidor responde código HTTP 200');
        assert(res.body.status === 'ONLINE', 'Estado de la API es ONLINE');
        assert(res.body.store_city.includes('Juigalpa'), 'Ciudad sede es Juigalpa, Chontales');
    } catch (e) {
        assert(false, `Fallo en health check: ${e.message}`);
    }

    // 2. Conexión Directa a MySQL
    console.log('\n▶ TEST 2: Auditoría de Tablas en MySQL (deltastore_db)');
    let conn;
    try {
        conn = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '1987',
            database: 'deltastore_db'
        });
        assert(true, 'Conexión TCP a MySQL exitosa');

        const [tables] = await conn.query('SHOW TABLES;');
        const tableNames = tables.map(t => Object.values(t)[0]);
        const expected = ['usuarios', 'categorias', 'marcas_moto', 'productos', 'pedidos', 'detalle_pedidos', 'auditorias_inventario'];
        
        for (const exp of expected) {
            assert(tableNames.includes(exp), `Tabla requerida "${exp}" existe en deltastore_db`);
        }
    } catch (e) {
        assert(false, `Error en verificación MySQL: ${e.message}`);
    }

    // 3. Seguridad y Cifrado Bcrypt
    console.log('\n▶ TEST 3: Cifrado Bcrypt y Autenticación Admin');
    try {
        const loginRes = await apiRequest('/api/auth/login', 'POST', {
            email: 'admin@deltastore.com',
            password: 'admin123'
        });
        assert(loginRes.status === 200, 'Login admin exitoso con código 200');
        assert(loginRes.body.token !== undefined, 'Token JWT generado correctamente');
        assert(loginRes.body.user.rol === 'admin', 'Rol del usuario autenticado es admin');

        // Prueba de contraseña inválida
        const badLogin = await apiRequest('/api/auth/login', 'POST', {
            email: 'admin@deltastore.com',
            password: 'password_erroneo'
        });
        assert(badLogin.status === 401, 'Rechazo seguro de contraseña inválida (HTTP 401)');
    } catch (e) {
        assert(false, `Error en prueba de seguridad: ${e.message}`);
    }

    // 4. Catálogo y Filtros de Repuestos
    console.log('\n▶ TEST 4: Catálogo y Filtro de Repuestos de Moto');
    try {
        const allRes = await apiRequest('/api/products');
        assert(allRes.status === 200, 'Catálogo obtenido con éxito');
        assert(allRes.body.count >= 10, `Catálogo poblado con ${allRes.body.count} repuestos`);

        const catRes = await apiRequest('/api/products?categoria=motor-cilindrada');
        assert(catRes.body.count > 0, `Filtrado por categoría "motor-cilindrada" retorna ${catRes.body.count} items`);

        const searchRes = await apiRequest('/api/products?search=Pulsar');
        assert(searchRes.body.count > 0, `Búsqueda por texto "Pulsar" retorna resultados`);
    } catch (e) {
        assert(false, `Error en catálogo: ${e.message}`);
    }

    // 5. Inserción de Repuesto con Imagen en Base64
    console.log('\n▶ TEST 5: Alta de Producto con Imagen en Base64');
    let createdProdId = null;
    try {
        const sampleBase64 = 'data:image/svg+xml;base64,' + Buffer.from('<svg><text>Test Base64 Part</text></svg>').toString('base64');
        const newPart = {
            codigo: 'TEST-PISTON-' + Date.now().toString().slice(-4),
            nombre: 'Pistón de Prueba Unitario NS200 Racing',
            categoria_id: 1,
            marca_moto_id: 1,
            modelo_compatible: 'Pulsar NS200 Test Edition',
            descripcion: 'Repuesto de prueba para validación de almacenamiento Base64 en LONGTEXT',
            precio: 890.00,
            stock: 20,
            stock_minimo: 5,
            color: 'Plata Titanio',
            imagen_base64: sampleBase64
        };

        const createRes = await apiRequest('/api/products', 'POST', newPart);
        assert(createRes.status === 201, 'Producto creado exitosamente con código HTTP 201');
        createdProdId = createRes.body.id;

        // Verificar que la imagen Base64 se almacena y recupera intacta
        const fetchCreated = await apiRequest(`/api/products/${createdProdId}`);
        assert(fetchCreated.body.data.imagen_base64 === sampleBase64, 'Integridad de cadena Base64 verificada al 100%');
    } catch (e) {
        assert(false, `Error en alta Base64: ${e.message}`);
    }

    // 6. Checkout Juigalpa con Envío Gratis y Descuento de Stock
    console.log('\n▶ TEST 6: Flujo de Pedido Juigalpa Urbano con Envío Gratis (C$ 0.00)');
    let placedOrderId = null;
    let placedOrderNum = null;
    try {
        // Consultar stock antes de comprar
        const prodBefore = await apiRequest(`/api/products/${createdProdId}`);
        const stockBefore = prodBefore.body.data.stock;

        const orderPayload = {
            cliente_nombre: 'Prueba Automatizada Juigalpa',
            cliente_telefono: '+505 8777 9999',
            departamento: 'Chontales',
            municipio: 'Juigalpa',
            direccion_exacta: 'Barrio Sandino, de la iglesia 1c arriba',
            punto_referencia: 'Casa verde esquinera',
            tipo_entrega: 'domicilio_gratis_juigalpa',
            metodo_pago: 'efectivo_contraentrega',
            notas_cliente: 'Paga con billete de C$ 1,000',
            items: [
                { producto_id: createdProdId, cantidad: 2 }
            ]
        };

        const orderRes = await apiRequest('/api/orders', 'POST', orderPayload);
        assert(orderRes.status === 201, 'Pedido registrado exitosamente (HTTP 201)');
        assert(orderRes.body.costo_envio === 0, 'Costo de envío en Juigalpa es C$ 0.00 (Envío GRATIS verificado)');
        assert(orderRes.body.total === 890 * 2, `Cálculo de total exacto: C$ ${orderRes.body.total}`);

        placedOrderId = orderRes.body.pedido_id;
        placedOrderNum = orderRes.body.numero_orden;

        // Verificar descuento automático de inventario en MySQL
        const prodAfter = await apiRequest(`/api/products/${createdProdId}`);
        const stockAfter = prodAfter.body.data.stock;
        assert(stockAfter === stockBefore - 2, `Stock descontado en MySQL: ${stockBefore} -> ${stockAfter}`);
    } catch (e) {
        assert(false, `Error en checkout Juigalpa: ${e.message}`);
    }

    // 7. Transición de Estados en Pipeline Kanban de CRM
    console.log('\n▶ TEST 7: Pipeline Kanban de Estados (Nuevo -> Confirmado -> En Ruta -> Entregado)');
    try {
        // A. Confirmar Pedido
        const step1 = await apiRequest(`/api/orders/${placedOrderId}/status`, 'PATCH', { estado: 'confirmado' });
        assert(step1.status === 200, 'Estado avanzado a "confirmado"');

        // B. Asignar Motorizado y Despachar a Ruta Juigalpa
        const step2 = await apiRequest(`/api/orders/${placedOrderId}/status`, 'PATCH', {
            estado: 'en_ruta',
            repartidor_asignado: 'Motorizado Delta 02 (Leonel)'
        });
        assert(step2.status === 200, 'Estado avanzado a "en_ruta" con motorizado asignado');

        // C. Entregar Pedido
        const step3 = await apiRequest(`/api/orders/${placedOrderId}/status`, 'PATCH', { estado: 'entregado' });
        assert(step3.status === 200, 'Estado finalizado como "entregado"');

        // Verificar datos en la orden
        const verifyOrder = await apiRequest(`/api/orders/${placedOrderId}`);
        assert(verifyOrder.body.data.estado === 'entregado', 'Estado persistido en MySQL como "entregado"');
        assert(verifyOrder.body.data.repartidor_asignado === 'Motorizado Delta 02 (Leonel)', 'Repartidor persistido en orden');
    } catch (e) {
        assert(false, `Error en pipeline de estados: ${e.message}`);
    }

    // 8. Ajuste Rápido de Inventario y Auditoría
    console.log('\n▶ TEST 8: Ajuste de Inventario y Auditoría en MySQL');
    try {
        const adjustRes = await apiRequest(`/api/products/${createdProdId}`, 'PUT', { stock: 25 });
        assert(adjustRes.status === 200, 'Stock modificado exitosamente');

        const [audits] = await conn.query('SELECT * FROM auditorias_inventario WHERE producto_id = ? ORDER BY id DESC', [createdProdId]);
        assert(audits.length >= 2, `Historial de auditoría contiene ${audits.length} movimientos`);
        assert(audits[0].tipo_movimiento === 'ajuste', 'Tipo de movimiento registrado como "ajuste"');
    } catch (e) {
        assert(false, `Error en auditoría: ${e.message}`);
    }

    // 9. Dashboard Analytics y Alertas de Stock
    console.log('\n▶ TEST 9: KPIs de CRM y Detección de Stock Crítico');
    try {
        const statsRes = await apiRequest('/api/stats/dashboard');
        assert(statsRes.status === 200, 'Dashboard responde HTTP 200');
        assert(parseFloat(statsRes.body.data.total_ventas) > 0, `Ventas totales registradas: C$ ${statsRes.body.data.total_ventas}`);
        assert(statsRes.body.data.total_alertas_stock >= 0, `Alertas de stock crítico calculadas: ${statsRes.body.data.total_alertas_stock}`);
    } catch (e) {
        assert(false, `Error en analítica de CRM: ${e.message}`);
    }

    if (conn) await conn.end();

    console.log('\n====================================================');
    console.log(`🏁 RESUMEN AUDITORÍA: ${passedTests} PRUEBAS EXITOSAS | ${failedTests} FALLIDAS`);
    console.log('====================================================');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        console.log('🎉 ¡SISTEMA DELTA-CRP 100% OPERATIVO Y VALIDADO EN JUIGALPA!');
        process.exit(0);
    }
}

runTestSuite();
