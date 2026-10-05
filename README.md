# DELTA-CRP — Sistema de Gestión Empresarial (CRM, ERP, POS & MySQL)

Repositorio oficial del sistema de gestión y control empresarial **DELTA-CRP** para la distribución de repuestos de motocicletas en Juigalpa y el departamento de Chontales, Nicaragua.

* **Repositorio GitHub:** [https://github.com/Thekiller1987/DELTA-CRP.git](https://github.com/Thekiller1987/DELTA-CRP.git)
* **Sede Operativa:** Juigalpa, Chontales
* **Puerto de Servicio:** `3005` (`http://localhost:3005`)
* **Motor de Base de Datos:** MySQL 8 (`deltastore_db`)

---

## Módulos y Arquitectura del Sistema

1. **Control de Acceso Basado en Roles (RBAC):**
   * `admin`: Acceso total, auditorías de inventario y configuración de sistema.
   * `cajero`: Módulo POS mostrador, cobros multicanal (Efectivo, Tarjetas, Transferencias BAC/Banpro/Lafise) y arqueo diario.
   * `vendedor`: Consulta de catálogo, existencias en tiempo real y registro de órdenes.
   * `repartidor`: Vista simplificada del pipeline Kanban con cambio de estado de entregas en casco urbano.

2. **Pipeline Kanban de Pedidos:**
   * Estados controlados: `Nuevo` $ightarrow$ `Confirmado` $ightarrow$ `En Ruta` $ightarrow$ `Entregado`.
   * Asignación de motorizado y persistencia de entregas en MySQL.

3. **Control y Valuación de Inventarios (Kardex):**
   * Descuento atómico de existencias al confirmar pedidos.
   * Valuación bajo el método de Costo Promedio Ponderado.
   * Registro histórico de auditoría por cada ajuste de stock.

4. **Base de Datos MySQL (`deltastore_db`):**
   * Tablas maestras: `usuarios`, `categorias`, `marcas_moto`, `productos`, `pedidos`, `detalle_pedidos`, `auditorias_inventario`.
   * Ubicación de scripts: `database/deltastore_schema.sql`.

---

## Puesta en Marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Importar base de datos en MySQL
mysql -u root -p deltastore_db < database/deltastore_schema.sql

# 4. Iniciar servidor
npm start
# O mediante el launcher: INICIAR_CRM.bat
```

---

## Suite de Pruebas

Para ejecutar la batería de 36 pruebas automatizadas de integridad:
```bash
npm test
```
