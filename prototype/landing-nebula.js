(() => {
  const canvas = document.querySelector('#signal-nebula');
  const hero = canvas?.closest('.hero');
  const ctx = canvas?.getContext('2d');
  if (!hero || !ctx) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, frame = 0, visible = true, points = [], lastPaint = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const tau = Math.PI * 2;

  function paint(time) {
    const mobile = width <= 760;
    pointer.x += (pointer.targetX - pointer.x) * .035;
    pointer.y += (pointer.targetY - pointer.y) * .035;
    const radius = Math.min(width * (mobile ? .34 : .16), mobile ? 190 : 250);
    const cx = width * (mobile ? .5 : .78) + pointer.x;
    const copy = hero.querySelector('.hero-copy');
    const cy = mobile ? copy.offsetTop + copy.offsetHeight + 145 : 220;
    const turn = time * .00013;
    ctx.clearRect(0, 0, width, height);
    for (const p of points) {
      const angle = p.angle + turn;
      // A woven orbital ribbon: one brand color, depth from light and movement.
      const wave = Math.sin(angle * 3 + p.band + turn * 2);
      const r = radius * (1 + Math.cos(p.band) * .16 + wave * .025);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      const z = Math.sin(p.band) * radius * .22 + wave * radius * .1;
      const rotatedY = y * .64 - z * .76;
      const depth = y * .76 + z * .64;
      const perspective = 1 + depth / (radius * 9);
      const alpha = .16 + (depth / radius + 1) * .32;
      ctx.fillStyle = p.silver ? `rgba(201,214,227,${alpha * .6})` : `rgba(234,208,120,${alpha})`;
      ctx.beginPath();
      ctx.arc(cx + x * perspective, cy + rotatedY * perspective + pointer.y, p.size * perspective, 0, tau);
      ctx.fill();
    }
  }

  function loop(time) {
    frame = 0;
    if (time - lastPaint >= 1000 / 30) { paint(time); lastPaint = time; }
    if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(loop);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (visible && !document.hidden) {
      paint(performance.now());
      if (!reduced.matches) frame = requestAnimationFrame(loop);
    }
  }
  function resize() {
    const box = hero.getBoundingClientRect();
    width = box.width; height = box.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = width <= 760 ? 1200 : 2400;
    points = Array.from({ length: count }, (_, i) => ({
      angle: i / count * tau * 37,
      band: i / count * tau * 17,
      size: i % 7 ? .7 : 1.15,
      silver: i % 5 === 0
    }));
    sync();
  }
  hero.addEventListener('pointermove', event => {
    if (reduced.matches || event.pointerType === 'touch') return;
    const box = hero.getBoundingClientRect();
    pointer.targetX = (event.clientX - box.left - width / 2) * .018;
    pointer.targetY = (event.clientY - box.top - height / 2) * .018;
  });
  hero.addEventListener('pointerleave', () => { pointer.targetX = 0; pointer.targetY = 0; });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(hero);

  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      reveal.unobserve(entry.target);
    }
  }, { threshold: .1 });
  document.documentElement.classList.add('motion-ready');
  document.querySelectorAll('.section-head,.workflow li,.proof-copy,.proof-grid').forEach(el => {
    el.classList.add('reveal');
    reveal.observe(el);
  });
})();
