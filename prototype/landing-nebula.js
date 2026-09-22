(() => {
  const canvas = document.querySelector('#signal-nebula');
  const hero = canvas?.closest('.hero');
  if (!canvas || !hero) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = [[255,216,77],[106,168,255],[237,83,104],[177,149,255]];
  let width = 0, height = 0, dpr = 1, particles = [], frame = 0;
  const pointer = {x:0,y:0,targetX:0,targetY:0};

  function resize() {
    const box = hero.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    dpr = Math.min(devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = width < 700 ? 76 : 150;
    const radius = Math.min(width * (width < 850 ? .44 : .31), height * .44);
    particles = Array.from({length:count}, (_, i) => ({
      arm:i % 3,
      radius:24 + Math.pow(Math.random(), .72) * radius,
      angle:Math.random() * Math.PI * 2,
      speed:.000035 + Math.random() * .000055,
      phase:Math.random() * Math.PI * 2,
      size:.55 + Math.random() * 1.65,
      color:colors[i % colors.length]
    })).sort((a,b) => a.arm-b.arm || a.radius-b.radius);
    draw(performance.now(), true);
  }

  function position(p, time) {
    const mobile = width < 850;
    const cx = width * (mobile ? .5 : .755) + pointer.x;
    const cy = height * (mobile ? .73 : .46) + pointer.y;
    const theta = p.angle + p.arm * Math.PI * 2 / 3 + p.radius * .012 + time * p.speed;
    const breathe = 1 + Math.sin(time * .00055 + p.phase) * .035;
    return {
      x:cx + Math.cos(theta) * p.radius * (mobile ? 1 : 1.13) * breathe,
      y:cy + Math.sin(theta) * p.radius * .57 * breathe + Math.sin(time * .0008 + p.phase) * 5
    };
  }

  function draw(time, still = false) {
    pointer.x += (pointer.targetX - pointer.x) * .035;
    pointer.y += (pointer.targetY - pointer.y) * .035;
    ctx.clearRect(0, 0, width, height);
    const mobile = width < 850;
    const cx = width * (mobile ? .5 : .755) + pointer.x;
    const cy = height * (mobile ? .73 : .46) + pointer.y;

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width,height) * .38);
    halo.addColorStop(0, 'rgba(255,216,77,.17)');
    halo.addColorStop(.23, 'rgba(106,168,255,.11)');
    halo.addColorStop(.58, 'rgba(177,149,255,.045)');
    halo.addColorStop(1, 'rgba(7,19,60,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);

    const positions = particles.map(p => position(p, time));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < particles.length; i++) {
      const current = particles[i], previous = particles[i-1];
      if (current.arm !== previous.arm) continue;
      const a = positions[i-1], b = positions[i];
      const distance = Math.hypot(a.x-b.x, a.y-b.y);
      if (distance > 95) continue;
      const [r,g,blue] = current.color;
      ctx.strokeStyle = `rgba(${r},${g},${blue},${Math.max(.025,.13-distance/900)})`;
      ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    particles.forEach((p,i) => {
      const {x,y} = positions[i], [r,g,b] = p.color;
      const alpha = .3 + .38 * (1 - p.radius / Math.max(width,height));
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha*.16})`;
      ctx.beginPath(); ctx.arc(x,y,p.size*4.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath(); ctx.arc(x,y,p.size,0,Math.PI*2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    const core = ctx.createRadialGradient(cx,cy,0,cx,cy,34);
    core.addColorStop(0,'rgba(255,248,207,.95)');core.addColorStop(.18,'rgba(255,216,77,.72)');core.addColorStop(.52,'rgba(106,168,255,.2)');core.addColorStop(1,'rgba(106,168,255,0)');
    ctx.fillStyle=core;ctx.beginPath();ctx.arc(cx,cy,34,0,Math.PI*2);ctx.fill();
    if (!still && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(draw);
  }

  hero.addEventListener('pointermove', event => {
    const box = hero.getBoundingClientRect();
    pointer.targetX = (event.clientX - box.left - box.width / 2) * .028;
    pointer.targetY = (event.clientY - box.top - box.height / 2) * .028;
  });
  hero.addEventListener('pointerleave', () => { pointer.targetX = 0; pointer.targetY = 0; });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) draw(performance.now(), reducedMotion.matches);
  });
  reducedMotion.addEventListener('change', resize);
  new ResizeObserver(resize).observe(hero);
})();
