// ==========================================================================
// DELTASTORE CRM & ERP — LOGICA OPERATIVA EMPRESARIAL JUIGALPA (4 PILARES)
// Categorías, Productos, Proveedores, Clientes, POS Mostrador & Arqueo
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. ESTADO GLOBAL CRM
    // -------------------------------------------------------------
    const crm = {
        currentTab: 'tab-dashboard',
        stats: {},
        orders: [],
        products: [],
        categories: [],
        suppliers: [],
        brands: [],
        customers: [],
        posCart: [],
        activeOrderDetail: null,
        currentUser: {
            id: 1,
            nombre: 'Admin Waskar',
            email: 'admin@deltastore.com',
            rol: 'admin',
            ciudad: 'Juigalpa',
            telefono: '+505 8965-4945',
            token: 'jwt_admin_waskar_session_token_1987'
        },
        rbacUsers: []
    };

    // -------------------------------------------------------------
    // 2. INICIALIZACION
    // -------------------------------------------------------------
    initCRM();

    async function initCRM() {
        setupUserSession();
        setupNavigation();
        setupGlobalEvents();
        setupProductEvents();
        setupCategoryEvents();
        setupSupplierEvents();
        setupCustomerEvents();
        setupPOSEvents();
        setupArqueoEvents();

        switchTab('tab-dashboard');
        await refreshAllData();
    }

    async function safeFetch(url, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (crm.currentUser && crm.currentUser.token) {
            headers['Authorization'] = 'Bearer ' + crm.currentUser.token;
        }
        try {
            const res = await fetch(url, { ...options, headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.warn(`Fallo al consultar ${url}:`, e);
            return null;
        }
    }

    function setupUserSession() {
        localStorage.setItem('deltastore_crm_user', JSON.stringify(crm.currentUser));
        const authScreen = document.getElementById('crm-auth-screen');
        const mainLayout = document.getElementById('crm-main-layout');
        if (authScreen) authScreen.style.display = 'none';
        if (mainLayout) mainLayout.style.display = 'flex';

        const nameEl = document.getElementById('current-user-name');
        if (nameEl) nameEl.textContent = crm.currentUser.nombre;

        const btnLogout = document.getElementById('btn-crm-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                alert('Sesión permanente activa como Admin Waskar (Super Administrador).');
            });
        }
    }

    // -------------------------------------------------------------
    // 3. NAVEGACION POR PESTANAS
    // -------------------------------------------------------------
    function setupNavigation() {
        document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.soundEngine) window.soundEngine.playClick();
                const tabId = btn.dataset.tab;
                switchTab(tabId);
            });
        });
    }

    function switchTab(tabId) {
        crm.currentTab = tabId;
        document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        document.querySelectorAll('.crm-tab-view').forEach(view => view.classList.toggle('active', view.id === tabId));

        const titles = {
            'tab-dashboard': 'Dashboard Ejecutivo & Ventas Juigalpa',
            'tab-inventory': 'Inventario & Catálogo de Repuestos',
            'tab-categories': 'Gestión de Categorías de Repuestos',
            'tab-suppliers': 'Directorio de Proveedores de Repuestos',
            'tab-customers': 'Directorio Comercial de Clientes',
            'tab-orders': 'Pipeline de Pedidos & Logística Kanban',
            'tab-pos': 'Terminal POS Mostrador (Venta Física)',
            'tab-reports': 'Reportes Financieros & Exportación',
            'tab-rbac': 'Control de Roles & Seguridad (RBAC)'
        };
        const titleEl = document.getElementById('current-view-title');
        if (titleEl) titleEl.textContent = titles[tabId] || 'Panel Administrativo';
    }

    async function refreshAllData() {
        const btnRefresh = document.getElementById('btn-global-refresh');
        if (btnRefresh) btnRefresh.classList.add('loading');

        await Promise.all([
            loadDashboardStats(),
            loadCategories(),
            loadSuppliers(),
            loadBrands(),
            loadProducts(),
            loadCustomers(),
            loadOrders(),
            loadRbacUsers()
        ]);

        renderPOSProducts();

        if (btnRefresh) btnRefresh.classList.remove('loading');
        if (window.soundEngine) window.soundEngine.playSuccess();
    }

    // -------------------------------------------------------------
    // 4. PILAR 1: PRODUCTOS & INVENTARIO
    // -------------------------------------------------------------
    async function loadProducts() {
        const raw = await safeFetch('/api/crm/products');
        crm.products = Array.isArray(raw) ? raw : (raw?.data || []);
        renderInventoryTable();
    }

    function renderInventoryTable() {
        const tbody = document.getElementById('inventory-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const searchVal = (document.getElementById('inv-search-input')?.value || '').toLowerCase().trim();
        const catVal = document.getElementById('inv-filter-cat')?.value || '';
        const supVal = document.getElementById('inv-filter-sup')?.value || '';

        const filtered = crm.products.filter(p => {
            if (catVal && String(p.categoria_id) !== String(catVal)) return false;
            if (supVal && String(p.proveedor_id) !== String(supVal)) return false;
            if (searchVal) {
                const matchName = (p.nombre || '').toLowerCase().includes(searchVal);
                const matchCode = (p.codigo || '').toLowerCase().includes(searchVal);
                const matchModel = (p.modelo_compatible || '').toLowerCase().includes(searchVal);
                return matchName || matchCode || matchModel;
            }
            return true;
        });

        // Actualizar badges
        const alertBadge = document.getElementById('stock-alert-badge');
        const lowCount = crm.products.filter(p => p.stock <= (p.stock_minimo || 5)).length;
        if (alertBadge) alertBadge.textContent = lowCount;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding:36px; color:#64748b;">
                        <div style="font-size:2rem; margin-bottom:8px;">📦</div>
                        <div style="font-weight:700; color:#ffffff; margin-bottom:4px;">No hay repuestos registrados</div>
                        <small>Haz clic en "➕ Registrar Nuevo Repuesto" para agregar tu inventario real a MySQL.</small>
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach(p => {
            const tr = document.createElement('tr');
            const price = Number(p.precio_oferta || p.precio || 0);
            const cost = Number(p.costo_compra || 0);

            let stockClass = 'stock-ok';
            let stockLabel = `${p.stock} en stock`;
            if (p.stock <= 0) {
                stockClass = 'stock-empty';
                stockLabel = 'AGOTADO';
            } else if (p.stock <= (p.stock_minimo || 5)) {
                stockClass = 'stock-low';
                stockLabel = `Crítico (${p.stock})`;
            }

            const hasImg = p.imagen_base64 && p.imagen_base64.startsWith('data:image');
            const thumbHtml = hasImg 
                ? `<div class="prod-thumb-mini"><img src="${p.imagen_base64}" alt="${p.nombre}"></div>`
                : `<div class="prod-thumb-mini" style="font-size:1.2rem; color:#64748b;">🏍️</div>`;

            tr.innerHTML = `
                <td>${thumbHtml}</td>
                <td><strong style="color:#00f2fe;">${p.codigo || 'REP'}</strong></td>
                <td>
                    <strong style="color:#ffffff;">${p.nombre}</strong>
                    ${p.destacado ? '<span style="font-size:0.7rem; color:#f59e0b; margin-left:6px;">⭐ Portada</span>' : ''}
                </td>
                <td>${p.categoria_nombre || 'General'}</td>
                <td><small style="color:#94a3b8;">${p.proveedor_nombre || 'Sin asignar'}</small></td>
                <td><small>${p.modelo_compatible || 'Universal'}</small></td>
                <td><span style="color:#94a3b8;">C$ ${cost.toFixed(2)}</span></td>
                <td>
                    <strong style="color:#f59e0b;">C$ ${price.toFixed(2)}</strong>
                    ${p.precio_oferta ? `<br><small style="color:#64748b; text-decoration:line-through;">C$ ${Number(p.precio).toFixed(2)}</small>` : ''}
                </td>
                <td><span class="stock-pill ${stockClass}">${stockLabel}</span></td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; gap:4px;">
                        <button class="btn-table-action" onclick="window.crmEditProduct(${p.id})" title="Editar repuesto">
                            ✏️
                        </button>
                        <button class="btn-table-action" onclick="window.crmAdjustStock(${p.id})" title="Ajustar stock">
                            📦
                        </button>
                        <button class="btn-table-action btn-del" onclick="window.crmDeleteProduct(${p.id})" title="Eliminar repuesto">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function setupProductEvents() {
        const searchInp = document.getElementById('inv-search-input');
        const catFilter = document.getElementById('inv-filter-cat');
        const supFilter = document.getElementById('inv-filter-sup');

        if (searchInp) searchInp.addEventListener('input', renderInventoryTable);
        if (catFilter) catFilter.addEventListener('change', renderInventoryTable);
        if (supFilter) supFilter.addEventListener('change', renderInventoryTable);

        const btnOpenNew = document.getElementById('btn-open-create-product-modal');
        const modal = document.getElementById('modal-product-crud');
        const btnClose = document.getElementById('btn-close-product-crud');
        const btnCancel = document.getElementById('btn-cancel-product-crud');
        const form = document.getElementById('form-product-crud');

        if (btnOpenNew) btnOpenNew.addEventListener('click', () => openProductModal());
        if (btnClose && modal) btnClose.addEventListener('click', () => modal.classList.remove('open'));
        if (btnCancel && modal) btnCancel.addEventListener('click', () => modal.classList.remove('open'));

        // Imagen Base64 preview
        const imgFile = document.getElementById('crud-img-file');
        const imgBase64 = document.getElementById('crud-imagen-base64');
        const imgPrev = document.getElementById('crud-img-preview');
        const placeholder = document.getElementById('crud-preview-placeholder');

        if (imgFile) {
            imgFile.addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const b64 = evt.target.result;
                    if (imgBase64) imgBase64.value = b64;
                    if (imgPrev) { imgPrev.src = b64; imgPrev.style.display = 'block'; }
                    if (placeholder) placeholder.style.display = 'none';
                };
                reader.readAsDataURL(f);
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const pId = document.getElementById('crud-product-id')?.value;
                const codigo = document.getElementById('crud-codigo')?.value.trim();
                const nombre = document.getElementById('crud-nombre')?.value.trim();
                const categoria_id = document.getElementById('crud-categoria')?.value;
                const proveedor_id = document.getElementById('crud-proveedor')?.value || null;
                const marca_moto_id = document.getElementById('crud-marca')?.value || null;
                const modelo_compatible = document.getElementById('crud-modelo')?.value.trim() || 'Universal';
                const color = document.getElementById('crud-color')?.value.trim() || 'Estándar';
                const costo_compra = parseFloat(document.getElementById('crud-costo-compra')?.value || 0);
                const precio = parseFloat(document.getElementById('crud-precio')?.value);
                const precio_oferta_val = document.getElementById('crud-precio-oferta')?.value;
                const precio_oferta = precio_oferta_val ? parseFloat(precio_oferta_val) : null;
                const stock = parseInt(document.getElementById('crud-stock')?.value || 0);
                const stock_minimo = parseInt(document.getElementById('crud-stock-minimo')?.value || 5);
                const descripcion = document.getElementById('crud-descripcion')?.value.trim() || '';
                const destacado = document.getElementById('crud-destacado')?.checked || false;
                const imagen_base64 = document.getElementById('crud-imagen-base64')?.value || null;

                const payload = {
                    codigo, nombre, categoria_id: parseInt(categoria_id), proveedor_id: proveedor_id ? parseInt(proveedor_id) : null,
                    marca_moto_id: marca_moto_id ? parseInt(marca_moto_id) : null, modelo_compatible, color,
                    costo_compra, precio, precio_oferta, stock, stock_minimo, descripcion, destacado, imagen_base64
                };

                const url = pId ? `/api/crm/products/${pId}` : '/api/crm/products';
                const method = pId ? 'PUT' : 'POST';

                const res = await safeFetch(url, { method, body: JSON.stringify(payload) });
                if (res && (res.success || res.id)) {
                    if (window.soundEngine) window.soundEngine.playSuccess();
                    if (modal) modal.classList.remove('open');
                    await loadProducts();
                    renderPOSProducts();
                    alert(pId ? '✅ Repuesto actualizado con éxito.' : '✅ Repuesto registrado en MySQL.');
                } else {
                    alert('Error al guardar repuesto: ' + (res?.error || 'Verifica los campos.'));
                }
            });
        }
    }

    function openProductModal(p = null) {
        const modal = document.getElementById('modal-product-crud');
        if (!modal) return;

        const titleEl = document.getElementById('product-modal-title');
        const idInp = document.getElementById('crud-product-id');
        const codeInp = document.getElementById('crud-codigo');
        const nameInp = document.getElementById('crud-nombre');
        const catSelect = document.getElementById('crud-categoria');
        const supSelect = document.getElementById('crud-proveedor');
        const brandSelect = document.getElementById('crud-marca');
        const modelInp = document.getElementById('crud-modelo');
        const colorInp = document.getElementById('crud-color');
        const costInp = document.getElementById('crud-costo-compra');
        const priceInp = document.getElementById('crud-precio');
        const offerInp = document.getElementById('crud-precio-oferta');
        const stockInp = document.getElementById('crud-stock');
        const minStockInp = document.getElementById('crud-stock-minimo');
        const descInp = document.getElementById('crud-descripcion');
        const destCheck = document.getElementById('crud-destacado');
        const imgFile = document.getElementById('crud-img-file');
        const imgBase64 = document.getElementById('crud-imagen-base64');
        const imgPrev = document.getElementById('crud-img-preview');
        const placeholder = document.getElementById('crud-preview-placeholder');

        if (imgFile) imgFile.value = '';
        if (imgBase64) imgBase64.value = '';
        if (imgPrev) { imgPrev.src = ''; imgPrev.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'block';

        if (p) {
            titleEl.textContent = `✏️ Editar: ${p.nombre}`;
            idInp.value = p.id;
            codeInp.value = p.codigo || '';
            nameInp.value = p.nombre || '';
            catSelect.value = p.categoria_id || '';
            if (supSelect) supSelect.value = p.proveedor_id || '';
            if (brandSelect) brandSelect.value = p.marca_moto_id || '';
            modelInp.value = p.modelo_compatible || 'Universal';
            colorInp.value = p.color || 'Estándar';
            if (costInp) costInp.value = p.costo_compra || 0;
            priceInp.value = p.precio || '';
            offerInp.value = p.precio_oferta || '';
            stockInp.value = p.stock !== undefined ? p.stock : 10;
            minStockInp.value = p.stock_minimo || 5;
            descInp.value = p.descripcion || '';
            destCheck.checked = Boolean(p.destacado);

            if (p.imagen_base64 && p.imagen_base64.startsWith('data:image')) {
                imgBase64.value = p.imagen_base64;
                imgPrev.src = p.imagen_base64;
                imgPrev.style.display = 'block';
                placeholder.style.display = 'none';
            }
        } else {
            titleEl.textContent = '📦 Registrar Nuevo Repuesto';
            idInp.value = '';
            codeInp.value = `REP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
            nameInp.value = '';
            if (catSelect && catSelect.options.length > 0) catSelect.selectedIndex = 0;
            if (supSelect) supSelect.value = '';
            if (brandSelect && brandSelect.options.length > 0) brandSelect.selectedIndex = 0;
            modelInp.value = 'Universal';
            colorInp.value = 'Estándar';
            if (costInp) costInp.value = '0';
            priceInp.value = '';
            offerInp.value = '';
            stockInp.value = '10';
            minStockInp.value = '5';
            descInp.value = '';
            destCheck.checked = false;
        }

        modal.classList.add('open');
    }

    window.crmEditProduct = function(id) {
        const prod = crm.products.find(p => p.id === id);
        if (prod) openProductModal(prod);
    };

    window.crmDeleteProduct = async function(id) {
        const prod = crm.products.find(p => p.id === id);
        if (!prod) return;
        if (!confirm(`¿Eliminar "${prod.nombre}" (${prod.codigo}) del catálogo?`)) return;

        const res = await safeFetch(`/api/crm/products/${id}`, { method: 'DELETE' });
        if (res && res.success) {
            if (window.soundEngine) window.soundEngine.playSuccess();
            await loadProducts();
            renderPOSProducts();
        } else {
            alert('No se pudo desactivar el repuesto.');
        }
    };

    window.crmAdjustStock = async function(id) {
        const prod = crm.products.find(p => p.id === id);
        if (!prod) return;

        const newStock = prompt(`Ajustar stock para: ${prod.nombre}\nStock actual: ${prod.stock}\nIngresa el nuevo stock:`, prod.stock);
        if (newStock !== null && !isNaN(parseInt(newStock))) {
            const diff = parseInt(newStock) - prod.stock;
            if (diff !== 0) {
                await safeFetch('/api/crm/inventory/adjust', {
                    method: 'POST',
                    body: JSON.stringify({
                        producto_id: prod.id,
                        tipo_movimiento: diff > 0 ? 'entrada' : 'ajuste',
                        cantidad: Math.abs(diff),
                        motivo: 'Ajuste manual de conteo físico en bodega',
                        usuario: 'Admin Waskar'
                    })
                });
                await loadProducts();
                renderPOSProducts();
            }
        }
    };

    // -------------------------------------------------------------
    // 5. PILAR 2: CATEGORÍAS
    // -------------------------------------------------------------
    async function loadCategories() {
        const raw = await safeFetch('/api/crm/categories');
        crm.categories = Array.isArray(raw) ? raw : (raw?.data || []);
        renderCategoriesTable();
        populateCategorySelects();
    }

    function renderCategoriesTable() {
        const tbody = document.getElementById('categories-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const searchVal = (document.getElementById('cat-search-input')?.value || '').toLowerCase().trim();
        const filtered = crm.categories.filter(c => {
            if (!searchVal) return true;
            return (c.nombre || '').toLowerCase().includes(searchVal) || (c.slug || '').toLowerCase().includes(searchVal);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">No hay categorías registradas.</td></tr>';
            return;
        }

        filtered.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size:1.4rem; text-align:center;">${c.icono || '🏍️'}</td>
                <td><strong style="color:#ffffff;">${c.nombre}</strong></td>
                <td><code style="color:#00f2fe;">${c.slug || '-'}</code></td>
                <td><small style="color:#94a3b8;">${c.descripcion || 'Sin descripción'}</small></td>
                <td><span class="stock-pill stock-ok">${c.total_productos || 0} repuestos</span></td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; gap:6px;">
                        <button class="btn-table-action" onclick="window.crmEditCategory(${c.id})" title="Editar categoría">✏️ Editar</button>
                        <button class="btn-table-action btn-del" onclick="window.crmDeleteCategory(${c.id})" title="Eliminar categoría">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function populateCategorySelects() {
        const crudCat = document.getElementById('crud-categoria');
        const filterCat = document.getElementById('inv-filter-cat');

        if (crudCat) {
            crudCat.innerHTML = '<option value="">Selecciona una Categoría...</option>';
            crm.categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.icono || '🏍️'} ${c.nombre}`;
                crudCat.appendChild(opt);
            });
        }

        if (filterCat) {
            filterCat.innerHTML = '<option value="">Todas las Categorías</option>';
            crm.categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nombre;
                filterCat.appendChild(opt);
            });
        }
    }

    function setupCategoryEvents() {
        const searchInp = document.getElementById('cat-search-input');
        if (searchInp) searchInp.addEventListener('input', renderCategoriesTable);

        const btnOpen = document.getElementById('btn-open-create-cat-modal');
        const modal = document.getElementById('modal-category-crud');
        const btnClose = document.getElementById('btn-close-cat-crud');
        const btnCancel = document.getElementById('btn-cancel-cat-crud');
        const form = document.getElementById('form-cat-crud');

        if (btnOpen) btnOpen.addEventListener('click', () => openCategoryModal());
        if (btnClose && modal) btnClose.addEventListener('click', () => modal.classList.remove('open'));
        if (btnCancel && modal) btnCancel.addEventListener('click', () => modal.classList.remove('open'));

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('crud-cat-id')?.value;
                const nombre = document.getElementById('crud-cat-nombre')?.value.trim();
                const icono = document.getElementById('crud-cat-icono')?.value.trim() || '🏍️';
                const slug = document.getElementById('crud-cat-slug')?.value.trim();
                const descripcion = document.getElementById('crud-cat-desc')?.value.trim();

                const url = id ? `/api/crm/categories/${id}` : '/api/crm/categories';
                const method = id ? 'PUT' : 'POST';

                const res = await safeFetch(url, { method, body: JSON.stringify({ nombre, icono, slug, descripcion }) });
                if (res && (res.success || res.id)) {
                    if (window.soundEngine) window.soundEngine.playSuccess();
                    if (modal) modal.classList.remove('open');
                    await loadCategories();
                    alert(id ? '✅ Categoría actualizada.' : '✅ Categoría creada exitosamente.');
                } else {
                    alert('Error: ' + (res?.error || 'No se pudo guardar'));
                }
            });
        }
    }

    function openCategoryModal(cat = null) {
        const modal = document.getElementById('modal-category-crud');
        if (!modal) return;
        const titleEl = document.getElementById('cat-modal-title');
        const idInp = document.getElementById('crud-cat-id');
        const nameInp = document.getElementById('crud-cat-nombre');
        const iconInp = document.getElementById('crud-cat-icono');
        const slugInp = document.getElementById('crud-cat-slug');
        const descInp = document.getElementById('crud-cat-desc');

        if (cat) {
            titleEl.textContent = `✏️ Editar: ${cat.nombre}`;
            idInp.value = cat.id;
            nameInp.value = cat.nombre;
            iconInp.value = cat.icono || '🏍️';
            slugInp.value = cat.slug || '';
            descInp.value = cat.descripcion || '';
        } else {
            titleEl.textContent = '🏷️ Nueva Categoría';
            idInp.value = '';
            nameInp.value = '';
            iconInp.value = '🏍️';
            slugInp.value = '';
            descInp.value = '';
        }
        modal.classList.add('open');
    }

    window.crmEditCategory = function(id) {
        const cat = crm.categories.find(c => c.id === id);
        if (cat) openCategoryModal(cat);
    };

    window.crmDeleteCategory = async function(id) {
        const cat = crm.categories.find(c => c.id === id);
        if (!cat) return;
        if (!confirm(`¿Desactivar categoría "${cat.nombre}"?`)) return;
        const res = await safeFetch(`/api/crm/categories/${id}`, { method: 'DELETE' });
        if (res && res.success) {
            if (window.soundEngine) window.soundEngine.playSuccess();
            await loadCategories();
        }
    };

    // -------------------------------------------------------------
    // 6. PILAR 3: PROVEEDORES
    // -------------------------------------------------------------
    async function loadSuppliers() {
        const raw = await safeFetch('/api/crm/suppliers');
        crm.suppliers = Array.isArray(raw) ? raw : (raw?.data || []);
        renderSuppliersTable();
        populateSupplierSelects();
    }

    function renderSuppliersTable() {
        const tbody = document.getElementById('suppliers-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const searchVal = (document.getElementById('sup-search-input')?.value || '').toLowerCase().trim();
        const filtered = crm.suppliers.filter(s => {
            if (!searchVal) return true;
            return (s.nombre_comercial || '').toLowerCase().includes(searchVal) ||
                   (s.contacto_nombre || '').toLowerCase().includes(searchVal) ||
                   (s.ruc || '').toLowerCase().includes(searchVal);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">No hay proveedores registrados.</td></tr>';
            return;
        }

        filtered.forEach(s => {
            const tr = document.createElement('tr');
            const cleanPhone = (s.telefono || '').replace(/[^0-9]/g, '');
            tr.innerHTML = `
                <td><strong style="color:#ffffff;">${s.nombre_comercial}</strong></td>
                <td>${s.contacto_nombre || '-'}</td>
                <td><code style="color:#94a3b8;">${s.ruc || '-'}</code></td>
                <td><strong style="color:#00f2fe;">${s.telefono || '-'}</strong></td>
                <td>${s.ciudad || 'Juigalpa'}</td>
                <td><span class="stock-pill stock-ok">${s.total_productos || 0} repuestos</span></td>
                <td>
                    ${cleanPhone ? `<a href="https://wa.me/505${cleanPhone}" target="_blank" class="btn-table-action" style="color:#10b981; text-decoration:none;">💬 WhatsApp</a>` : '-'}
                </td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; gap:6px;">
                        <button class="btn-table-action" onclick="window.crmEditSupplier(${s.id})" title="Editar proveedor">✏️ Editar</button>
                        <button class="btn-table-action btn-del" onclick="window.crmDeleteSupplier(${s.id})" title="Eliminar proveedor">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function populateSupplierSelects() {
        const crudSup = document.getElementById('crud-proveedor');
        const filterSup = document.getElementById('inv-filter-sup');

        if (crudSup) {
            crudSup.innerHTML = '<option value="">Sin proveedor asignado</option>';
            crm.suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.nombre_comercial;
                crudSup.appendChild(opt);
            });
        }

        if (filterSup) {
            filterSup.innerHTML = '<option value="">Todos los Proveedores</option>';
            crm.suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.nombre_comercial;
                filterSup.appendChild(opt);
            });
        }
    }

    function setupSupplierEvents() {
        const searchInp = document.getElementById('sup-search-input');
        if (searchInp) searchInp.addEventListener('input', renderSuppliersTable);

        const btnOpen = document.getElementById('btn-open-create-sup-modal');
        const modal = document.getElementById('modal-supplier-crud');
        const btnClose = document.getElementById('btn-close-sup-crud');
        const btnCancel = document.getElementById('btn-cancel-sup-crud');
        const form = document.getElementById('form-sup-crud');

        if (btnOpen) btnOpen.addEventListener('click', () => openSupplierModal());
        if (btnClose && modal) btnClose.addEventListener('click', () => modal.classList.remove('open'));
        if (btnCancel && modal) btnCancel.addEventListener('click', () => modal.classList.remove('open'));

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('crud-sup-id')?.value;
                const nombre_comercial = document.getElementById('crud-sup-nombre')?.value.trim();
                const ruc = document.getElementById('crud-sup-ruc')?.value.trim();
                const contacto_nombre = document.getElementById('crud-sup-contacto')?.value.trim();
                const telefono = document.getElementById('crud-sup-telefono')?.value.trim();
                const email = document.getElementById('crud-sup-email')?.value.trim();
                const ciudad = document.getElementById('crud-sup-ciudad')?.value.trim();
                const direccion = document.getElementById('crud-sup-direccion')?.value.trim();
                const notas = document.getElementById('crud-sup-notas')?.value.trim();

                const payload = { nombre_comercial, ruc, contacto_nombre, telefono, email, ciudad, direccion, notas };
                const url = id ? `/api/crm/suppliers/${id}` : '/api/crm/suppliers';
                const method = id ? 'PUT' : 'POST';

                const res = await safeFetch(url, { method, body: JSON.stringify(payload) });
                if (res && (res.success || res.id)) {
                    if (window.soundEngine) window.soundEngine.playSuccess();
                    if (modal) modal.classList.remove('open');
                    await loadSuppliers();
                    alert(id ? '✅ Proveedor actualizado.' : '✅ Proveedor registrado exitosamente.');
                } else {
                    alert('Error: ' + (res?.error || 'No se pudo guardar proveedor'));
                }
            });
        }
    }

    function openSupplierModal(sup = null) {
        const modal = document.getElementById('modal-supplier-crud');
        if (!modal) return;
        const titleEl = document.getElementById('sup-modal-title');
        const idInp = document.getElementById('crud-sup-id');
        const nameInp = document.getElementById('crud-sup-nombre');
        const rucInp = document.getElementById('crud-sup-ruc');
        const contactInp = document.getElementById('crud-sup-contacto');
        const telInp = document.getElementById('crud-sup-telefono');
        const emailInp = document.getElementById('crud-sup-email');
        const cityInp = document.getElementById('crud-sup-ciudad');
        const dirInp = document.getElementById('crud-sup-direccion');
        const notesInp = document.getElementById('crud-sup-notas');

        if (sup) {
            titleEl.textContent = `✏️ Editar: ${sup.nombre_comercial}`;
            idInp.value = sup.id;
            nameInp.value = sup.nombre_comercial;
            rucInp.value = sup.ruc || '';
            contactInp.value = sup.contacto_nombre || '';
            telInp.value = sup.telefono || '';
            emailInp.value = sup.email || '';
            cityInp.value = sup.ciudad || 'Juigalpa';
            dirInp.value = sup.direccion || '';
            notesInp.value = sup.notas || '';
        } else {
            titleEl.textContent = '🏭 Registrar Proveedor';
            idInp.value = '';
            nameInp.value = '';
            rucInp.value = '';
            contactInp.value = '';
            telInp.value = '';
            emailInp.value = '';
            cityInp.value = 'Juigalpa';
            dirInp.value = '';
            notesInp.value = '';
        }
        modal.classList.add('open');
    }

    window.crmEditSupplier = function(id) {
        const sup = crm.suppliers.find(s => s.id === id);
        if (sup) openSupplierModal(sup);
    };

    window.crmDeleteSupplier = async function(id) {
        const sup = crm.suppliers.find(s => s.id === id);
        if (!sup) return;
        if (!confirm(`¿Desactivar proveedor "${sup.nombre_comercial}"?`)) return;
        const res = await safeFetch(`/api/crm/suppliers/${id}`, { method: 'DELETE' });
        if (res && res.success) {
            if (window.soundEngine) window.soundEngine.playSuccess();
            await loadSuppliers();
        }
    };

    // -------------------------------------------------------------
    // 7. PILAR 4: CLIENTES
    // -------------------------------------------------------------
    async function loadCustomers() {
        const raw = await safeFetch('/api/crm/customers');
        crm.customers = Array.isArray(raw) ? raw : (raw?.data || []);
        renderCustomersTable();
    }

    function renderCustomersTable() {
        const tbody = document.getElementById('customers-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const searchVal = (document.getElementById('cust-search-input')?.value || '').toLowerCase().trim();
        const filtered = crm.customers.filter(c => {
            if (!searchVal) return true;
            return (c.nombre || '').toLowerCase().includes(searchVal) ||
                   (c.telefono || '').toLowerCase().includes(searchVal) ||
                   (c.cedula_ruc || '').toLowerCase().includes(searchVal);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">No hay clientes registrados en el directorio.</td></tr>';
            return;
        }

        filtered.forEach(c => {
            const tr = document.createElement('tr');
            const cleanPhone = (c.telefono || '').replace(/[^0-9]/g, '');
            const total = Number(c.total_compras || c.total_gastado || 0);
            const pedidos = c.pedidos_count !== undefined ? c.pedidos_count : (c.total_pedidos || 0);

            tr.innerHTML = `
                <td><strong style="color:#ffffff;">${c.nombre}</strong></td>
                <td><strong style="color:#00f2fe;">${c.telefono}</strong></td>
                <td><code style="color:#94a3b8;">${c.cedula_ruc || '-'}</code></td>
                <td><small>${c.direccion || c.municipio || 'Juigalpa'}</small></td>
                <td><strong style="color:#ffffff;">${pedidos} pedidos</strong></td>
                <td><strong style="color:#f59e0b;">C$ ${total.toFixed(2)}</strong></td>
                <td>
                    ${cleanPhone ? `<a href="https://wa.me/505${cleanPhone}" target="_blank" class="btn-table-action" style="color:#10b981; text-decoration:none;">💬 WhatsApp</a>` : '-'}
                </td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; gap:6px;">
                        <button class="btn-table-action" onclick="window.crmEditCustomer(${c.id})" title="Editar cliente">✏️ Editar</button>
                        <button class="btn-table-action btn-del" onclick="window.crmDeleteCustomer(${c.id})" title="Eliminar cliente">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function setupCustomerEvents() {
        const searchInp = document.getElementById('cust-search-input');
        if (searchInp) searchInp.addEventListener('input', renderCustomersTable);

        const btnOpen = document.getElementById('btn-open-create-cust-modal');
        const modal = document.getElementById('modal-customer-crud');
        const btnClose = document.getElementById('btn-close-cust-crud');
        const btnCancel = document.getElementById('btn-cancel-cust-crud');
        const form = document.getElementById('form-cust-crud');

        if (btnOpen) btnOpen.addEventListener('click', () => openCustomerModal());
        if (btnClose && modal) btnClose.addEventListener('click', () => modal.classList.remove('open'));
        if (btnCancel && modal) btnCancel.addEventListener('click', () => modal.classList.remove('open'));

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('crud-cust-id')?.value;
                const nombre = document.getElementById('crud-cust-nombre')?.value.trim();
                const telefono = document.getElementById('crud-cust-telefono')?.value.trim();
                const cedula_ruc = document.getElementById('crud-cust-cedula')?.value.trim();
                const email = document.getElementById('crud-cust-email')?.value.trim();
                const municipio = document.getElementById('crud-cust-municipio')?.value.trim() || 'Juigalpa';
                const direccion = document.getElementById('crud-cust-direccion')?.value.trim();
                const punto_referencia = document.getElementById('crud-cust-referencia')?.value.trim();
                const notas = document.getElementById('crud-cust-notas')?.value.trim();

                const payload = { nombre, telefono, cedula_ruc, email, municipio, direccion, punto_referencia, notas };
                const url = id ? `/api/crm/customers/${id}` : '/api/crm/customers';
                const method = id ? 'PUT' : 'POST';

                const res = await safeFetch(url, { method, body: JSON.stringify(payload) });
                if (res && (res.success || res.id)) {
                    if (window.soundEngine) window.soundEngine.playSuccess();
                    if (modal) modal.classList.remove('open');
                    await loadCustomers();
                    alert(id ? '✅ Cliente actualizado.' : '✅ Cliente registrado en el directorio.');
                } else {
                    alert('Error: ' + (res?.error || 'No se pudo guardar cliente'));
                }
            });
        }
    }

    function openCustomerModal(cust = null) {
        const modal = document.getElementById('modal-customer-crud');
        if (!modal) return;
        const titleEl = document.getElementById('cust-modal-title');
        const idInp = document.getElementById('crud-cust-id');
        const nameInp = document.getElementById('crud-cust-nombre');
        const telInp = document.getElementById('crud-cust-telefono');
        const cedulaInp = document.getElementById('crud-cust-cedula');
        const emailInp = document.getElementById('crud-cust-email');
        const munInp = document.getElementById('crud-cust-municipio');
        const dirInp = document.getElementById('crud-cust-direccion');
        const refInp = document.getElementById('crud-cust-referencia');
        const notesInp = document.getElementById('crud-cust-notas');

        if (cust) {
            titleEl.textContent = `✏️ Editar: ${cust.nombre}`;
            idInp.value = cust.id;
            nameInp.value = cust.nombre;
            telInp.value = cust.telefono;
            cedulaInp.value = cust.cedula_ruc || '';
            emailInp.value = cust.email || '';
            munInp.value = cust.municipio || 'Juigalpa';
            dirInp.value = cust.direccion || '';
            refInp.value = cust.punto_referencia || '';
            notesInp.value = cust.notas || '';
        } else {
            titleEl.textContent = '👥 Registrar Cliente';
            idInp.value = '';
            nameInp.value = '';
            telInp.value = '';
            cedulaInp.value = '';
            emailInp.value = '';
            munInp.value = 'Juigalpa';
            dirInp.value = '';
            refInp.value = '';
            notesInp.value = '';
        }
        modal.classList.add('open');
    }

    window.crmEditCustomer = function(id) {
        const cust = crm.customers.find(c => c.id === id);
        if (cust) openCustomerModal(cust);
    };

    window.crmDeleteCustomer = async function(id) {
        const cust = crm.customers.find(c => c.id === id);
        if (!cust) return;
        if (!confirm(`¿Desactivar cliente "${cust.nombre}"?`)) return;
        const res = await safeFetch(`/api/crm/customers/${id}`, { method: 'DELETE' });
        if (res && res.success) {
            if (window.soundEngine) window.soundEngine.playSuccess();
            await loadCustomers();
        }
    };

    // -------------------------------------------------------------
    // MARCAS DE MOTOCICLETAS
    // -------------------------------------------------------------
    async function loadBrands() {
        const raw = await safeFetch('/api/crm/brands');
        crm.brands = Array.isArray(raw) ? raw : (raw?.data || []);
        const brandSelect = document.getElementById('crud-marca');
        if (brandSelect) {
            brandSelect.innerHTML = '<option value="">Sin marca específica (Universal)</option>';
            crm.brands.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.nombre;
                brandSelect.appendChild(opt);
            });
        }
    }

    // -------------------------------------------------------------
    // DASHBOARD KPIS & GRAFICOS
    // -------------------------------------------------------------
    async function loadDashboardStats() {
        const data = await safeFetch('/api/crm/stats/dashboard');
        if (!data) return;
        crm.stats = data;

        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('kpi-sales-today', `C$ ${Number(data.ventas_hoy || 0).toFixed(2)}`);
        setTxt('kpi-sales-month', `C$ ${Number(data.ventas_mes || 0).toFixed(2)}`);
        setTxt('kpi-orders-count', data.pedidos_pendientes || 0);
        setTxt('kpi-stock-low', data.stock_bajo || 0);
        setTxt('kpi-inventory-val', `C$ ${Number(data.valor_inventario || 0).toFixed(2)}`);

        renderTrendChart(data.tendencia_ventas || []);
        renderTopProducts(data.top_productos || []);
        renderRecentOrders(data.ultimos_pedidos || []);
    }

    function renderTrendChart(trendData) {
        const container = document.getElementById('trend-chart-box');
        if (!container) return;
        if (!trendData || trendData.length === 0) {
            container.innerHTML = '<div style="color:#64748b; text-align:center; padding:40px;">No hay historial de ventas en los últimos 7 días.</div>';
            return;
        }

        const maxVal = Math.max(...trendData.map(d => Number(d.total) || 1), 1000);
        const width = 500;
        const height = 160;
        const padding = 20;

        const points = trendData.map((d, idx) => {
            const x = padding + (idx * ((width - padding * 2) / (trendData.length - 1 || 1)));
            const y = height - padding - ((Number(d.total) / maxVal) * (height - padding * 2));
            return { x, y, total: d.total, fecha: d.fecha };
        });

        const pathD = points.reduce((acc, p, idx) => idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
        const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

        container.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; overflow:visible;">
                <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#00f2fe" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                <path d="${areaD}" fill="url(#chartGrad)"/>
                <path d="${pathD}" fill="none" stroke="#00f2fe" stroke-width="3" stroke-linecap="round"/>
                ${points.map(p => `
                    <circle cx="${p.x}" cy="${p.y}" r="4" fill="#ffffff" stroke="#00f2fe" stroke-width="2"/>
                    <text x="${p.x}" y="${p.y - 10}" fill="#00f2fe" font-size="10" font-weight="bold" text-anchor="middle">C$ ${Math.round(p.total)}</text>
                `).join('')}
            </svg>
        `;
    }

    function renderTopProducts(topList) {
        const box = document.getElementById('top-products-list');
        if (!box) return;
        box.innerHTML = '';
        if (!topList || topList.length === 0) {
            box.innerHTML = '<div style="color:#64748b; font-size:0.85rem;">Sin registros de ventas aún.</div>';
            return;
        }

        const maxSold = Math.max(...topList.map(t => Number(t.total_vendido) || 1));
        topList.forEach((item, idx) => {
            const pct = Math.round((Number(item.total_vendido) / maxSold) * 100);
            const row = document.createElement('div');
            row.style.marginBottom = '12px';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:0.84rem; margin-bottom:4px;">
                    <strong style="color:#ffffff;">#${idx + 1} ${item.nombre_producto}</strong>
                    <span style="color:#f59e0b; font-weight:700;">${item.total_vendido} vendidos</span>
                </div>
                <div style="background:#070d19; height:6px; border-radius:999px; overflow:hidden;">
                    <div style="background:linear-gradient(90deg, #00f2fe, #f59e0b); width:${pct}%; height:100%; border-radius:999px;"></div>
                </div>
            `;
            box.appendChild(row);
        });
    }

    function renderRecentOrders(recent) {
        const box = document.getElementById('recent-orders-table-body');
        if (!box) return;
        box.innerHTML = '';
        if (!recent || recent.length === 0) {
            box.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay pedidos recientes.</td></tr>';
            return;
        }

        recent.forEach(ord => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color:#00f2fe;">${ord.numero_orden}</strong></td>
                <td>${ord.cliente_nombre}</td>
                <td><strong style="color:#f59e0b;">C$ ${Number(ord.total).toFixed(2)}</strong></td>
                <td><span class="stock-pill ${ord.estado === 'entregado' ? 'stock-ok' : 'stock-low'}">${ord.estado}</span></td>
                <td><button class="btn-topbar" onclick="window.crmViewOrder(${ord.id})">Ver</button></td>
            `;
            box.appendChild(tr);
        });
    }

    // -------------------------------------------------------------
    // PIPELINE DE PEDIDOS KANBAN
    // -------------------------------------------------------------
    async function loadOrders() {
        const raw = await safeFetch('/api/crm/orders');
        crm.orders = Array.isArray(raw) ? raw : (raw?.data || []);

        const badge = document.getElementById('orders-badge-count');
        if (badge) badge.textContent = crm.orders.filter(o => o.estado !== 'entregado' && o.estado !== 'cancelado').length;

        renderOrdersKanban();
    }

    function renderOrdersKanban() {
        const cols = {
            nuevo: document.getElementById('kanban-col-nuevo'),
            confirmado: document.getElementById('kanban-col-confirmado'),
            en_ruta: document.getElementById('kanban-col-en_ruta'),
            entregado: document.getElementById('kanban-col-entregado')
        };
        const counts = {
            nuevo: document.getElementById('count-nuevo'),
            confirmado: document.getElementById('count-confirmado'),
            en_ruta: document.getElementById('count-en_ruta'),
            entregado: document.getElementById('count-entregado')
        };

        Object.keys(cols).forEach(k => {
            if (cols[k]) cols[k].innerHTML = '';
            if (counts[k]) counts[k].textContent = '0';
        });

        const grouped = { nuevo: 0, confirmado: 0, en_ruta: 0, entregado: 0 };

        crm.orders.forEach(ord => {
            const state = (ord.estado === 'en_preparacion') ? 'confirmado' : ord.estado;
            if (cols[state]) {
                grouped[state] = (grouped[state] || 0) + 1;
                cols[state].appendChild(createKanbanCard(ord));
            }
        });

        Object.keys(counts).forEach(k => {
            if (counts[k]) counts[k].textContent = grouped[k] || 0;
        });
    }

    function createKanbanCard(order) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.addEventListener('click', () => openOrderDetailModal(order));

        const nextActionMap = {
            nuevo: { text: '📦 Pasar a Bodega', nextState: 'confirmado' },
            confirmado: { text: '🛵 Asignar Motorizado', nextState: 'en_ruta' },
            en_ruta: { text: '✅ Marcar Entregado', nextState: 'entregado' }
        };
        const nextAction = nextActionMap[order.estado];

        card.innerHTML = `
            <div class="card-header-row">
                <span class="order-code-badge">${order.numero_orden}</span>
                <span class="order-time">${new Date(order.creado_en).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="order-client-name">${order.cliente_nombre}</div>
            <div class="order-address-snippet">📍 ${order.direccion_exacta || 'Juigalpa'}</div>
            <div class="order-footer-row">
                <span class="order-price">C$ ${Number(order.total).toFixed(2)}</span>
                ${nextAction ? `<button class="btn-advance-order">${nextAction.text}</button>` : '<span style="color:#10b981; font-weight:700; font-size:0.75rem;">✓ Finalizado</span>'}
            </div>
        `;

        const btnAdv = card.querySelector('.btn-advance-order');
        if (btnAdv && nextAction) {
            btnAdv.addEventListener('click', async (e) => {
                e.stopPropagation();
                await updateOrderStatus(order.id, nextAction.nextState);
            });
        }
        return card;
    }

    async function updateOrderStatus(orderId, newStatus, driver = null) {
        const body = { estado: newStatus };
        if (driver) body.repartidor_asignado = driver;
        const res = await safeFetch(`/api/crm/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify(body) });
        if (res && res.success) {
            if (window.soundEngine) window.soundEngine.playSuccess();
            await loadOrders();
            await loadDashboardStats();
        }
    }

    window.crmViewOrder = function(orderId) {
        const found = crm.orders.find(o => o.id === orderId);
        if (found) openOrderDetailModal(found);
    };

    function openOrderDetailModal(order) {
        crm.activeOrderDetail = order;
        const modal = document.getElementById('crm-order-modal');
        if (!modal) return;

        document.getElementById('m-order-title').textContent = `Pedido: ${order.numero_orden}`;
        document.getElementById('m-order-client').textContent = `${order.cliente_nombre} (Tel: ${order.cliente_telefono || 'N/A'})`;
        document.getElementById('m-order-address').textContent = `${order.direccion_exacta || 'Juigalpa'} (Ref: ${order.punto_referencia || 'N/A'})`;
        document.getElementById('m-order-total').textContent = `C$ ${Number(order.total).toFixed(2)}`;
        document.getElementById('m-order-status-select').value = order.estado;
        document.getElementById('m-order-driver').value = order.repartidor_asignado || '';

        const btnWa = document.getElementById('btn-order-wa');
        if (btnWa) {
            const phone = (order.cliente_telefono || '').replace(/[^0-9]/g, '');
            const msg = encodeURIComponent(`¡Hola ${order.cliente_nombre}! Te saludamos de DeltaStore Juigalpa sobre tu pedido ${order.numero_orden}. Estado actual: ${order.estado}.`);
            btnWa.onclick = () => window.open(`https://wa.me/505${phone}?text=${msg}`, '_blank');
        }
        modal.classList.add('open');
    }

    // -------------------------------------------------------------
    // TERMINAL POS MOSTRADOR
    // -------------------------------------------------------------
    function renderPOSProducts() {
        const grid = document.getElementById('pos-grid-items');
        if (!grid) return;
        grid.innerHTML = '';

        crm.products.forEach(p => {
            const price = Number(p.precio_oferta || p.precio || 0);
            const card = document.createElement('div');
            card.className = 'pos-item-card';
            card.innerHTML = `
                <div style="font-size:0.7rem; color:#94a3b8; font-weight:700;">${p.codigo || 'REP'}</div>
                <div class="pos-item-title">${p.nombre}</div>
                <div style="font-size:0.75rem; color:${p.stock > 0 ? '#10b981' : '#f43f5e'};">Stock: ${p.stock}</div>
                <div class="pos-item-price">C$ ${price.toFixed(2)}</div>
            `;
            card.addEventListener('click', () => addToPOS(p));
            grid.appendChild(card);
        });
    }

    function addToPOS(product) {
        if (product.stock <= 0) {
            alert('¡Producto agotado en bodega!');
            return;
        }

        const existing = crm.posCart.find(i => i.producto_id === product.id);
        if (existing) {
            if (existing.cantidad < product.stock) {
                existing.cantidad++;
            } else {
                alert('No hay más stock disponible para este repuesto.');
            }
        } else {
            crm.posCart.push({
                producto_id: product.id,
                codigo: product.codigo,
                nombre: product.nombre,
                precio: Number(product.precio_oferta || product.precio || 0),
                cantidad: 1,
                stock_max: product.stock
            });
        }
        if (window.soundEngine) window.soundEngine.playAddToCart();
        renderPOSTicket();
    }

    function renderPOSTicket() {
        const list = document.getElementById('pos-ticket-items');
        if (!list) return;
        list.innerHTML = '';

        let subtotal = 0;
        crm.posCart.forEach((it, idx) => {
            const lineTotal = it.precio * it.cantidad;
            subtotal += lineTotal;

            const row = document.createElement('div');
            row.className = 'ticket-row';
            row.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:700; color:#ffffff;">${it.nombre}</div>
                    <div style="font-size:0.75rem; color:#00f2fe;">C$ ${it.precio.toFixed(2)} x ${it.cantidad}</div>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <button class="qty-btn btn-pos-minus">-</button>
                    <span style="font-weight:700; min-width:18px; text-align:center;">${it.cantidad}</span>
                    <button class="qty-btn btn-pos-plus">+</button>
                    <button class="btn-remove-cart btn-pos-del" style="margin-left:6px;">✕</button>
                </div>
            `;

            row.querySelector('.btn-pos-minus').onclick = () => {
                if (it.cantidad > 1) it.cantidad--;
                else crm.posCart.splice(idx, 1);
                renderPOSTicket();
            };
            row.querySelector('.btn-pos-plus').onclick = () => {
                if (it.cantidad < it.stock_max) it.cantidad++;
                else alert('Stock máximo alcanzado.');
                renderPOSTicket();
            };
            row.querySelector('.btn-pos-del').onclick = () => {
                crm.posCart.splice(idx, 1);
                renderPOSTicket();
            };
            list.appendChild(row);
        });

        const subtotalEl = document.getElementById('pos-calc-subtotal');
        const totalEl = document.getElementById('pos-calc-total');
        const cashInput = document.getElementById('pos-cash-input');
        const changeEl = document.getElementById('pos-calc-change');

        if (subtotalEl) subtotalEl.textContent = `C$ ${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `C$ ${subtotal.toFixed(2)}`;

        const cashGiven = Number(cashInput ? cashInput.value : 0) || 0;
        const change = Math.max(0, cashGiven - subtotal);
        if (changeEl) changeEl.textContent = `C$ ${change.toFixed(2)}`;

        const btnCharge = document.getElementById('btn-pos-charge');
        if (btnCharge) {
            btnCharge.disabled = crm.posCart.length === 0;
            btnCharge.style.opacity = crm.posCart.length === 0 ? '0.5' : '1';
        }
    }

    function setupPOSEvents() {
        const cashInp = document.getElementById('pos-cash-input');
        if (cashInp) cashInp.addEventListener('input', renderPOSTicket);

        const btnCharge = document.getElementById('btn-pos-charge');
        if (btnCharge) {
            btnCharge.addEventListener('click', async () => {
                if (crm.posCart.length === 0) return;

                const clientName = document.getElementById('pos-client-name')?.value.trim() || 'Cliente Mostrador Juigalpa';
                const clientPhone = document.getElementById('pos-client-phone')?.value.trim() || 'N/A';
                const method = document.getElementById('pos-payment-select')?.value || 'efectivo_contraentrega';

                btnCharge.disabled = true;
                btnCharge.textContent = '⏳ Facturando venta...';

                const res = await safeFetch('/api/crm/pos/sale', {
                    method: 'POST',
                    body: JSON.stringify({
                        cliente_nombre: clientName,
                        cliente_telefono: clientPhone,
                        metodo_pago: method,
                        items: crm.posCart.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
                    })
                });

                btnCharge.disabled = false;
                btnCharge.textContent = '💵 Cobrar Venta & Imprimir Ticket';

                if (res && res.success) {
                    if (window.soundEngine) window.soundEngine.playCheckout();
                    if (window.triggerConfetti) window.triggerConfetti();
                    openThermalReceipt(res, clientName, clientPhone);
                    crm.posCart = [];
                    renderPOSTicket();
                    await refreshAllData();
                } else {
                    alert('Error en cobro: ' + (res?.error || 'Verifique stock.'));
                }
            });
        }
    }

    function openThermalReceipt(saleData, clientName, clientPhone) {
        const modal = document.getElementById('crm-receipt-modal');
        const content = document.getElementById('thermal-receipt-printable');
        if (!modal || !content) return;

        const dateStr = new Date().toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
        const totalNum = Number(saleData.total || 0);
        const subtotalNum = totalNum / 1.15;
        const ivaNum = totalNum - subtotalNum;
        const totalUsd = totalNum / 36.62;

        let rowsHtml = '';
        (saleData.items || []).forEach(it => {
            rowsHtml += `
                <tr>
                    <td style="padding:2px 0; text-align:left;">${it.nombre || 'Repuesto'}</td>
                    <td style="text-align:center;">${it.cantidad || 1}</td>
                    <td style="text-align:right;">C$ ${(it.subtotal || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        content.innerHTML = `
            <div style="font-family:'Courier New', monospace; color:#000; font-size:12px; line-height:1.25;">
                <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">
                    <div style="font-size:16px; font-weight:900;">⚡ DELTASTORE ⚡</div>
                    <div style="font-size:11px; font-weight:700;">REPUESTOS & ACCESORIOS DE MOTO</div>
                    <div style="font-size:10px;">RUC: J0310000284910 &bull; Juigalpa, Chontales</div>
                </div>
                <div style="margin-bottom:6px; font-size:11px;">
                    <div><strong>Ticket:</strong> #${saleData.numero_orden} | ${dateStr}</div>
                    <div><strong>Cliente:</strong> ${clientName}</div>
                    ${clientPhone && clientPhone !== 'N/A' ? `<div><strong>Tel:</strong> ${clientPhone}</div>` : ''}
                    <div><strong>Atendido por:</strong> Admin Waskar</div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:6px;">
                    <thead><tr style="border-bottom:1px solid #000;"><th style="text-align:left;">DESCRIPCIÓN</th><th>CANT</th><th style="text-align:right;">TOTAL</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div style="border-top:1px dashed #000; padding-top:4px; font-size:11px;">
                    <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>C$ ${subtotalNum.toFixed(2)}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>IVA (15%):</span><span>C$ ${ivaNum.toFixed(2)}</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900; border-top:1px solid #000; border-bottom:1px solid #000; padding:3px 0;">
                        <span>TOTAL CÓRDOBAS:</span><span>C$ ${totalNum.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#333;"><span>Equiv. USD (36.62):</span><span>$ ${totalUsd.toFixed(2)}</span></div>
                </div>
                <div style="text-align:center; font-size:9.5px; margin-top:6px; border-top:1px dashed #000; padding-top:4px;">
                    ¡GRACIAS POR SU COMPRA!<br>Garantía de 30 días con este ticket.
                </div>
            </div>
        `;
        modal.classList.add('open');
    }

    // -------------------------------------------------------------
    // ARQUEO DE CAJA
    // -------------------------------------------------------------
    function setupArqueoEvents() {
        const btnOpen = document.getElementById('btn-open-arqueo');
        const modal = document.getElementById('modal-arqueo-caja');
        const btnClose = document.getElementById('btn-close-arqueo');
        if (btnOpen && modal) {
            btnOpen.addEventListener('click', async () => {
                modal.classList.add('open');
                await loadLiveCashStatus();
                calculateArqueo();
            });
        }
        if (btnClose && modal) btnClose.addEventListener('click', () => modal.classList.remove('open'));

        document.querySelectorAll('.arqueo-input').forEach(inp => {
            inp.addEventListener('input', calculateArqueo);
        });
        const usdInp = document.getElementById('arqueo-usd-input');
        if (usdInp) usdInp.addEventListener('input', calculateArqueo);

        const btnSave = document.getElementById('btn-save-arqueo');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                const totalFisicoText = document.getElementById('arqueo-total-fisico')?.textContent || '0';
                const totalFisico = parseFloat(totalFisicoText.replace(/[^0-9.]/g, '')) || 0;
                const fondoInicial = parseFloat(document.getElementById('arqueo-fondo-inicial')?.value || 1000);

                const res = await safeFetch('/api/crm/cash-closing', {
                    method: 'POST',
                    body: JSON.stringify({
                        cajero: 'Admin Waskar',
                        fondo_inicial: fondoInicial,
                        total_efectivo_declarado: totalFisico,
                        total_general: totalFisico,
                        observaciones: document.getElementById('arqueo-observaciones')?.value || 'Cierre conforme'
                    })
                });
                if (res && res.success) {
                    if (window.soundEngine) window.soundEngine.playSuccess();
                    alert('✅ Cierre de caja registrado exitosamente.');
                    if (modal) modal.classList.remove('open');
                }
            });
        }
    }

    let cashStatusData = null;
    async function loadLiveCashStatus() {
        cashStatusData = await safeFetch('/api/crm/cash-closing/current');
        const vtaEl = document.getElementById('arqueo-ventas-sistema');
        if (vtaEl && cashStatusData?.efectivo) {
            vtaEl.textContent = `C$ ${Number(cashStatusData.efectivo.total || 0).toFixed(2)} (${cashStatusData.efectivo.pedidos || 0} vtas)`;
        }
    }

    function calculateArqueo() {
        let totalCordobas = 0;
        document.querySelectorAll('.arqueo-input').forEach(inp => {
            const denom = Number(inp.dataset.denominacion || 1);
            const count = Math.max(0, parseInt(inp.value) || 0);
            const sub = denom * count;
            totalCordobas += sub;
            const subEl = inp.parentElement.querySelector('.arqueo-subtotal');
            if (subEl) subEl.textContent = `C$ ${sub.toFixed(2)}`;
        });

        const usdInp = document.getElementById('arqueo-usd-input');
        const usdCount = Math.max(0, parseFloat(usdInp ? usdInp.value : 0) || 0);
        const usdCordobas = usdCount * 36.62;
        const usdSubEl = document.getElementById('arqueo-usd-subtotal');
        if (usdSubEl) usdSubEl.textContent = `C$ ${usdCordobas.toFixed(2)}`;

        const totalFisico = totalCordobas + usdCordobas;
        const totalFisicoEl = document.getElementById('arqueo-total-fisico');
        if (totalFisicoEl) totalFisicoEl.textContent = `C$ ${totalFisico.toFixed(2)}`;

        const fondoInicial = parseFloat(document.getElementById('arqueo-fondo-inicial')?.value || 1000);
        const ventasSistema = cashStatusData && cashStatusData.efectivo ? Number(cashStatusData.efectivo.total || 0) : 0;
        const esperado = fondoInicial + ventasSistema;
        const esperadoEl = document.getElementById('arqueo-total-esperado');
        if (esperadoEl) esperadoEl.textContent = `C$ ${esperado.toFixed(2)}`;

        const dif = totalFisico - esperado;
        const difValEl = document.getElementById('arqueo-diferencia-valor');
        const difStatusEl = document.getElementById('arqueo-diferencia-estado');
        const difBox = document.getElementById('arqueo-diferencia-box');

        if (difValEl) difValEl.textContent = `C$ ${dif.toFixed(2)}`;
        if (difStatusEl && difBox) {
            if (Math.abs(dif) < 0.05) {
                difStatusEl.textContent = '✅ Cuadre Exacto';
                difBox.style.background = 'rgba(16,185,129,0.12)';
            } else if (dif > 0) {
                difStatusEl.textContent = '🟢 Sobrante en Caja';
                difBox.style.background = 'rgba(0,242,254,0.12)';
            } else {
                difStatusEl.textContent = '🔴 Faltante en Caja';
                difBox.style.background = 'rgba(244,63,94,0.12)';
            }
        }
    }

    // -------------------------------------------------------------
    // EXPORTAR REPORTE CSV
    // -------------------------------------------------------------
    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            if (!crm.orders || crm.orders.length === 0) {
                alert('No hay órdenes para exportar.');
                return;
            }
            let csv = 'Numero Orden,Cliente,Telefono,Direccion,Total NIO,Metodo Pago,Estado,Fecha\n';
            crm.orders.forEach(o => {
                csv += `"${o.numero_orden}","${o.cliente_nombre}","${o.cliente_telefono}","${o.direccion_exacta}",${o.total},"${o.metodo_pago}","${o.estado}","${o.creado_en}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `reporte_deltastore_${Date.now()}.csv`;
            link.click();
        });
    }

    // -------------------------------------------------------------
    // RBAC USUARIOS
    // -------------------------------------------------------------
    async function loadRbacUsers() {
        const raw = await safeFetch('/api/auth/users');
        crm.rbacUsers = Array.isArray(raw) ? raw : (raw?.data || []);
        renderRbacUsersTable();
    }

    function renderRbacUsersTable() {
        const tbody = document.getElementById('rbac-users-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        crm.rbacUsers.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${u.id}</strong></td>
                <td><strong>${u.nombre}</strong></td>
                <td>${u.email}</td>
                <td><span class="role-pill">${u.rol.toUpperCase()}</span></td>
                <td>${u.ciudad || 'Juigalpa'}</td>
                <td>
                    <select class="form-control" style="padding:4px 8px; font-size:0.78rem;" onchange="window.crmChangeUserRole(${u.id}, this.value)">
                        <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>👑 Admin</option>
                        <option value="cajero" ${u.rol === 'cajero' ? 'selected' : ''}>💵 Cajero</option>
                        <option value="bodeguero" ${u.rol === 'bodeguero' ? 'selected' : ''}>📦 Bodeguero</option>
                        <option value="vendedor" ${u.rol === 'vendedor' ? 'selected' : ''}>💼 Vendedor</option>
                        <option value="repartidor" ${u.rol === 'repartidor' ? 'selected' : ''}>🛵 Repartidor</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.crmChangeUserRole = async function(userId, newRole) {
        const res = await safeFetch(`/api/auth/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ rol: newRole }) });
        if (res && res.success) {
            alert(`Rol actualizado a: ${newRole.toUpperCase()}`);
            await loadRbacUsers();
        }
    };

    function setupGlobalEvents() {
        const btnGlobalRefresh = document.getElementById('btn-global-refresh');
        if (btnGlobalRefresh) btnGlobalRefresh.addEventListener('click', refreshAllData);

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
            });
        });

        const btnSaveOrder = document.getElementById('btn-save-order-changes');
        if (btnSaveOrder) {
            btnSaveOrder.addEventListener('click', async () => {
                if (!crm.activeOrderDetail) return;
                const newStatus = document.getElementById('m-order-status-select').value;
                const driver = document.getElementById('m-order-driver').value.trim();
                await updateOrderStatus(crm.activeOrderDetail.id, newStatus, driver);
                document.getElementById('crm-order-modal').classList.remove('open');
            });
        }
    }
});
