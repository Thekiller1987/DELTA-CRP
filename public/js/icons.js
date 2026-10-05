// ==========================================================================
// DELTASTORE — SISTEMA DE ICONOGRAFÍA VECTORIAL PERSONALIZADA (SVG HD)
// Iconos Temáticos para Motocicletas, Amazon-Style E-Commerce y Roles RBAC
// ==========================================================================

window.DeltaIcons = {
    // ----------------------------------------------------------------------
    // 1. LOGO E IDENTIDAD DELTASTORE (Estilo Cyberpunk & Moto Velocity)
    // ----------------------------------------------------------------------
    logo: `<svg viewBox="0 0 40 40" fill="none" class="delta-svg-logo">
        <defs>
            <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#00f2fe"/>
                <stop offset="50%" stop-color="#0284c7"/>
                <stop offset="100%" stop-color="#f59e0b"/>
            </linearGradient>
            <filter id="glowLogo" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
        </defs>
        <polygon points="20,2 38,12 38,28 20,38 2,28 2,12" stroke="url(#logoGrad)" stroke-width="2.5" fill="rgba(0, 242, 254, 0.08)" filter="url(#glowLogo)"/>
        <!-- Ala de velocidad izquierda -->
        <path d="M8 20 L20 8 L24 12 L12 24 Z" fill="#00f2fe"/>
        <!-- Ala de velocidad derecha -->
        <path d="M32 20 L20 32 L16 28 L28 16 Z" fill="#f59e0b"/>
        <!-- Perno central -->
        <circle cx="20" cy="20" r="3.5" fill="#ffffff"/>
    </svg>`,

    // ----------------------------------------------------------------------
    // 2. ICONOS AMAZON-STYLE E-COMMERCE
    // ----------------------------------------------------------------------
    locationPin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
    </svg>`,

    deltaPrime: `<svg viewBox="0 0 24 24" fill="none" class="delta-prime-svg">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#primeGrad)" stroke="#00f2fe" stroke-width="1.5" stroke-linejoin="round"/>
        <defs>
            <linearGradient id="primeGrad" x1="3" y1="2" x2="21" y2="22">
                <stop offset="0%" stop-color="#00f2fe"/>
                <stop offset="100%" stop-color="#38bdf8"/>
            </linearGradient>
        </defs>
    </svg>`,

    amazonSearch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>`,

    amazonMenu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>`,

    amazonCart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1.5"></circle>
        <circle cx="20" cy="21" r="1.5"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>`,

    garageMoto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <circle cx="9" cy="16" r="2.5"></circle>
        <circle cx="15" cy="16" r="2.5"></circle>
        <path d="M9 16h6"></path>
        <path d="M12 11v3"></path>
    </svg>`,

    deliveryTruck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
    </svg>`,

    shieldCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <polyline points="9 12 11 14 15 10"></polyline>
    </svg>`,

    flashDeal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b"></polygon>
    </svg>`,

    // ----------------------------------------------------------------------
    // 3. GENERADOR DE ESTRELLAS DE CALIFICACIÓN (AMAZON REVIEWS)
    // ----------------------------------------------------------------------
    getStars: function(rating = 4.8) {
        let starsHtml = '';
        const fullStars = Math.floor(rating);
        const hasHalf = (rating - fullStars) >= 0.4;
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                starsHtml += `<svg class="star-svg full" viewBox="0 0 24 24" fill="#f59e0b" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            } else if (i === fullStars && hasHalf) {
                starsHtml += `<svg class="star-svg half" viewBox="0 0 24 24" width="14" height="14">
                    <defs>
                        <linearGradient id="halfStarGrad">
                            <stop offset="50%" stop-color="#f59e0b"/>
                            <stop offset="50%" stop-color="#334155"/>
                        </linearGradient>
                    </defs>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#halfStarGrad)"/>
                </svg>`;
            } else {
                starsHtml += `<svg class="star-svg empty" viewBox="0 0 24 24" fill="#334155" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }
        }
        return `<span class="amazon-stars">${starsHtml} <span class="stars-val">${rating.toFixed(1)}</span></span>`;
    },

    // ----------------------------------------------------------------------
    // 4. ICONOS PERSONALIZADOS DE ROLES RBAC PARA EL CRM
    // ----------------------------------------------------------------------
    roles: {
        admin: `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="role-icon">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" fill="rgba(245, 158, 11, 0.2)"></path>
            <circle cx="12" cy="18" r="2" fill="#f59e0b"></circle>
        </svg>`,

        cajero: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="role-icon">
            <rect x="2" y="4" width="20" height="16" rx="2" fill="rgba(16, 185, 129, 0.15)"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
            <circle cx="7" cy="15" r="1.5" fill="#10b981"></circle>
            <path d="M14 15h4"></path>
        </svg>`,

        bodeguero: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="role-icon">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="rgba(59, 130, 246, 0.15)"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>`,

        vendedor: `<svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="role-icon">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" fill="rgba(139, 92, 246, 0.15)"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>`,

        repartidor: `<svg viewBox="0 0 24 24" fill="none" stroke="#00f2fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="role-icon">
            <circle cx="5.5" cy="17.5" r="3.5" fill="rgba(0, 242, 254, 0.15)"></circle>
            <circle cx="18.5" cy="17.5" r="3.5" fill="rgba(0, 242, 254, 0.15)"></circle>
            <path d="M5.5 17.5h3l3-7h4.5l2 3.5h3"></path>
            <circle cx="12" cy="7" r="1.5" fill="#00f2fe"></circle>
        </svg>`
    },

    // ----------------------------------------------------------------------
    // 5. REPUESTOS DE MOTOCICLETAS (SVG VECTORIAL DE ALTO DETALLE)
    // ----------------------------------------------------------------------
    parts: {
        // Pistón / Cilindro Motor
        piston: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <rect x="16" y="10" width="32" height="24" rx="3" fill="#1e293b" stroke="#00f2fe" stroke-width="2.5"/>
            <line x1="20" y1="16" x2="44" y2="16" stroke="#00f2fe" stroke-width="2"/>
            <line x1="20" y1="22" x2="44" y2="22" stroke="#00f2fe" stroke-width="2"/>
            <!-- Biela -->
            <path d="M28 34 L26 50 L38 50 L36 34 Z" fill="#334155" stroke="#f59e0b" stroke-width="2"/>
            <circle cx="32" cy="52" r="4" fill="#070b14" stroke="#f59e0b" stroke-width="2"/>
        </svg>`,

        // Freno de Disco Ventilado y Pinza
        brake: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <circle cx="32" cy="32" r="24" fill="#1e293b" stroke="#00f2fe" stroke-width="2.5"/>
            <circle cx="32" cy="32" r="10" stroke="#64748b" stroke-width="2"/>
            <!-- Ventilaciones del rotor -->
            <circle cx="32" cy="16" r="2" fill="#00f2fe"/>
            <circle cx="32" cy="48" r="2" fill="#00f2fe"/>
            <circle cx="16" cy="32" r="2" fill="#00f2fe"/>
            <circle cx="48" cy="32" r="2" fill="#00f2fe"/>
            <circle cx="21" cy="21" r="2" fill="#00f2fe"/>
            <circle cx="43" cy="43" r="2" fill="#00f2fe"/>
            <circle cx="21" cy="43" r="2" fill="#00f2fe"/>
            <circle cx="43" cy="21" r="2" fill="#00f2fe"/>
            <!-- Caliper / Mordaza -->
            <path d="M38 10 C46 14 54 22 54 32 L46 32 C46 26 42 20 36 16 Z" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5"/>
        </svg>`,

        // Cadena y Sprocket / Corona
        chain: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <circle cx="24" cy="32" r="16" fill="#1e293b" stroke="#f59e0b" stroke-width="2.5"/>
            <circle cx="24" cy="32" r="6" fill="#070b14" stroke="#f59e0b" stroke-width="2"/>
            <!-- Dientes corona -->
            <path d="M24 14 L26 10 L28 14" stroke="#f59e0b" stroke-width="2"/>
            <path d="M24 50 L26 54 L28 50" stroke="#f59e0b" stroke-width="2"/>
            <!-- Eslabón de cadena -->
            <rect x="36" y="24" width="20" height="16" rx="8" fill="#334155" stroke="#00f2fe" stroke-width="2.5"/>
            <circle cx="42" cy="32" r="3" fill="#00f2fe"/>
            <circle cx="50" cy="32" r="3" fill="#00f2fe"/>
        </svg>`,

        // Sistema Eléctrico / Bujía de Iridio
        electric: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <!-- Aislador cerámico de bujía -->
            <rect x="28" y="6" width="8" height="20" rx="2" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
            <line x1="28" y1="12" x2="36" y2="12" stroke="#94a3b8" stroke-width="1.5"/>
            <line x1="28" y1="18" x2="36" y2="18" stroke="#94a3b8" stroke-width="1.5"/>
            <!-- Rosca metálica -->
            <rect x="26" y="26" width="12" height="18" fill="#475569" stroke="#cbd5e1" stroke-width="2"/>
            <line x1="26" y1="30" x2="38" y2="30" stroke="#cbd5e1" stroke-width="1.5"/>
            <line x1="26" y1="34" x2="38" y2="34" stroke="#cbd5e1" stroke-width="1.5"/>
            <line x1="26" y1="38" x2="38" y2="38" stroke="#cbd5e1" stroke-width="1.5"/>
            <!-- Chispa de Iridio -->
            <polygon points="32 44 26 56 34 56 30 62 40 50 32 50" fill="#00f2fe" stroke="#ffffff" stroke-width="1"/>
        </svg>`,

        // Llantas / Neumáticos de Pista
        tire: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <circle cx="32" cy="32" r="26" stroke="#334155" stroke-width="7" fill="none"/>
            <circle cx="32" cy="32" r="16" fill="#0f172a" stroke="#00f2fe" stroke-width="2.5"/>
            <!-- Labrado deportivo en flecha -->
            <path d="M32 8 L30 14 M32 56 L34 50 M8 32 L14 34 M56 32 L50 30" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="32" cy="32" r="5" fill="#f59e0b"/>
        </svg>`,

        // Aceite Sintético de Motor (Motul / Yamalube)
        oil: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <!-- Botella de lubricante -->
            <path d="M24 14 L40 14 L46 24 L46 54 L18 54 L18 24 Z" fill="#1e293b" stroke="#f43f5e" stroke-width="2.5"/>
            <rect x="28" y="6" width="8" height="8" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5" rx="1"/>
            <!-- Gota de aceite lubricante -->
            <path d="M32 26 C28 32 24 36 24 40 C24 44.4 27.6 48 32 48 C36.4 48 40 44.4 40 40 C40 36 36 32 32 26 Z" fill="#f59e0b"/>
            <!-- Brillo -->
            <circle cx="30" cy="38" r="2" fill="#ffffff"/>
        </svg>`,

        // Casco Integral de Protección
        helmet: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <path d="M12 36 C12 20 22 10 36 10 C48 10 54 18 54 32 C54 44 48 50 38 52 L20 52 C14 52 12 44 12 36 Z" fill="#0f172a" stroke="#00f2fe" stroke-width="2.5"/>
            <!-- Visor ahumado -->
            <path d="M22 28 C26 22 40 22 48 28 L44 38 C38 42 26 42 20 38 Z" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
            <line x1="26" y1="48" x2="38" y2="48" stroke="#00f2fe" stroke-width="2" stroke-linecap="round"/>
        </svg>`,

        // Suspensión / Amortiguador Mono-Shock
        suspension: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <!-- Eje central -->
            <line x1="32" y1="6" x2="32" y2="58" stroke="#94a3b8" stroke-width="4"/>
            <!-- Resorte en espiral -->
            <path d="M20 18 Q44 22 20 26 Q44 30 20 34 Q44 38 20 42 Q44 46 20 50" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
            <!-- Ojos de montaje -->
            <circle cx="32" cy="8" r="5" fill="#1e293b" stroke="#00f2fe" stroke-width="2"/>
            <circle cx="32" cy="56" r="5" fill="#1e293b" stroke="#00f2fe" stroke-width="2"/>
        </svg>`,

        // Luces LED / Foco Silvín
        lights: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <path d="M14 22 C14 16 22 14 32 14 C42 14 50 16 50 22 L46 42 C44 48 38 50 32 50 C26 50 20 48 18 42 Z" fill="#0f172a" stroke="#00f2fe" stroke-width="2.5"/>
            <!-- Lupa LED / Proyector -->
            <circle cx="32" cy="30" r="10" fill="rgba(0, 242, 254, 0.25)" stroke="#00f2fe" stroke-width="2"/>
            <circle cx="32" cy="30" r="4" fill="#ffffff"/>
            <!-- Rayos de luz -->
            <line x1="32" y1="46" x2="32" y2="58" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="22" y1="44" x2="14" y2="54" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="42" y1="44" x2="50" y2="54" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
        </svg>`,

        // Carrocería / Escape Deportivo
        exhaust: `<svg viewBox="0 0 64 64" fill="none" class="part-svg">
            <path d="M8 20 C14 20 22 26 26 34 L54 26 L56 38 L28 46 C20 44 14 36 8 36 Z" fill="#1e293b" stroke="#00f2fe" stroke-width="2.5"/>
            <ellipse cx="54" cy="32" rx="3" ry="6" fill="#f59e0b"/>
            <!-- Líneas de fibra de carbono -->
            <line x1="32" y1="32" x2="36" y2="44" stroke="#334155" stroke-width="1.5"/>
            <line x1="40" y1="30" x2="44" y2="42" stroke="#334155" stroke-width="1.5"/>
        </svg>`
    },

    // ----------------------------------------------------------------------
    // 6. RESOLVEDOR INTELIGENTE DE ILUSTRACIÓN SVG
    // ----------------------------------------------------------------------
    getPartSvg: function(categorySlugOrName = '', productName = '') {
        const text = (String(categorySlugOrName) + ' ' + String(productName)).toLowerCase();

        if (text.includes('piston') || text.includes('motor') || text.includes('cilindr') || text.includes('valvula') || text.includes('biela') || text.includes('culata')) {
            return this.parts.piston;
        }
        if (text.includes('freno') || text.includes('pastilla') || text.includes('disco') || text.includes('caliper') || text.includes('bomba')) {
            return this.parts.brake;
        }
        if (text.includes('transmi') || text.includes('cadena') || text.includes('sprocket') || text.includes('corona') || text.includes('pinon') || text.includes('arrastre')) {
            return this.parts.chain;
        }
        if (text.includes('electr') || text.includes('bujia') || text.includes('bateria') || text.includes('cdi') || text.includes('bobina') || text.includes('regulador') || text.includes('estator')) {
            return this.parts.electric;
        }
        if (text.includes('llanta') || text.includes('neumatic') || text.includes('camara') || text.includes('rin')) {
            return this.parts.tire;
        }
        if (text.includes('aceite') || text.includes('lubricante') || text.includes('motul') || text.includes('filtro') || text.includes('grasa')) {
            return this.parts.oil;
        }
        if (text.includes('casco') || text.includes('guante') || text.includes('chaleco') || text.includes('accesorio') || text.includes('impermeable')) {
            return this.parts.helmet;
        }
        if (text.includes('suspens') || text.includes('amortiguador') || text.includes('telescopica') || text.includes('monoshock')) {
            return this.parts.suspension;
        }
        if (text.includes('luz') || text.includes('led') || text.includes('silvin') || text.includes('foco') || text.includes('via')) {
            return this.parts.lights;
        }
        if (text.includes('escape') || text.includes('mufla') || text.includes('retrovisor') || text.includes('manubrio') || text.includes('carroceria') || text.includes('carenado')) {
            return this.parts.exhaust;
        }

        // Por defecto: Pistón de alto rendimiento
        return this.parts.piston;
    }
};
