// DELTASTORE VISUAL EFFECTS (CONFETTI & PARTICLES)
function triggerConfetti(originX = 0.5, originY = 0.5) {
    const canvas = document.createElement('canvas');
    canvas.id = 'deltastore-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ef4444', '#00b4d8', '#d97706', '#eab308', '#10b981', '#f8fafc'];
    const particles = [];
    const count = 75;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        particles.push({
            x: canvas.width * originX,
            y: canvas.height * originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            size: 6 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 15,
            alpha: 1,
            gravity: 0.18
        });
    }

    let frame = 0;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rotation += p.vRot;
            p.alpha -= 0.012;

            if (p.alpha > 0) {
                alive = true;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            }
        });

        frame++;
        if (alive && frame < 120) {
            requestAnimationFrame(render);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(render);
}

window.triggerConfetti = triggerConfetti;
