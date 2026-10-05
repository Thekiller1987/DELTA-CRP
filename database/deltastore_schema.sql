-- ==========================================================
-- DELTASTORE - ESQUEMA DE BASE DE DATOS MYSQL
-- Repuestos y Accesorios de Motocicleta - Juigalpa, Nicaragua
-- ==========================================================

CREATE DATABASE IF NOT EXISTS deltastore_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE deltastore_db;

-- 1. Tabla de Usuarios (Administración y Clientes)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'vendedor', 'repartidor', 'cliente') DEFAULT 'cliente',
    telefono VARCHAR(30),
    direccion VARCHAR(255),
    ciudad VARCHAR(100) DEFAULT 'Juigalpa',
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Tabla de Categorías de Repuestos
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icono VARCHAR(50) DEFAULT 'motorcycle',
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- 3. Tabla de Marcas de Motocicletas
CREATE TABLE IF NOT EXISTS marcas_moto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    pais_origen VARCHAR(50),
    popularidad INT DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- 4. Tabla de Productos / Repuestos de Motos
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(180) NOT NULL,
    categoria_id INT NOT NULL,
    marca_moto_id INT,
    modelo_compatible VARCHAR(255) DEFAULT 'Universal / Multimodelo',
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    precio_oferta DECIMAL(10,2) DEFAULT NULL,
    stock INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 5,
    color VARCHAR(60) DEFAULT 'Estándar',
    caracteristicas JSON,
    imagen_base64 LONGTEXT,
    destacado BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    FOREIGN KEY (marca_moto_id) REFERENCES marcas_moto(id) ON DELETE SET NULL,
    INDEX idx_categoria (categoria_id),
    INDEX idx_marca (marca_moto_id),
    INDEX idx_codigo (codigo)
) ENGINE=InnoDB;

-- 5. Tabla de Pedidos / Órdenes
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_orden VARCHAR(40) NOT NULL UNIQUE,
    cliente_nombre VARCHAR(120) NOT NULL,
    cliente_telefono VARCHAR(30) NOT NULL,
    cliente_email VARCHAR(150),
    departamento VARCHAR(60) DEFAULT 'Chontales',
    municipio VARCHAR(60) DEFAULT 'Juigalpa',
    direccion_exacta TEXT NOT NULL,
    punto_referencia TEXT,
    tipo_entrega ENUM('domicilio_gratis_juigalpa', 'retiro_tienda', 'envio_departamental') DEFAULT 'domicilio_gratis_juigalpa',
    metodo_pago ENUM('efectivo_contraentrega', 'transferencia_bancaria', 'tarjeta_online', 'paypal') NOT NULL,
    banco_transferencia VARCHAR(50) DEFAULT NULL,
    referencia_bancaria VARCHAR(100) DEFAULT NULL,
    comprobante_pago_base64 LONGTEXT,
    paypal_order_id VARCHAR(100) DEFAULT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    costo_envio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    moneda VARCHAR(5) DEFAULT 'NIO',
    estado ENUM('nuevo', 'confirmado', 'en_preparacion', 'en_ruta', 'entregado', 'cancelado') DEFAULT 'nuevo',
    repartidor_asignado VARCHAR(100) DEFAULT NULL,
    notas_cliente TEXT,
    notas_admin TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_estado (estado),
    INDEX idx_numero (numero_orden)
) ENGINE=InnoDB;

-- 6. Detalle de los Pedidos
CREATE TABLE IF NOT EXISTS detalle_pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    nombre_producto VARCHAR(180) NOT NULL,
    codigo_producto VARCHAR(50),
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- 7. Registro de Auditoría de Inventario
CREATE TABLE IF NOT EXISTS auditorias_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    tipo_movimiento ENUM('entrada', 'venta', 'ajuste', 'devolucion') NOT NULL,
    cantidad INT NOT NULL,
    stock_anterior INT NOT NULL,
    stock_nuevo INT NOT NULL,
    motivo VARCHAR(255),
    usuario VARCHAR(100) DEFAULT 'Sistema',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB;
