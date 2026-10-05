const { pool } = require('./src/config/db');

const additionalProducts = [
    {
        codigo: 'ENC-BUJ-CPR8EAIX',
        nombre: 'Bujía de Iridio NGK Laser Iridium CPR8EAIX-9 (Pulsar NS200, CB190R, Duke 200)',
        categoria_id: 1,
        marca_moto_id: 1,
        modelo_compatible: 'Pulsar NS200 / AS200 / Dominar 400 / Honda CB190R',
        descripcion: 'Bujía de encendido de alta tecnología con punta de iridio de 0.6mm soldada por láser. Mayor chispa, mejor arranque en frío y ahorro de combustible.',
        precio: 380.00,
        precio_oferta: 340.00,
        stock: 40,
        stock_minimo: 8,
        color: 'Plata/Cerámica',
        caracteristicas: JSON.stringify({ electrodo: 'Iridio 0.6mm', grado_termico: 8, origen: 'Japón' }),
        destacado: 1
    },
    {
        codigo: 'ENC-BUJ-CR7HIX',
        nombre: 'Bujía de Iridio NGK CR7HIX Rosca Fina (Boxer 150, Génesis HJ125, Scooter GY6)',
        categoria_id: 1,
        marca_moto_id: 5,
        modelo_compatible: 'Bajaj Boxer BM150 / Génesis HJ125 / Motos Chinas 110-150cc',
        descripcion: 'Rendimiento superior para motores de trabajo diario y mensajería en Juigalpa. Resistente a la carbonización en caminos difíciles.',
        precio: 350.00,
        precio_oferta: 310.00,
        stock: 35,
        stock_minimo: 6,
        color: 'Plata',
        caracteristicas: JSON.stringify({ rosca: '10mm', electrodo: 'Iridio', origen: 'Japón' }),
        destacado: 0
    },
    {
        codigo: 'LUB-CAS-20W50',
        nombre: 'Aceite Castrol Actevo 4T 20W-50 Parte Sintética con Moléculas Actibond (1 Litro)',
        categoria_id: 8,
        marca_moto_id: 9,
        modelo_compatible: 'Universal 4 Tiempos (Boxer, Pulsar, Honda, Serpento, Génesis)',
        descripcion: 'Protección continua en las 3 etapas del viaje: encendido, marcha y cuando el motor se apaga. Formulado especialmente para el clima cálido de Chontales.',
        precio: 360.00,
        precio_oferta: null,
        stock: 50,
        stock_minimo: 12,
        color: 'Dorado',
        caracteristicas: JSON.stringify({ viscosidad: '20W-50', especificacion: 'JASO MA-2 / API SL', volumen: '1 Litro' }),
        destacado: 1
    },
    {
        codigo: 'LUB-MOT-5100',
        nombre: 'Aceite Motul 5100 4T 15W-50 Technosynthese Éster (1 Litro)',
        categoria_id: 8,
        marca_moto_id: 9,
        modelo_compatible: 'Pulsar NS200, Yamaha FZ25, Honda Twister, KTM',
        descripcion: 'Lubricante semisintético reforzado con base Éster para garantizar propiedades antidesgaste y asegurar la longevidad de la caja de cambios.',
        precio: 490.00,
        precio_oferta: 460.00,
        stock: 30,
        stock_minimo: 8,
        color: 'Ámbar',
        caracteristicas: JSON.stringify({ viscosidad: '15W-50', tecnologia: 'Technosynthese Ester', norma: 'JASO MA2' }),
        destacado: 1
    },
    {
        codigo: 'LLT-KEN-K270-18',
        nombre: 'Llanta Kenda K270 Dual Sport Doble Propósito 3.00-18 6PR (Calle y Barro Chontales)',
        categoria_id: 6,
        marca_moto_id: 9,
        modelo_compatible: 'Boxer 150, Génesis HJ125, Yamaha YBR 125, Serpento Coral',
        descripcion: 'Diseño mixto 50% asfalto y 50% tierra/trocha. Tacos profundos para máximo agarre en caminos ganaderos y lluvia en comarcas de Juigalpa.',
        precio: 1450.00,
        precio_oferta: 1350.00,
        stock: 16,
        stock_minimo: 4,
        color: 'Negro',
        caracteristicas: JSON.stringify({ medida: '3.00-18', capas: '6PR Reforzada', tipo: 'Con Neumático (TT)' }),
        destacado: 1
    },
    {
        codigo: 'LLT-KEN-K270-21',
        nombre: 'Llanta Delantera Kenda K270 Dual Sport 2.75-21 4PR para Montañesa / Enduro',
        categoria_id: 6,
        marca_moto_id: 9,
        modelo_compatible: 'Honda XR150L / XR190L / Génesis GXT 200 / Serpento Lander',
        descripcion: 'Excelente tracción en tierra y ripio, control estable en pavimento. Ideal para productores y técnicos de campo en Chontales y Boaco.',
        precio: 1550.00,
        precio_oferta: null,
        stock: 10,
        stock_minimo: 3,
        color: 'Negro',
        caracteristicas: JSON.stringify({ medida: '2.75-21', uso: 'Dual Sport / Todo Terreno' }),
        destacado: 0
    },
    {
        codigo: 'FRN-ZAP-BM150',
        nombre: 'Zapatas de Freno Tambor Trasero Originales Bajaj Boxer BM150 / Platina 100',
        categoria_id: 2,
        marca_moto_id: 1,
        modelo_compatible: 'Bajaj Boxer BM150 UG / Platina 100 / CT 100',
        descripcion: 'Frenado silencioso, libre de asbesto y larga vida útil. Resorte reforzado de retorno inmediato para trabajo pesado de mensajería.',
        precio: 290.00,
        precio_oferta: 260.00,
        stock: 28,
        stock_minimo: 8,
        color: 'Aluminio',
        caracteristicas: JSON.stringify({ material: 'Compuesto orgánico sin asbesto', posicion: 'Trasera' }),
        destacado: 0
    },
    {
        codigo: 'TRN-ARR-BM150',
        nombre: 'Kit de Arrastre Reforzado Bajaj Boxer BM150 (Corona 42T + Piñón 14T + Cadena 428H)',
        categoria_id: 3,
        marca_moto_id: 1,
        modelo_compatible: 'Bajaj Boxer BM150 todas las versiones',
        descripcion: 'Corona de acero al carbono tratada térmicamente contra desgaste. Cadena 428H reforzada de alta resistencia a la tracción.',
        precio: 850.00,
        precio_oferta: 790.00,
        stock: 20,
        stock_minimo: 5,
        color: 'Acero Pavonado',
        caracteristicas: JSON.stringify({ corona: '42T', pinion: '14T', cadena: '428H-120L' }),
        destacado: 1
    },
    {
        codigo: 'TRN-ARR-NS200',
        nombre: 'Kit de Arrastre Racing O-Ring Pulsar NS200 / AS200 (Corona 39T + Piñón 14T + Cadena 520HO)',
        categoria_id: 3,
        marca_moto_id: 1,
        modelo_compatible: 'Bajaj Pulsar NS200 FI / Carburada / NS160 Trasera',
        descripcion: 'Cadena con retenes O-Ring para retener lubricación interna por miles de kilómetros sin estiramiento prematuro.',
        precio: 1850.00,
        precio_oferta: 1690.00,
        stock: 14,
        stock_minimo: 4,
        color: 'Dorado / Negro',
        caracteristicas: JSON.stringify({ paso: '520', corona: '39 Dientes', tipo: 'O-Ring Sellada' }),
        destacado: 1
    },
    {
        codigo: 'MOT-CARB-PZ27',
        nombre: 'Carburador Completo PZ27 con Ahogador Manual para Motos 150cc - 200cc',
        categoria_id: 1,
        marca_moto_id: 9,
        modelo_compatible: 'Génesis HJ125/150, Serpento Coral/Yaguar, Dayun 150, Raybar 150',
        descripcion: 'Carburador de alta precisión para sustituir carburadores desgastados. Consumo de combustible optimizado y aceleración pareja sin tirones.',
        precio: 950.00,
        precio_oferta: 880.00,
        stock: 12,
        stock_minimo: 3,
        color: 'Aluminio Pulido',
        caracteristicas: JSON.stringify({ venturi: '27mm', ahogador: 'Manual con palanca' }),
        destacado: 0
    },
    {
        codigo: 'ACC-TIM-PROTAPER',
        nombre: 'Manubrio ProTaper Contour Fatbar 28mm con Torretas / Elevadores de Aluminio',
        categoria_id: 7,
        marca_moto_id: 9,
        modelo_compatible: 'Universal (Pulsar, Serpento, Génesis, Yamaha, Honda)',
        descripcion: 'Aluminio aeroespacial T6 de 5mm con almohadilla de espuma de alta densidad. Mayor absorción de impactos y comodidad en ruta.',
        precio: 1350.00,
        precio_oferta: 1190.00,
        stock: 15,
        stock_minimo: 4,
        color: 'Negro Anodizado',
        caracteristicas: JSON.stringify({ diametro: '28mm en centro a 22mm en puños', almohadilla: 'Incluida' }),
        destacado: 1
    },
    {
        codigo: 'ACC-CAS-SHAFT560',
        nombre: 'Casco Integral Certificado DOT / ECE 22.05 Shaft Pro 560 EVO con Lente Interno UV',
        categoria_id: 7,
        marca_moto_id: 9,
        modelo_compatible: 'Universal Rider (Tallas M, L, XL)',
        descripcion: 'Coraza aerodinámica en termoplástico de alto impacto (ABS), visor antirayaduras con preparación Pinlock, visor solar interno desplegable.',
        precio: 2650.00,
        precio_oferta: 2450.00,
        stock: 18,
        stock_minimo: 5,
        color: 'Negro Mate con Gráficos Neón',
        caracteristicas: JSON.stringify({ certificacion: 'DOT + ECE 22.05', visor_humo: 'Doble Visor' }),
        destacado: 1
    },
    {
        codigo: 'ELE-BOB-RACING',
        nombre: 'Bobina de Alta Tensión Racing Naranja con Cable Siliconado y Capuchón Impermeable',
        categoria_id: 5,
        marca_moto_id: 9,
        modelo_compatible: 'Universal 12V Motos Monocilíndricas (Boxer, CG125/150/200, AX100)',
        descripcion: 'Aumenta hasta 20% el voltaje de la chispa, reduciendo el carbón en la cámara de combustión y mejorando la respuesta del acelerador.',
        precio: 420.00,
        precio_oferta: 380.00,
        stock: 22,
        stock_minimo: 6,
        color: 'Naranja Racing',
        caracteristicas: JSON.stringify({ salida: '35,000 Volts', cable: 'Silicón 8mm' }),
        destacado: 0
    },
    {
        codigo: 'SUS-ACE-MAXIMA15W',
        nombre: 'Aceite Hidráulico para Barras y Amortiguadores Maxima Fork Oil 15W Heavy (1 Litro)',
        categoria_id: 4,
        marca_moto_id: 9,
        modelo_compatible: 'Universal barras telescópicas invertidas y convencionales',
        descripcion: 'Evita la formación de espuma y reduce la fricción interna en las barras de suspensión, garantizando amortiguación suave y sin fugas.',
        precio: 480.00,
        precio_oferta: null,
        stock: 18,
        stock_minimo: 5,
        color: 'Azul',
        caracteristicas: JSON.stringify({ grado: '15W Heavy', aditivos: 'Anti-espuma y acondicionador de retenes' }),
        destacado: 0
    },
    {
        codigo: 'REP-BAL-KOYO6202',
        nombre: 'Juego de 2 Balineras / Rodamientos Japoneses Koyo 6202-2RS con Doble Sello de Goma',
        categoria_id: 3,
        marca_moto_id: 9,
        modelo_compatible: 'Maza de Rin Delantero y Trasero para múltiples marcas',
        descripcion: 'Rodamiento de precisión con sellos de goma herméticos que impiden la entrada de agua y polvo de los caminos de Chontales.',
        precio: 280.00,
        precio_oferta: 250.00,
        stock: 45,
        stock_minimo: 10,
        color: 'Acero con sello negro',
        caracteristicas: JSON.stringify({ medida: '15x35x11 mm', sello: '2RS Goma Nitrilo', marca: 'Koyo Japón' }),
        destacado: 0
    }
];

