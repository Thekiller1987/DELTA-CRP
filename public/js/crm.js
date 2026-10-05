// ==========================================================================
// DELTASTORE CRM & ERP — LOGICA OPERATIVA EMPRESARIAL JUIGALPA
// Zero-Crash, Dashboard KPIs, Kanban Pipeline, POS Mostrador & CSV Export
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
        brands: [],
        customers: [],
        posCart: [],
        activeOrderDetail: null,
        currentUser: null,
        rbacUsers: []
    };

    // -------------------------------------------------------------
    // 2. INICIALIZACION
    // -------------------------------------------------------------
    initCRM();

    async function initCRM() {
        setupRBAC();
        setupNavigation();
        setupGlobalEvents();
        await loadCategoriesAndBrands();
        await refreshAllData();
        renderPOSProducts();
    }

    async function safeFetch(url, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (crm.currentUser && crm.currentUser.token) {
            headers['Authorization'] = 'Bearer ' + crm.currentUser.token;
        }
        try {
            const res = await fetch(url, { ...options, headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data;
        } catch (e) {
            console.warn(`Fallo al consultar ${url}:`, e);
            return null;
        }
    }

    async function loadCategoriesAndBrands() {
        try {
            const [catData, brandData] = await Promise.all([
                safeFetch('/api/crm/categories').then(d => d || safeFetch('/api/categories')),
                safeFetch('/api/crm/brands').then(d => d || safeFetch('/api/brands'))
            ]);

            crm.categories = Array.isArray(catData) ? catData : (catData?.data || catData?.categories || []);
            crm.brands = Array.isArray(brandData) ? brandData : (brandData?.data || brandData?.brands || []);

            // Llenar selects del modal de productos
            const catSelect = document.getElementById('crud-categoria');
            const brandSelect = document.getElementById('crud-marca');
            const invCatFilter = document.getElementById('inv-filter-cat');

            if (catSelect) {
                catSelect.innerHTML = '<option value="">Selecciona Categoría...</option>';
                crm.categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    catSelect.appendChild(opt);
                });
            }

            if (invCatFilter) {
                invCatFilter.innerHTML = '<option value="">Todas las Categorías</option>';
                crm.categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    invCatFilter.appendChild(opt);
                });
            }

            if (brandSelect) {
                brandSelect.innerHTML = '<option value="">Sin marca específica</option>';
                crm.brands.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.textContent = b.nombre;
                    brandSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Error cargando categorías y marcas:', e);
        }
    }

    async function refreshAllData() {
        const btnRefresh = document.getElementById('btn-global-refresh');
        if (btnRefresh) btnRefresh.classList.add('loading');

        await Promise.all([
            loadRbacUsers(),
            loadDashboardStats(),
            loadOrders(),
            loadProducts(),
            loadCustomers()
        ]);

        if (btnRefresh) btnRefresh.classList.remove('loading');
        if (window.soundEngine) window.soundEngine.playSuccess();
    }

    // -------------------------------------------------------------
    // 3. NAVEGACION POR PESTANAS
    // -------------------------------------------------------------
    
    // -------------------------------------------------------------
    // 2.1 SISTEMA DE SEGURIDAD & CONTROL DE ROLES (RBAC)
    // -------------------------------------------------------------
    function setupRBAC() {
        // Cargar sesión previa o inicializar con Admin por defecto
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem('deltastore_crm_user'));
        } catch(e) { saved = null; }

        if (!saved || !saved.token) {
            saved = {
                id: 1,
                nombre: 'Waskar Administrador',
                email: 'admin@deltastore.com',
                rol: 'admin',
                token: 'mock_jwt_token_deltastore_admin'
            };
            localStorage.setItem('deltastore_crm_user', JSON.stringify(saved));
        }

        crm.currentUser = saved;
        updateUserSessionUI();
        applyRoleRestrictions();

        // Botones de conmutador de rol y logout
        const btnSwitcher = document.getElementById('btn-open-role-switcher');
        const loginModal = document.getElementById('crm-login-modal');
        const btnLogout = document.getElementById('btn-crm-logout');

        if (btnSwitcher) {
            btnSwitcher.addEventListener('click', () => {
                if (loginModal) loginModal.classList.add('open');
            });
        }

        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                localStorage.removeItem('deltastore_crm_user');
                crm.currentUser = null;
                if (loginModal) loginModal.classList.add('open');
            });
        }

        // Acceso rápido por rol (1 clic)
        document.querySelectorAll('.btn-quick-role').forEach(btn => {
            btn.addEventListener('click', async () => {
                const email = btn.dataset.email;
                const password = btn.dataset.pass;
                await performLogin(email, password);
            });
        });

        // Formulario de login estándar
        const loginForm = document.getElementById('crm-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const pass = document.getElementById('login-password').value.trim();
                await performLogin(email, pass);
            });
        }

        // Botón nuevo usuario modal
        const btnOpenAddUser = document.getElementById('btn-open-add-user-modal');
        const modalAddUser = document.getElementById('modal-add-user');
        const btnCloseAddUser = document.getElementById('btn-close-add-user');
        const formCreateUser = document.getElementById('form-create-user');

        if (btnOpenAddUser && modalAddUser) {
            btnOpenAddUser.addEventListener('click', () => modalAddUser.classList.add('open'));
        }
        if (btnCloseAddUser && modalAddUser) {
            btnCloseAddUser.addEventListener('click', () => modalAddUser.classList.remove('open'));
        }
        if (formCreateUser) {
            formCreateUser.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleCreateUser();
            });
        }
    }

    async function performLogin(email, password) {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success && data.user) {
                crm.currentUser = {
                    ...data.user,
                    token: data.token
                };
                localStorage.setItem('deltastore_crm_user', JSON.stringify(crm.currentUser));

                const loginModal = document.getElementById('crm-login-modal');
                if (loginModal) loginModal.classList.remove('open');

                updateUserSessionUI();
                applyRoleRestrictions();
                await refreshAllData();

                if (window.soundEngine) window.soundEngine.playSuccess();
                alert(`¡Bienvenido ${crm.currentUser.nombre}! Sesión iniciada con rol: ${crm.currentUser.rol.toUpperCase()}`);
            } else {
                alert('Credenciales inválidas: ' + (data.message || 'Verifica correo y contraseña'));
            }
        } catch (e) {
            console.error('Error en login:', e);
            alert('Error al conectar con el servicio de autenticación.');
        }
    }

    function updateUserSessionUI() {
        const u = crm.currentUser;
        if (!u) return;

        const nameEl = document.getElementById('current-user-name');
        const badgeEl = document.getElementById('current-user-role-badge');
        const avatarEl = document.getElementById('current-user-avatar');

        const roleLabels = {
            admin: { label: '👑 Super Administrador', class: 'role-admin', icon: '👑' },
            cajero: { label: '💵 Cajero Mostrador POS', class: 'role-cajero', icon: '💵' },
            bodeguero: { label: '📦 Bodeguero Almacén', class: 'role-bodeguero', icon: '📦' },
            vendedor: { label: '💼 Asesor de Ventas', class: 'role-vendedor', icon: '💼' },
            repartidor: { label: '🛵 Repartidor Juigalpa', class: 'role-repartidor', icon: '🛵' }
        };

        const rInfo = roleLabels[u.rol] || { label: u.rol, class: 'role-vendedor', icon: '👤' };

        if (nameEl) nameEl.textContent = u.nombre;
        if (avatarEl) avatarEl.textContent = rInfo.icon;
        if (badgeEl) {
            badgeEl.className = 'current-user-role-badge ' + rInfo.class;
            badgeEl.textContent = rInfo.label;
        }
    }

    function applyRoleRestrictions() {
        const u = crm.currentUser;
        if (!u) return;

        const role = u.rol;

        // Ocultar / Mostrar pestañas según rol
        const tabPermissions = {
            admin: ['tab-dashboard', 'tab-orders', 'tab-pos', 'tab-inventory', 'tab-customers', 'tab-reports', 'tab-rbac'],
            cajero: ['tab-pos', 'tab-orders'],
            bodeguero: ['tab-inventory', 'tab-orders'],
            vendedor: ['tab-dashboard', 'tab-orders', 'tab-customers', 'tab-pos', 'tab-inventory'],
            repartidor: ['tab-orders']
        };

        const allowed = tabPermissions[role] || ['tab-orders'];

        document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            const tabId = btn.dataset.tab;
            if (allowed.includes(tabId)) {
                btn.style.display = 'flex';
                btn.style.opacity = '1';
                btn.disabled = false;
            } else {
                btn.style.display = 'none';
            }
        });

        // Si la pestaña actual no está permitida, cambiar a la primera permitida
        if (!allowed.includes(crm.currentTab)) {
            switchTab(allowed[0]);
        }
    }

    async function loadRbacUsers() {
        const data = await safeFetch('/api/auth/users');
        if (data && data.users) {
            crm.rbacUsers = data.users;
            renderRbacUsersTable();
        }
    }

    function renderRbacUsersTable() {
        const tbody = document.getElementById('rbac-users-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        crm.rbacUsers.forEach(u => {
            const tr = document.createElement('tr');
            const roleClass = 'role-' + (u.rol || 'vendedor');

            tr.innerHTML = `
                <td>#${u.id}</td>
                <td><strong>${u.nombre}</strong></td>
                <td>${u.email}</td>
                <td><span class="role-pill ${roleClass}">${u.rol.toUpperCase()}</span></td>
                <td>${u.ciudad || 'Juigalpa'}</td>
                <td>
                    <select class="form-input" style="padding:4px 8px; font-size:0.78rem; width:130px;" onchange="window.crmChangeUserRole(${u.id}, this.value)">
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
        try {
            const res = await fetch(`/api/auth/users/${userId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rol: newRole })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Rol actualizado a: ${newRole.toUpperCase()}`);
                await loadRbacUsers();
            } else {
                alert('Error al actualizar rol: ' + data.message);
            }
        } catch(e) {
            alert('Error de conexión al cambiar rol.');
        }
    };

    async function handleCreateUser() {
        const nombre = document.getElementById('new-user-name').value.trim();
        const email = document.getElementById('new-user-email').value.trim();
        const password = document.getElementById('new-user-pass').value.trim();
        const rol = document.getElementById('new-user-role').value;
        const telefono = document.getElementById('new-user-phone').value.trim();

        try {
            const res = await fetch('/api/auth/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, email, password, rol, telefono, ciudad: 'Juigalpa' })
            });
            const data = await res.json();

            if (data.success) {
                alert(`¡Colaborador creado exitosamente! Rol: ${rol.toUpperCase()}`);
                const modal = document.getElementById('modal-add-user');
                if (modal) modal.classList.remove('open');
                document.getElementById('form-create-user').reset();
                await loadRbacUsers();
            } else {
                alert('Error: ' + data.message);
            }
        } catch(e) {
            alert('Fallo de conexión al crear usuario.');
        }
    }

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
            'tab-orders': 'Pipeline de Pedidos & Logística Kanban',
            'tab-pos': 'Terminal POS Mostrador (Venta Física)',
            'tab-inventory': 'Inventario & Catálogo de Repuestos',
            'tab-customers': 'Directorio de Clientes CRM',
            'tab-reports': 'Reportes de Ventas & Exportación'
        };
        const titleEl = document.getElementById('current-view-title');
        if (titleEl) titleEl.textContent = titles[tabId] || 'Panel Administrativo';
    }

    // -------------------------------------------------------------
    // 4. TAB 1: DASHBOARD KPIS & SVG TREND CHART
    // -------------------------------------------------------------
    async function loadDashboardStats() {
        const data = await safeFetch('/api/crm/stats/dashboard');
        if (!data) return;

        crm.stats = data;

        const kpiToday = document.getElementById('kpi-sales-today');
        const kpiMonth = document.getElementById('kpi-sales-month');
        const kpiOrders = document.getElementById('kpi-pending-orders');
        const kpiStock = document.getElementById('kpi-critical-stock');
        const kpiValuation = document.getElementById('kpi-inventory-value');

        if (kpiToday) kpiToday.textContent = `C$ ${Number(data.ventas_hoy || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;
        if (kpiMonth) kpiMonth.textContent = `C$ ${Number(data.ventas_mes || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;
        if (kpiOrders) kpiOrders.textContent = data.pedidos_pendientes || 0;
        if (kpiStock) kpiStock.textContent = data.stock_bajo || 0;
        if (kpiValuation) kpiValuation.textContent = `C$ ${Number(data.valor_inventario || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;

        // Badges sidebar
        const badgeOrders = document.getElementById('orders-badge-count');
        const badgeStock = document.getElementById('stock-alert-badge');
        if (badgeOrders) badgeOrders.textContent = data.pedidos_pendientes || 0;
        if (badgeStock) badgeStock.textContent = data.stock_bajo || 0;

        renderTrendChart(data.ventas_ultimos_7_dias || []);
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
    // 5. TAB 2: PIPELINE KANBAN DE PEDIDOS JUIGALPA
    // -------------------------------------------------------------
    async function loadOrders() {
        const raw = await safeFetch('/api/crm/orders');
        crm.orders = Array.isArray(raw) ? raw : (raw?.data || []);
        renderKanban();
    }

    function renderKanban() {
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

        // Limpiar columnas
        Object.values(cols).forEach(col => { if (col) col.innerHTML = ''; });
        const counter = { nuevo: 0, confirmado: 0, en_ruta: 0, entregado: 0 };

        crm.orders.forEach(order => {
            let st = (order.estado || 'nuevo').toLowerCase();
            if (st === 'en_preparacion') st = 'confirmado';

            if (cols[st]) {
                counter[st] = (counter[st] || 0) + 1;
                const card = createKanbanCard(order, st);
                cols[st].appendChild(card);
            }
        });

        // Actualizar contadores
        Object.keys(counts).forEach(k => {
            if (counts[k]) counts[k].textContent = counter[k] || 0;
        });
    }

    function createKanbanCard(order, currentStatus) {
        const card = document.createElement('div');
        card.className = 'kanban-order-card';

        const nextAction = {
            nuevo: { text: '📦 Pasar a Bodega', nextState: 'confirmado' },
            confirmado: { text: '🛵 Enviar con Motorizado', nextState: 'en_ruta' },
            en_ruta: { text: '✅ Marcar Entregado', nextState: 'entregado' }
        }[currentStatus];

        card.innerHTML = `
            <div class="order-card-header">
                <span class="order-code">${order.numero_orden}</span>
                <span class="order-time">${order.origen === 'crm_pos' ? 'POS' : 'Web'}</span>
            </div>
            <div class="order-customer">👤 ${order.cliente_nombre}</div>
            <div class="order-address">📍 ${order.direccion_exacta || 'Juigalpa'}</div>
            <div class="order-footer-row">
                <span class="order-price">C$ ${Number(order.total).toFixed(2)}</span>
                <span style="font-size:0.75rem; color:#94a3b8;">${order.metodo_pago === 'contra_entrega' ? '💵 Efectivo' : '🏛️ Banco'}</span>
            </div>
            <div style="display:flex; gap:6px; margin-top:10px;">
                <button class="btn-topbar btn-inspect-order" style="flex:1; padding:4px 8px; font-size:0.75rem;">Detalle</button>
                ${nextAction ? `<button class="btn-topbar btn-advance-order" style="flex:1.5; background:rgba(0,242,254,0.15); color:#00f2fe; border-color:var(--border-cyan); padding:4px 8px; font-size:0.75rem; font-weight:800;">${nextAction.text}</button>` : ''}
            </div>
        `;

        card.querySelector('.btn-inspect-order').addEventListener('click', (e) => {
            e.stopPropagation();
            openOrderDetailModal(order);
        });

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
        try {
            const body = { estado: newStatus };
            if (driver) body.repartidor_asignado = driver;

            const res = await fetch(`/api/crm/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                if (window.soundEngine) window.soundEngine.playSuccess();
                await refreshAllData();
            } else {
                alert('No se pudo actualizar el estado del pedido.');
            }
        } catch (e) {
            console.error('Error actualizando pedido:', e);
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

        // WhatsApp direct link
        const btnWa = document.getElementById('btn-order-wa');
        if (btnWa) {
            const phone = (order.cliente_telefono || '').replace(/[^0-9]/g, '');
            const msg = encodeURIComponent(`¡Hola ${order.cliente_nombre}! Te saludamos de DeltaStore Juigalpa sobre tu pedido ${order.numero_orden}. Estado actual: ${order.estado}.`);
            btnWa.onclick = () => window.open(`https://wa.me/505${phone}?text=${msg}`, '_blank');
        }

        // Comprobante bancario Base64
        const receiptBox = document.getElementById('m-order-receipt-box');
        if (receiptBox) {
            if (order.comprobante_pago_base64 && order.comprobante_pago_base64.startsWith('data:image')) {
                receiptBox.innerHTML = `<img src="${order.comprobante_pago_base64}" style="max-height:160px; border-radius:8px; cursor:pointer;" onclick="window.open('${order.comprobante_pago_base64}')">`;
                receiptBox.style.display = 'block';
            } else {
                receiptBox.style.display = 'none';
            }
        }

        modal.classList.add('open');
    }

    // -------------------------------------------------------------
    // 6. TAB 3: TERMINAL POS MOSTRADOR FISICO (VENTA EN TIENDA)
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
            card.addEventListener('click', () => {
                addToPOS(p);
            });
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

        // Totales y calculadora de vuelto
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

    const cashInp = document.getElementById('pos-cash-input');
    if (cashInp) {
        cashInp.addEventListener('input', () => {
            renderPOSTicket();
        });
    }

    // Cobrar venta POS
    const btnCharge = document.getElementById('btn-pos-charge');
    if (btnCharge) {
        btnCharge.addEventListener('click', async () => {
            if (crm.posCart.length === 0) return;

            const clientName = document.getElementById('pos-client-name')?.value.trim() || 'Cliente Mostrador Juigalpa';
            const clientPhone = document.getElementById('pos-client-phone')?.value.trim() || 'N/A';
            const method = document.getElementById('pos-payment-select')?.value || 'efectivo_contraentrega';

            btnCharge.disabled = true;
            btnCharge.textContent = '⏳ Facturando venta...';

            try {
                const res = await fetch('/api/crm/pos/sale', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cliente_nombre: clientName,
                        cliente_telefono: clientPhone,
                        metodo_pago: method,
                        items: crm.posCart.map(i => ({
                            producto_id: i.producto_id,
                            cantidad: i.cantidad
                        }))
                    })
                });

                const data = await res.json();
                if (data.success) {
                    if (window.soundEngine) window.soundEngine.playCheckout();
                    if (window.triggerConfetti) window.triggerConfetti();

                    // Imprimir ticket térmico
                    openThermalReceipt(data, clientName, clientPhone);

                    // Limpiar carrito POS
                    crm.posCart = [];
                    renderPOSTicket();
                    await refreshAllData();
                    renderPOSProducts();
                } else {
                    alert('Error en cobro: ' + (data.error || 'Verifique stock.'));
                }
            } catch (e) {
                console.error('Error cobrando POS:', e);
                alert('Fallo de conexión al facturar venta.');
            } finally {
                btnCharge.disabled = false;
                btnCharge.textContent = '💵 Cobrar Venta & Imprimir Ticket';
            }
        });
    }

    function openThermalReceipt(saleData, clientName, clientPhone) {
        const modal = document.getElementById('crm-receipt-modal');
        const content = document.getElementById('thermal-receipt-printable');
        if (!modal || !content) return;

        const dateStr = new Date().toLocaleString('es-NI');

        let rowsHtml = '';
        (saleData.items || []).forEach(it => {
            rowsHtml += `
                <tr>
                    <td style="padding:3px 0;">${it.nombre}</td>
                    <td style="text-align:center;">${it.cantidad}</td>
                    <td style="text-align:right;">C$ ${Number(it.subtotal).toFixed(2)}</td>
                </tr>
            `;
        });

        content.innerHTML = `
            <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:8px; margin-bottom:8px;">
                <div style="font-size:1.15rem; font-weight:900;">DELTASTORE JUIGALPA</div>
                <div style="font-size:0.75rem;">MOTO REPUESTOS & ACCESORIOS</div>
                <div style="font-size:0.72rem;">Juigalpa, Chontales &bull; Tel: +505 8888-9999</div>
            </div>
            <div style="font-size:0.75rem; margin-bottom:8px;">
                <div><strong>No. Ticket:</strong> ${saleData.numero_orden}</div>
                <div><strong>Fecha:</strong> ${dateStr}</div>
                <div><strong>Cliente:</strong> ${clientName}</div>
            </div>
            <table style="width:100%; font-size:0.75rem; border-collapse:collapse; margin-bottom:8px;">
                <thead>
                    <tr style="border-bottom:1px solid #000;">
                        <th style="text-align:left;">Desc</th>
                        <th style="text-align:center;">Cant</th>
                        <th style="text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            <div style="border-top:1px dashed #000; padding-top:6px; font-size:0.85rem;">
                <div style="display:flex; justify-content:space-between; font-weight:800;">
                    <span>TOTAL:</span>
                    <span>C$ ${Number(saleData.total).toFixed(2)}</span>
                </div>
            </div>
            <div style="text-align:center; margin-top:14px; font-size:0.72rem;">
                ¡Gracias por su compra!<br>
                Garantía válida con este ticket.
            </div>
        `;

        modal.classList.add('open');
    }

    // -------------------------------------------------------------
    // 7. TAB 4: INVENTARIO & CATÁLOGO CRUD
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

        crm.products.forEach(p => {
            const tr = document.createElement('tr');
            const price = Number(p.precio_oferta || p.precio || 0);

            let stockClass = 'stock-ok';
            let stockLabel = `${p.stock} en stock`;
            if (p.stock <= 0) {
                stockClass = 'stock-empty';
                stockLabel = 'AGOTADO';
            } else if (p.stock <= (p.stock_minimo || 5)) {
                stockClass = 'stock-low';
                stockLabel = `Crítico (${p.stock})`;
            }

            tr.innerHTML = `
                <td><strong style="color:#00f2fe;">${p.codigo || 'REP'}</strong></td>
                <td><strong>${p.nombre}</strong></td>
                <td>${p.categoria_nombre || 'General'}</td>
                <td>${p.modelo_compatible || 'Universal'}</td>
                <td><strong style="color:#f59e0b;">C$ ${price.toFixed(2)}</strong></td>
                <td><span class="stock-pill ${stockClass}">${stockLabel}</span></td>
                <td>
                    <button class="btn-topbar" onclick="window.crmAdjustStock(${p.id})">Ajustar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.crmAdjustStock = function(pId) {
        const prod = crm.products.find(p => p.id === pId);
        if (!prod) return;

        const newStock = prompt(`Ajustar stock para: ${prod.nombre}\nStock actual: ${prod.stock}\nIngresa el nuevo stock:`, prod.stock);
        if (newStock !== null && !isNaN(parseInt(newStock))) {
            const diff = parseInt(newStock) - prod.stock;
            if (diff !== 0) {
                fetch('/api/crm/inventory/adjust', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        producto_id: prod.id,
                        tipo_movimiento: diff > 0 ? 'entrada' : 'ajuste',
                        cantidad: Math.abs(diff),
                        motivo: 'Ajuste manual de conteo físico',
                        usuario: 'Waskar (Admin)'
                    })
                }).then(() => {
                    refreshAllData();
                });
            }
        }
    };

    // -------------------------------------------------------------
    // 8. TAB 5: DIRECTORIO DE CLIENTES
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

        if (crm.customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay clientes registrados en órdenes todavía.</td></tr>';
            return;
        }

        crm.customers.forEach(c => {
            const tr = document.createElement('tr');
            const cleanPhone = (c.telefono || '').replace(/[^0-9]/g, '');

            tr.innerHTML = `
                <td><strong>${c.nombre}</strong></td>
                <td>${c.telefono}</td>
                <td>${c.direccion || 'Juigalpa'}</td>
                <td><strong style="color:#00f2fe;">${c.total_pedidos} pedidos</strong></td>
                <td><strong style="color:#f59e0b;">C$ ${Number(c.total_gastado).toFixed(2)}</strong></td>
                <td>
                    <a href="https://wa.me/505${cleanPhone}" target="_blank" class="btn-topbar" style="color:#10b981; text-decoration:none;">
                        💬 WhatsApp
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // -------------------------------------------------------------
    // 9. TAB 6: EXPORTAR REPORTE CSV
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
    // 10. EVENTOS GLOBALES Y MODALES
    // -------------------------------------------------------------
    function setupGlobalEvents() {
        const btnGlobalRefresh = document.getElementById('btn-global-refresh');
        if (btnGlobalRefresh) {
            btnGlobalRefresh.addEventListener('click', refreshAllData);
        }

        // Cerrar modales
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
            });
        });

        // Guardar cambios de orden
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
