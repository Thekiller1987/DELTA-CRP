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
        switchTab('tab-dashboard');
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
        // Verificar sesión real
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem('deltastore_crm_user'));
        } catch(e) { saved = null; }

        const authScreen = document.getElementById('crm-auth-screen');
        const mainLayout = document.getElementById('crm-main-layout');

        if (!saved || !saved.token) {
            // NO autenticado -> Mostrar pantalla de login y ocultar dashboard
            if (authScreen) authScreen.style.display = 'flex';
            if (mainLayout) mainLayout.style.display = 'none';
            crm.currentUser = null;
            return;
        }

        // Autenticado -> Mostrar dashboard
        crm.currentUser = saved;
        if (authScreen) authScreen.style.display = 'none';
        if (mainLayout) mainLayout.style.display = 'flex';
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
                const authScreen = document.getElementById('crm-auth-screen');
                const mainLayout = document.getElementById('crm-main-layout');
                if (authScreen) authScreen.style.display = 'flex';
                if (mainLayout) mainLayout.style.display = 'none';
                const emailInp = document.getElementById('login-email');
                const passInp = document.getElementById('login-password');
                if (emailInp) emailInp.value = '';
                if (passInp) passInp.value = '';
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
        const loginForm = document.getElementById('crm-real-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const pass = document.getElementById('login-password').value.trim();
                const btnSubmit = document.getElementById('btn-submit-real-login');
                const errBox = document.getElementById('auth-error-alert');

                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span>⏳</span> Verificando credenciales...';
                if (errBox) errBox.style.display = 'none';

                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password: pass })
                    });
                    const data = await res.json();
                    if (res.ok && data.success && data.token) {
                        crm.currentUser = {
                            id: data.user.id,
                            nombre: data.user.nombre,
                            email: data.user.email,
                            rol: data.user.rol,
                            token: data.token
                        };
                        localStorage.setItem('deltastore_crm_user', JSON.stringify(crm.currentUser));

                        const authScreen = document.getElementById('crm-auth-screen');
                        const mainLayout = document.getElementById('crm-main-layout');
                        if (authScreen) authScreen.style.display = 'none';
                        if (mainLayout) mainLayout.style.display = 'flex';

                        updateUserSessionUI();
                        applyRoleRestrictions();
                        await refreshAllData();
                        if (window.soundEngine) window.soundEngine.playSuccess();
                    } else {
                        if (errBox) {
                            errBox.textContent = data.message || 'Credenciales incorrectas. Verifique correo y contraseña.';
                            errBox.style.display = 'block';
                        }
                    }
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = 'Error de conexión con el servidor.';
                        errBox.style.display = 'block';
                    }
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = '<span>🔐</span> Iniciar Sesión en el ERP';
                }
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

        const cleanPhone = (order.cliente_telefono || '').replace(/[^0-9]/g, '');
        const waPhone = cleanPhone.length === 8 ? '505' + cleanPhone : cleanPhone;
        const waMsg = encodeURIComponent(`¡Hola ${order.cliente_nombre}! Te saludamos de DeltaStore Juigalpa ⚡. Tu orden #${order.numero_orden} por C$ ${Number(order.total).toFixed(2)} está lista/en camino hacia: ${order.direccion_exacta} (${order.punto_referencia || 'Juigalpa'}). Nuestro repartidor le visitará en breve. Si paga en efectivo, tenga listo su monto. ¡Gracias por confiar en DeltaStore!`);

        card.innerHTML = `
            <div class="order-card-header">
                <span class="order-code">${order.numero_orden}</span>
                <span class="order-time">${order.origen === 'crm_pos' ? 'POS' : 'Web'}</span>
            </div>
            <div class="order-customer">👤 ${order.cliente_nombre}</div>
            <div class="order-address">📍 ${order.direccion_exacta || 'Juigalpa'}</div>
            <div class="order-footer-row">
                <span class="order-price">C$ ${Number(order.total).toFixed(2)}</span>
                <span style="font-size:0.75rem; color:#94a3b8;">${order.metodo_pago === 'contra_entrega' || order.metodo_pago === 'efectivo_contraentrega' ? '💵 Efectivo' : '🏛️ Banco'}</span>
            </div>
            <div style="display:flex; gap:4px; margin-top:10px; flex-wrap:wrap;">
                <button class="btn-topbar btn-inspect-order" style="flex:1; padding:4px 6px; font-size:0.72rem;">Detalle</button>
                <button class="btn-topbar btn-print-ticket-card" style="padding:4px 8px; font-size:0.72rem; background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);" title="Imprimir Ticket 80mm">🧾</button>
                <button class="btn-topbar btn-wa-card" style="padding:4px 8px; font-size:0.72rem; background:rgba(37,211,102,0.18); color:#25d366; border:1px solid rgba(37,211,102,0.4);" title="Enviar WhatsApp al cliente">💬 WA</button>
                ${nextAction ? `<button class="btn-topbar btn-advance-order" style="flex:1.4; background:rgba(0,242,254,0.15); color:#00f2fe; border-color:var(--border-cyan); padding:4px 6px; font-size:0.72rem; font-weight:800;">${nextAction.text}</button>` : ''}
            </div>
        `;

        card.querySelector('.btn-inspect-order').addEventListener('click', (e) => {
            e.stopPropagation();
            openOrderDetailModal(order);
        });

        const btnCardPrint = card.querySelector('.btn-print-ticket-card');
        if (btnCardPrint) {
            btnCardPrint.addEventListener('click', (e) => {
                e.stopPropagation();
                openThermalReceipt(order, order.cliente_nombre, order.cliente_telefono);
            });
        }

        const btnCardWa = card.querySelector('.btn-wa-card');
        if (btnCardWa) {
            btnCardWa.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!waPhone) {
                    alert('Este pedido no tiene número de teléfono registrado.');
                    return;
                }
                window.open(`https://wa.me/${waPhone}?text=${waMsg}`, '_blank');
            });
        }

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

        const dateStr = new Date().toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
        const totalNum = Number(saleData.total || 0);
        const subtotalNum = totalNum / 1.15;
        const ivaNum = totalNum - subtotalNum;
        const usdRate = 36.62;
        const totalUsd = totalNum / usdRate;

        let rowsHtml = '';
        const items = saleData.items || [];
        if (items.length > 0) {
            items.forEach(it => {
                const name = it.nombre || it.nombre_producto || 'Repuesto de Moto';
                const qty = it.cantidad || 1;
                const sub = Number(it.subtotal || (it.precio_unitario * qty) || 0);
                rowsHtml += `
                    <tr>
                        <td style="padding:2px 0; text-align:left;">${name}</td>
                        <td style="text-align:center;">${qty}</td>
                        <td style="text-align:right;">C$ ${sub.toFixed(2)}</td>
                    </tr>
                `;
            });
        } else {
            rowsHtml = `
                <tr>
                    <td style="padding:2px 0; text-align:left;">Repuestos según orden</td>
                    <td style="text-align:center;">1</td>
                    <td style="text-align:right;">C$ ${totalNum.toFixed(2)}</td>
                </tr>
            `;
        }

        const barcode = (saleData.numero_orden || 'DS-2026').replace(/[^a-zA-Z0-9]/g, '');

        content.innerHTML = `
            <div style="font-family:'Courier New', Courier, monospace; color:#000000; font-size:12px; line-height:1.25;">
                <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">
                    <div style="font-size:16px; font-weight:900; letter-spacing:1px;">⚡ DELTASTORE ⚡</div>
                    <div style="font-size:11px; font-weight:700;">REPUESTOS & ACCESORIOS DE MOTO</div>
                    <div style="font-size:10px;">RUC: J0310000284910 &bull; DGI Nicaragua</div>
                    <div style="font-size:10px;">Costado Norte Parque Central, Juigalpa</div>
                    <div style="font-size:10px;">WhatsApp: +505 8965-4945 / 8456-7890</div>
                </div>

                <div style="margin-bottom:6px; font-size:11px;">
                    <div style="display:flex; justify-content:space-between;">
                        <span><strong>Ticket:</strong> #${saleData.numero_orden}</span>
                        <span>${dateStr}</span>
                    </div>
                    <div><strong>Cliente:</strong> ${clientName || 'Cliente Mostrador'}</div>
                    ${clientPhone && clientPhone !== 'N/A' ? `<div><strong>Tel:</strong> ${clientPhone}</div>` : ''}
                    <div><strong>Atendido por:</strong> Waskar (Cajero Principal)</div>
                </div>

                <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:6px;">
                    <thead>
                        <tr style="border-bottom:1px solid #000; font-size:10px;">
                            <th style="text-align:left; padding-bottom:3px;">DESCRIPCIÓN</th>
                            <th style="text-align:center; padding-bottom:3px; width:30px;">CANT</th>
                            <th style="text-align:right; padding-bottom:3px; width:70px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>

                <div style="border-top:1px dashed #000; padding-top:4px; font-size:11px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span>Subtotal Neto:</span>
                        <span>C$ ${subtotalNum.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span>IVA (15% Incluido):</span>
                        <span>C$ ${ivaNum.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900; border-top:1px solid #000; border-bottom:1px solid #000; padding:3px 0; margin:4px 0;">
                        <span>TOTAL CÓRDOBAS:</span>
                        <span>C$ ${totalNum.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#333; margin-bottom:4px;">
                        <span>Equiv. USD (T.C. ${usdRate}):</span>
                        <span>$ ${totalUsd.toFixed(2)}</span>
                    </div>
                </div>

                <div style="text-align:center; margin:10px 0 6px 0; letter-spacing:3px; font-weight:900; font-size:15px; border-top:1px dashed #000; padding-top:6px;">
                    ||||| | |||| ||| || | |||||
                    <div style="letter-spacing:1px; font-size:10px; font-weight:normal; margin-top:2px;">*${barcode}*</div>
                </div>

                <div style="text-align:center; font-size:9.5px; line-height:1.2; border-top:1px dashed #000; padding-top:5px; margin-top:4px;">
                    <strong>¡GRACIAS POR SU COMPRA!</strong><br>
                    * Garantía: 30 días en piezas mecánicas con este ticket.<br>
                    * Piezas eléctricas no tienen cambio una vez abiertas.<br>
                    * Soporte Técnico: +505 8965-4945 | Juigalpa
                </div>
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

        const searchVal = (document.getElementById('inv-search-input')?.value || '').toLowerCase().trim();
        const catVal = document.getElementById('inv-filter-cat')?.value || '';

        const filtered = crm.products.filter(p => {
            if (catVal && String(p.categoria_id) !== String(catVal)) return false;
            if (searchVal) {
                const matchName = (p.nombre || '').toLowerCase().includes(searchVal);
                const matchCode = (p.codigo || '').toLowerCase().includes(searchVal);
                const matchModel = (p.modelo_compatible || '').toLowerCase().includes(searchVal);
                return matchName || matchCode || matchModel;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:36px; color:#64748b;">
                        <div style="font-size:2rem; margin-bottom:8px;">📦</div>
                        <div style="font-weight:700; color:#ffffff; margin-bottom:4px;">No hay repuestos registrados</div>
                        <small>Haz clic en "➕ Registrar Nuevo Repuesto" para agregar tu primer producto a la base de datos real.</small>
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach(p => {
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

            const hasImg = p.imagen_base64 && p.imagen_base64.startsWith('data:image');
            const thumbHtml = hasImg 
                ? `<div class="prod-thumb-mini"><img src="${p.imagen_base64}" alt="${p.nombre}"></div>`
                : `<div class="prod-thumb-mini" style="font-size:1.2rem; color:#64748b;">🏍️</div>`;

            tr.innerHTML = `
                <td>${thumbHtml}</td>
                <td><strong style="color:#00f2fe;">${p.codigo || 'REP'}</strong></td>
                <td>
                    <strong style="color:#ffffff;">${p.nombre}</strong>
                    ${p.destacado ? '<span style="font-size:0.7rem; color:#f59e0b; margin-left:6px;">⭐ Destacado</span>' : ''}
                </td>
                <td>${p.categoria_nombre || 'General'}</td>
                <td>${p.modelo_compatible || 'Universal'}</td>
                <td>
                    <strong style="color:#f59e0b;">C$ ${price.toFixed(2)}</strong>
                    ${p.precio_oferta ? `<br><small style="color:#64748b; text-decoration:line-through;">C$ ${Number(p.precio).toFixed(2)}</small>` : ''}
                </td>
                <td><span class="stock-pill ${stockClass}">${stockLabel}</span></td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; gap:4px;">
                        <button class="btn-table-action" onclick="window.crmEditProduct(${p.id})" title="Editar repuesto">
                            ✏️ Editar
                        </button>
                        <button class="btn-table-action" onclick="window.crmAdjustStock(${p.id})" title="Ajustar existencias">
                            📦 Stock
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


    // =============================================================
    // MODULO DE ARQUEO DE CAJA & CUADRE DE TURNO (C$ Y USD)
    // =============================================================
    const btnOpenArqueo = document.getElementById('btn-open-arqueo');
    const modalArqueo = document.getElementById('modal-arqueo-caja');
    const btnCloseArqueo = document.getElementById('btn-close-arqueo');
    let cashStatusData = null;

    if (btnOpenArqueo && modalArqueo) {
        btnOpenArqueo.addEventListener('click', async () => {
            modalArqueo.classList.add('open');
            await loadLiveCashStatus();
            calculateArqueo();
        });
    }

    if (btnCloseArqueo && modalArqueo) {
        btnCloseArqueo.addEventListener('click', () => {
            modalArqueo.classList.remove('open');
        });
    }

    async function loadLiveCashStatus() {
        try {
            const res = await fetch('/api/crm/cash-closing/current');
            if (res.ok) {
                cashStatusData = await res.json();
                const vtaEl = document.getElementById('arqueo-ventas-sistema');
                if (vtaEl && cashStatusData.efectivo) {
                    vtaEl.textContent = `C$ ${Number(cashStatusData.efectivo.total || 0).toFixed(2)} (${cashStatusData.efectivo.pedidos || 0} vtas)`;
                }
            }
        } catch (e) {
            console.error('Error cargando estado de caja:', e);
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

        // USD
        const usdInp = document.getElementById('arqueo-usd-input');
        const usdCount = Math.max(0, parseFloat(usdInp ? usdInp.value : 0) || 0);
        const usdCordobas = usdCount * 36.62;
        const usdSubEl = document.getElementById('arqueo-usd-subtotal');
        if (usdSubEl) usdSubEl.textContent = `C$ ${usdCordobas.toFixed(2)}`;

        const totalFisico = totalCordobas + usdCordobas;
        const totalFisicoEl = document.getElementById('arqueo-total-fisico');
        if (totalFisicoEl) totalFisicoEl.textContent = `C$ ${totalFisico.toFixed(2)}`;

        const fondoInicial = Math.max(0, parseFloat(document.getElementById('arqueo-fondo-inicial')?.value || 1000));
        const ventasSistema = cashStatusData && cashStatusData.efectivo ? Number(cashStatusData.efectivo.total || 0) : 0;
        const esperado = fondoInicial + ventasSistema;

        const espEl = document.getElementById('arqueo-total-esperado');
        if (espEl) espEl.textContent = `C$ ${esperado.toFixed(2)}`;

        const dif = totalFisico - esperado;
        const difValEl = document.getElementById('arqueo-diferencia-valor');
        const difStatusEl = document.getElementById('arqueo-diferencia-estado');
        const difBox = document.getElementById('arqueo-diferencia-box');

        if (difValEl && difStatusEl && difBox) {
            if (Math.abs(dif) < 0.05) {
                difValEl.textContent = 'C$ 0.00';
                difValEl.style.color = '#10b981';
                difStatusEl.textContent = '✅ Cuadre Exacto (Sin faltante ni sobrante)';
                difStatusEl.style.color = '#10b981';
                difBox.style.background = 'rgba(16,185,129,0.12)';
                difBox.style.borderColor = 'rgba(16,185,129,0.3)';
            } else if (dif > 0) {
                difValEl.textContent = `+C$ ${dif.toFixed(2)}`;
                difValEl.style.color = '#38bdf8';
                difStatusEl.textContent = `🟢 Sobrante en caja (+C$ ${dif.toFixed(2)})`;
                difStatusEl.style.color = '#38bdf8';
                difBox.style.background = 'rgba(56,189,248,0.12)';
                difBox.style.borderColor = 'rgba(56,189,248,0.3)';
            } else {
                difValEl.textContent = `-C$ ${Math.abs(dif).toFixed(2)}`;
                difValEl.style.color = '#f43f5e';
                difStatusEl.textContent = `🔴 Faltante en caja (-C$ ${Math.abs(dif).toFixed(2)})`;
                difStatusEl.style.color = '#f43f5e';
                difBox.style.background = 'rgba(244,63,94,0.12)';
                difBox.style.borderColor = 'rgba(244,63,94,0.3)';
            }
        }
    }

    document.querySelectorAll('.arqueo-input').forEach(inp => {
        inp.addEventListener('input', calculateArqueo);
    });
    const usdInpRef = document.getElementById('arqueo-usd-input');
    if (usdInpRef) usdInpRef.addEventListener('input', calculateArqueo);
    const fondoInpRef = document.getElementById('arqueo-fondo-inicial');
    if (fondoInpRef) fondoInpRef.addEventListener('input', calculateArqueo);

    // Guardar Cierre de Caja
    const btnSaveArqueo = document.getElementById('btn-save-arqueo');
    if (btnSaveArqueo) {
        btnSaveArqueo.addEventListener('click', async () => {
            btnSaveArqueo.disabled = true;
            btnSaveArqueo.textContent = '⏳ Guardando...';
            try {
                const desglose = {};
                document.querySelectorAll('.arqueo-input').forEach(inp => {
                    desglose['C$' + inp.dataset.denominacion] = parseInt(inp.value) || 0;
                });
                desglose['USD'] = parseFloat(document.getElementById('arqueo-usd-input')?.value || 0);

                const fondoInicial = parseFloat(document.getElementById('arqueo-fondo-inicial')?.value || 1000);
                const totalFisicoText = document.getElementById('arqueo-total-fisico')?.textContent || '0';
                const totalFisico = parseFloat(totalFisicoText.replace(/[^0-9.]/g, '')) || 0;
                const ventasSistema = cashStatusData && cashStatusData.efectivo ? Number(cashStatusData.efectivo.total || 0) : 0;
                const esperado = fondoInicial + ventasSistema;
                const dif = totalFisico - esperado;

                const payload = {
                    cajero: 'Waskar (Cajero Principal)',
                    fondo_inicial: fondoInicial,
                    total_efectivo_declarado: totalFisico,
                    total_efectivo_sistema: ventasSistema,
                    diferencia: dif,
                    total_transferencias: cashStatusData?.transferencias?.total || 0,
                    total_tarjetas: cashStatusData?.tarjetas?.total || 0,
                    total_general: (cashStatusData?.total_general || 0) + fondoInicial,
                    desglose_billetes: desglose,
                    observaciones: document.getElementById('arqueo-observaciones')?.value.trim() || 'Cierre registrado conforme'
                };

                const res = await fetch('/api/crm/cash-closing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    if (window.soundEngine) window.soundEngine.playSuccess();
                    if (window.triggerConfetti) window.triggerConfetti();
                    alert('✅ ¡Cierre de caja guardado con éxito! Acta #' + data.cierre_id);
                    if (modalArqueo) modalArqueo.classList.remove('open');
                } else {
                    alert('Error guardando cierre: ' + (data.error || 'Desconocido'));
                }
            } catch (e) {
                console.error('Error guardando arqueo:', e);
                alert('Fallo de conexión al guardar cierre de caja.');
            } finally {
                btnSaveArqueo.disabled = false;
                btnSaveArqueo.textContent = '💾 Guardar Cierre';
            }
        });
    }

    // Imprimir Acta de Arqueo en formato 80mm
    const btnPrintArqueo = document.getElementById('btn-print-arqueo');
    if (btnPrintArqueo) {
        btnPrintArqueo.addEventListener('click', () => {
            const modalRec = document.getElementById('crm-receipt-modal');
            const contRec = document.getElementById('thermal-receipt-printable');
            if (!modalRec || !contRec) return;

            const dateStr = new Date().toLocaleString('es-NI');
            const totalFisico = document.getElementById('arqueo-total-fisico')?.textContent || 'C$ 0.00';
            const ventasSis = document.getElementById('arqueo-ventas-sistema')?.textContent || 'C$ 0.00';
            const fondo = document.getElementById('arqueo-fondo-inicial')?.value || '1000';
            const esperado = document.getElementById('arqueo-total-esperado')?.textContent || 'C$ 0.00';
            const difVal = document.getElementById('arqueo-diferencia-valor')?.textContent || 'C$ 0.00';
            const obs = document.getElementById('arqueo-observaciones')?.value || 'Sin observaciones';

            contRec.innerHTML = `
                <div style="font-family:'Courier New', monospace; font-size:12px; color:#000;">
                    <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">
                        <div style="font-size:15px; font-weight:900;">⚡ DELTASTORE JUIGALPA ⚡</div>
                        <div style="font-size:12px; font-weight:700;">ACTA DE ARQUEO & CIERRE DE CAJA</div>
                        <div style="font-size:10px;">Sucursal Central Juigalpa &bull; RUC J0310000284910</div>
                    </div>
                    <div style="font-size:11px; margin-bottom:8px;">
                        <div><strong>Fecha / Hora:</strong> ${dateStr}</div>
                        <div><strong>Cajero:</strong> Waskar (Cajero Principal)</div>
                        <div><strong>Fondo Inicial:</strong> C$ ${Number(fondo).toFixed(2)}</div>
                    </div>
                    <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; font-size:11px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span>Ventas Efectivo Sistema:</span>
                            <span>${ventasSis}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>Total Esperado en Caja:</span>
                            <span>${esperado}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-weight:900; font-size:12px; margin-top:4px;">
                            <span>Total Efectivo Contado:</span>
                            <span>${totalFisico}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-weight:900; margin-top:4px;">
                            <span>DIFERENCIA / BALANCE:</span>
                            <span>${difVal}</span>
                        </div>
                    </div>
                    <div style="margin-top:8px; font-size:10px;">
                        <strong>Notas:</strong> ${obs}
                    </div>
                    <div style="margin-top:20px; text-align:center; border-top:1px solid #000; padding-top:4px; font-size:10px;">
                        Firma Cajero Responsable
                    </div>
                </div>
            `;
            if (modalArqueo) modalArqueo.classList.remove('open');
            modalRec.classList.add('open');
        });
    }


    // =============================================================
    // MODULO DE CRUD DE PRODUCTOS REALES (MySQL deltastore_db)
    // =============================================================
    const btnOpenNewProduct = document.getElementById('btn-open-create-product-modal');
    const modalProductCrud = document.getElementById('modal-product-crud');
    const btnCloseProductCrud = document.getElementById('btn-close-product-crud');
    const btnCancelProductCrud = document.getElementById('btn-cancel-product-crud');
    const formProductCrud = document.getElementById('form-product-crud');

    const crudImgFile = document.getElementById('crud-img-file');
    const crudImgBase64 = document.getElementById('crud-imagen-base64');
    const crudImgPreview = document.getElementById('crud-img-preview');
    const crudPreviewPlaceholder = document.getElementById('crud-preview-placeholder');

    // Filtros en vivo del inventario
    const invSearchInput = document.getElementById('inv-search-input');
    const invFilterCat = document.getElementById('inv-filter-cat');

    if (invSearchInput) {
        invSearchInput.addEventListener('input', () => renderInventoryTable());
    }
    if (invFilterCat) {
        invFilterCat.addEventListener('change', () => renderInventoryTable());
    }

    // Apertura para Nuevo Repuesto
    if (btnOpenNewProduct && modalProductCrud) {
        btnOpenNewProduct.addEventListener('click', () => {
            openProductCrudModal();
        });
    }

    if (btnCloseProductCrud && modalProductCrud) {
        btnCloseProductCrud.addEventListener('click', () => {
            modalProductCrud.classList.remove('open');
        });
    }

    if (btnCancelProductCrud && modalProductCrud) {
        btnCancelProductCrud.addEventListener('click', () => {
            modalProductCrud.classList.remove('open');
        });
    }

    // Convertidor de Imagen a Base64 con Preview instantaneo
    if (crudImgFile) {
        crudImgFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validacion de tamano (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert('La imagen es demasiado pesada. Elige una imagen menor a 10MB.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                if (crudImgBase64) crudImgBase64.value = base64;
                if (crudImgPreview) {
                    crudImgPreview.src = base64;
                    crudImgPreview.style.display = 'block';
                }
                if (crudPreviewPlaceholder) crudPreviewPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    function openProductCrudModal(product = null) {
        if (!modalProductCrud) return;

        const titleEl = document.getElementById('product-modal-title');
        const idInp = document.getElementById('crud-product-id');
        const codeInp = document.getElementById('crud-codigo');
        const nameInp = document.getElementById('crud-nombre');
        const catSelect = document.getElementById('crud-categoria');
        const brandSelect = document.getElementById('crud-marca');
        const modelInp = document.getElementById('crud-modelo');
        const colorInp = document.getElementById('crud-color');
        const priceInp = document.getElementById('crud-precio');
        const offerInp = document.getElementById('crud-precio-oferta');
        const stockInp = document.getElementById('crud-stock');
        const minStockInp = document.getElementById('crud-stock-minimo');
        const descInp = document.getElementById('crud-descripcion');
        const destCheck = document.getElementById('crud-destacado');

        // Limpiar preview de imagen
        if (crudImgFile) crudImgFile.value = '';
        if (crudImgBase64) crudImgBase64.value = '';
        if (crudImgPreview) {
            crudImgPreview.src = '';
            crudImgPreview.style.display = 'none';
        }
        if (crudPreviewPlaceholder) crudPreviewPlaceholder.style.display = 'block';

        if (product) {
            // MODO EDICION
            if (titleEl) titleEl.textContent = `✏️ Editar: ${product.nombre}`;
            if (idInp) idInp.value = product.id;
            if (codeInp) codeInp.value = product.codigo || '';
            if (nameInp) nameInp.value = product.nombre || '';
            if (catSelect) catSelect.value = product.categoria_id || '';
            if (brandSelect) brandSelect.value = product.marca_moto_id || '';
            if (modelInp) modelInp.value = product.modelo_compatible || 'Universal';
            if (colorInp) colorInp.value = product.color || 'Estándar';
            if (priceInp) priceInp.value = product.precio || '';
            if (offerInp) offerInp.value = product.precio_oferta || '';
            if (stockInp) stockInp.value = product.stock !== undefined ? product.stock : 10;
            if (minStockInp) minStockInp.value = product.stock_minimo || 5;
            if (descInp) descInp.value = product.descripcion || '';
            if (destCheck) destCheck.checked = Boolean(product.destacado);

            if (product.imagen_base64 && product.imagen_base64.startsWith('data:image')) {
                if (crudImgBase64) crudImgBase64.value = product.imagen_base64;
                if (crudImgPreview) {
                    crudImgPreview.src = product.imagen_base64;
                    crudImgPreview.style.display = 'block';
                }
                if (crudPreviewPlaceholder) crudPreviewPlaceholder.style.display = 'none';
            }
        } else {
            // MODO CREACION
            if (titleEl) titleEl.textContent = '📦 Registrar Nuevo Repuesto';
            if (idInp) idInp.value = '';
            if (codeInp) {
                const rnd = Math.floor(100 + Math.random() * 900);
                codeInp.value = `REP-${new Date().getFullYear()}-${rnd}`;
            }
            if (nameInp) nameInp.value = '';
            if (catSelect && catSelect.options.length > 1) catSelect.selectedIndex = 1;
            if (brandSelect) brandSelect.value = '';
            if (modelInp) modelInp.value = 'Universal';
            if (colorInp) colorInp.value = 'Estándar';
            if (priceInp) priceInp.value = '';
            if (offerInp) offerInp.value = '';
            if (stockInp) stockInp.value = '10';
            if (minStockInp) minStockInp.value = '5';
            if (descInp) descInp.value = '';
            if (destCheck) destCheck.checked = false;
        }

        modalProductCrud.classList.add('open');
    }

    // Submit del Formulario Crear / Editar Repuesto
    if (formProductCrud) {
        formProductCrud.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pId = document.getElementById('crud-product-id')?.value;
            const codigo = document.getElementById('crud-codigo')?.value.trim();
            const nombre = document.getElementById('crud-nombre')?.value.trim();
            const categoria_id = document.getElementById('crud-categoria')?.value;
            const marca_moto_id = document.getElementById('crud-marca')?.value || null;
            const modelo_compatible = document.getElementById('crud-modelo')?.value.trim() || 'Universal';
            const color = document.getElementById('crud-color')?.value.trim() || 'Estándar';
            const precio = parseFloat(document.getElementById('crud-precio')?.value);
            const precio_oferta_val = document.getElementById('crud-precio-oferta')?.value;
            const precio_oferta = precio_oferta_val ? parseFloat(precio_oferta_val) : null;
            const stock = parseInt(document.getElementById('crud-stock')?.value || 0);
            const stock_minimo = parseInt(document.getElementById('crud-stock-minimo')?.value || 5);
            const descripcion = document.getElementById('crud-descripcion')?.value.trim() || '';
            const destacado = document.getElementById('crud-destacado')?.checked || false;
            const imagen_base64 = document.getElementById('crud-imagen-base64')?.value || null;

            if (!codigo || !nombre || !categoria_id || isNaN(precio) || precio <= 0) {
                alert('Por favor completa todos los campos requeridos (*)');
                return;
            }

            const btnSave = document.getElementById('btn-save-product-crud');
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.textContent = '⏳ Guardando en MySQL...';
            }

            const payload = {
                codigo,
                nombre,
                categoria_id: parseInt(categoria_id),
                marca_moto_id: marca_moto_id ? parseInt(marca_moto_id) : null,
                modelo_compatible,
                color,
                precio,
                precio_oferta,
                stock,
                stock_minimo,
                descripcion,
                destacado,
                imagen_base64
            };

            try {
                let res;
                if (pId) {
                    // Actualizar existente
                    res = await fetch(`/api/crm/products/${pId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Crear nuevo
                    res = await fetch('/api/crm/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                const data = await res.json();
                if (data.success || res.ok) {
                    if (window.soundEngine) window.soundEngine.playSuccess();
                    if (modalProductCrud) modalProductCrud.classList.remove('open');
                    await refreshAllData();
                    renderPOSProducts();
                    alert(pId ? '✅ Repuesto actualizado con éxito.' : '✅ Repuesto registrado en MySQL y disponible en Tienda Web.');
                } else {
                    alert('Error al guardar: ' + (data.error || data.message || 'Verifica los datos.'));
                }
            } catch (err) {
                console.error('Error guardando repuesto:', err);
                alert('Error de conexión con el servidor al guardar el repuesto.');
            } finally {
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = '💾 Guardar Repuesto en MySQL';
                }
            }
        });
    }

    // Funciones globales expuestas para las acciones de la tabla
    window.crmEditProduct = function(id) {
        const prod = crm.products.find(p => p.id === id);
        if (prod) openProductCrudModal(prod);
    };

    window.crmDeleteProduct = async function(id) {
        const prod = crm.products.find(p => p.id === id);
        if (!prod) return;

        const conf = confirm(`¿Estás seguro de eliminar "${prod.nombre}" (${prod.codigo}) del catálogo?\nEsta acción lo desactivará de la Tienda Web y del POS.`);
        if (!conf) return;

        try {
            const res = await fetch(`/api/crm/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (window.soundEngine) window.soundEngine.playSuccess();
                await refreshAllData();
                renderPOSProducts();
            } else {
                alert('No se pudo desactivar el repuesto.');
            }
        } catch (e) {
            console.error('Error eliminando repuesto:', e);
            alert('Fallo de conexión al eliminar repuesto.');
        }
    };