async function seed() {
    console.log('Iniciando insercion de repuestos...');
    let insertados = 0;
    for (const prod of additionalProducts) {
        try {
            const [exists] = await pool.query('SELECT id FROM productos WHERE codigo = ?', [prod.codigo]);
            if (exists.length > 0) {
                console.log('- Ya existe:', prod.codigo);
                continue;
            }
            await pool.query(
                'INSERT INTO productos (codigo, nombre, categoria_id, marca_moto_id, modelo_compatible, descripcion, precio, precio_oferta, stock, stock_minimo, color, caracteristicas, destacado, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                [
                    prod.codigo,
                    prod.nombre,
                    prod.categoria_id,
                    prod.marca_moto_id,
                    prod.modelo_compatible,
                    prod.descripcion,
                    prod.precio,
                    prod.precio_oferta,
                    prod.stock,
                    prod.stock_minimo,
                    prod.color,
                    prod.caracteristicas,
                    prod.destacado
                ]
            );
            insertados++;
            console.log('+ Insertado:', prod.codigo, prod.nombre);
        } catch (e) {
            console.error('Error insertando ' + prod.codigo + ':', e.message);
        }
    }
    console.log('=== Insercion completada:', insertados, 'productos nuevos insertados. ===');
    const [total] = await pool.query('SELECT count(*) as total FROM productos');
    console.log('Total productos en catalogo deltastore_db:', total[0].total);
    process.exit(0);
}

seed();
