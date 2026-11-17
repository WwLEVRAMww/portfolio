/* First screen: iris loader, rolling title, red block with blinds, card wheel. */
(function () {
  'use strict';
  const APP = (window.APP = window.APP || {});
  const TAU = Math.PI * 2;

  /* ---------- loader: a 6-blade iris drawn on canvas ---------- */
  function Iris() {
    const root = APP.$('.loader');
    const cv = APP.$('.loader__iris');
    const g = cv.getContext('2d');
    let W = 0, H = 0;
    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);
    const st = { r: 0, rot: 0, k: 0, show: true };
    const imgs = [];
    function draw() {
      g.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, far = Math.hypot(W, H) * 1.5;
      const V = [];
      for (let i = 0; i < 6; i++) {
        const a = st.rot + i * TAU / 6;
        V.push([cx + Math.cos(a) * st.r, cy + Math.sin(a) * st.r]);
      }
      if (st.show && st.r > 2 && imgs.length) {
        const im = imgs[st.k % imgs.length];
        if (im.complete && im.naturalWidth) {
          g.save();
          g.beginPath();
          V.forEach(function (v, i) { if (i) g.lineTo(v[0], v[1]); else g.moveTo(v[0], v[1]); });
          g.closePath(); g.clip();
          const s = Math.max(2.1 * st.r / im.naturalWidth, 2.1 * st.r / im.naturalHeight);
          g.drawImage(im, cx - im.naturalWidth * s / 2, cy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
          g.restore();
        }
      }
      for (let i = 0; i < 6; i++) {
        const a0 = st.rot + i * TAU / 6 + TAU / 3, a1 = a0 + TAU / 6;
        const v1 = V[(i + 1) % 6], v2 = V[(i + 2) % 6];
        g.beginPath();
        g.moveTo(v1[0], v1[1]);
        g.lineTo(v1[0] + Math.cos(a0) * far, v1[1] + Math.sin(a0) * far);
        g.lineTo(v2[0] + Math.cos(a1) * far, v2[1] + Math.sin(a1) * far);
        g.lineTo(v2[0], v2[1]);
        g.closePath();
        g.fillStyle = i % 2 ? '#141414' : '#1b1b1a';
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(v1[0], v1[1]);
        g.lineTo(v1[0] + Math.cos(a0) * far, v1[1] + Math.sin(a0) * far);
        g.stroke();
      }
      if (st.r > 2) {
        g.strokeStyle = 'rgba(255,255,255,0.16)';
        g.lineWidth = 1.5;
        g.beginPath();
        V.forEach(function (v, i) { if (i) g.lineTo(v[0], v[1]); else g.moveTo(v[0], v[1]); });
        g.closePath(); g.stroke();
      }
    }
    gsap.ticker.add(draw);
    return {
      st: st,
      add: function (url) { const im = new Image(); im.src = url; imgs.push(im); },
      destroy: function () {
        gsap.ticker.remove(draw);
        window.removeEventListener('resize', size);
        root.remove();
      },
    };
  }

  // Resolves when the page should start its intro (the shutter has fired).
  APP.runLoader = function (shots, ready) {
    const loader = APP.$('.loader');
    const iris = Iris();
    Promise.resolve(shots).then(function (list) {
      (list || []).forEach(function (p) { p.then(function (res) { iris.add(res.url); }); });
    });
    const ui = APP.$('.loader__ui');
    const count = APP.$('.loader__count');
    const flash = APP.$('.loader__flash');

    if (APP.reduced) {
      return ready.then(function () {
        return gsap.to(loader, { opacity: 0, duration: 0.5, onComplete: iris.destroy });
      });
    }

    gsap.from(APP.$$('.loader__ui > *'), { yPercent: 120, opacity: 0, stagger: 0.08, duration: 0.9, ease: 'power3.out' });
    gsap.to(iris.st, { r: Math.min(window.innerWidth, window.innerHeight) * 0.2, rot: 1.3, duration: 1.4, ease: 'power3.inOut', delay: 0.25 });
    const flick = setInterval(function () { iris.st.k++; }, 150);
    const c = { v: 0 };
    const show = function () { count.textContent = String(Math.round(c.v)).padStart(3, '0'); };
    // count to 90 on a timer, the last part only once the photos are in
    const counting = gsap.to(c, { v: 90, duration: 2.3, ease: 'power2.inOut', onUpdate: show });

    return Promise.all([counting, ready]).then(function () {
      return gsap.to(c, { v: 100, duration: 0.35, ease: 'power1.out', onUpdate: show });
    }).then(function () {
      return new Promise(function (start) {
        clearInterval(flick);
        const tl = gsap.timeline({ onComplete: iris.destroy });
        tl.to(iris.st, { r: 0, rot: '+=0.7', duration: 0.34, ease: 'power3.in' })
          .to(ui, { opacity: 0, duration: 0.25 }, '<')
          .set(flash, { opacity: 0.9 })
          .add(function () { iris.st.show = false; loader.classList.add('is-out'); start(); })
          .to(flash, { opacity: 0, duration: 0.6, ease: 'power2.out' })
          .to(iris.st, { r: function () { return Math.hypot(window.innerWidth, window.innerHeight) * 0.62; }, rot: '+=1.8', duration: 1.4, ease: 'expo.inOut' }, '<');
      });
    });
  };

  /* ---------- rolling title ---------- */
  APP.initDrum = function () {
    const title = APP.$('.hero__title');
    const word = String(window.SITE.heroWord || '').toUpperCase();
    title.setAttribute('aria-label', window.SITE.name + ' — ' + window.SITE.heroWord);
    title.innerHTML = '<span class="drum" aria-hidden="true">' + Array.from(word).map(function (ch) {
      const c = ch === ' ' ? '&nbsp;' : APP.esc(ch);
      return '<span class="dc"><span class="dd">' + [0, 1, 2, 3].map(function (k) {
        return '<span class="df df' + k + '" style="--k:' + k + '">' + c + '</span>';
      }).join('') + '</span></span>';
    }).join('') + '</span>';
    const dcs = APP.$$('.dc', title);
    const dds = APP.$$('.dd', title);
    APP.drumChars = dds;

    if (APP.reduced) return;
    // idle loop: every few seconds the word rolls one face down, letter by letter
    const loop = gsap.timeline({ repeat: -1, paused: true });
    for (let k = 1; k <= 4; k++) {
      loop.to(dds, { rotationX: -90 * k, duration: 1.2, ease: 'power3.inOut', stagger: { each: 0.065 } }, (k - 1) * 2.8 + 1.2);
    }
    APP.drumLoop = loop;
    // hover a letter to flip it
    dcs.forEach(function (el) {
      el.addEventListener('pointerenter', function () {
        if (el._busy) return;
        el._busy = true;
        gsap.to(el, { rotationX: '-=180', duration: 0.9, ease: 'power3.out', onComplete: function () { el._busy = false; } });
      });
    });
  };

  /* ---------- red block: blinds open to show the portrait ---------- */
  APP.initBlock = function () {
    const block = APP.$('.hero__block');
    const slats = APP.$$('.blinds i', block);
    function blinds(open) {
      return gsap.to(slats, {
        scaleX: open ? 0 : 1, duration: 0.75, ease: 'power3.inOut', overwrite: true,
        stagger: { each: 0.05, from: open ? 'start' : 'end' },
      });
    }
    APP.blinds = blinds;
    let shown = false;
    block.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { shown = true; blinds(true); } });
    block.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { shown = false; blinds(false); } });
    block.addEventListener('click', function () { shown = !shown; blinds(shown); });
  };

  /* ---------- card wheel ---------- */
  APP.initWheel = function () {
    const hero = APP.$('.hero');
    const wheel = APP.$('.wheel');
    const spin = APP.$('.wheel__spin');
    const label = APP.$('.wheel__label');
    const cards = APP.$$('.wcard', wheel);
    const N = cards.length;
    const step = 360 / N;
    const S = { phi: 0, vel: 0, auto: APP.reduced ? 0 : 4.5, drag: false, R: 300, cw: 180, ch: 260, spin: 0 };
    APP.wheel = S;
    APP.watch(hero);

    APP.$$('[data-aperture="card"]', wheel).forEach(function (el) {
      APP.Aperture(el, { solid: true, open: 0.5, cut: 'var(--accent)', stroke: 2.2 });
    });
    gsap.set('.wheel__ring', { xPercent: -50, yPercent: -50, x: 0, y: 0 });

    cards.forEach(function (c, i) {
      c._base = i * step;
      c._st = { p: 1, hover: 0 };
      c.addEventListener('dragstart', function (e) { e.preventDefault(); });
      c.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        gsap.to(c._st, { hover: 1, duration: 0.5, ease: 'power3.out', overwrite: true });
        S.auto = APP.reduced ? 0 : 1.2;
      });
      c.addEventListener('pointerleave', function () {
        gsap.to(c._st, { hover: 0, duration: 0.6, ease: 'power3.out', overwrite: true });
        S.auto = APP.reduced ? 0 : 4.5;
      });
      c.addEventListener('click', function (e) {
        if (c.dataset.series != null && APP.openSeries) {
          e.preventDefault();
          APP.openSeries(+c.dataset.series, c.querySelector('img'));
          return;
        }
        if (c.dataset.filter && APP.setWorksFilter) APP.setWorksFilter(c.dataset.filter);
      });
    });

    function layout() {
      const H = hero.clientHeight, W = hero.clientWidth, mob = W <= 700;
      S.ch = Math.min(H * (mob ? 0.29 : 0.3), W * (mob ? 0.58 : 0.19));
      S.cw = S.ch * 0.68;
      S.R = S.ch * 1.38;
      wheel.style.top = (H + S.ch * 0.08) + 'px';
      wheel.style.setProperty('--cw', S.cw.toFixed(1) + 'px');
      wheel.style.setProperty('--ch', S.ch.toFixed(1) + 'px');
      wheel.style.setProperty('--ring', (S.R * 0.96).toFixed(1) + 'px');
    }
    layout();
    window.addEventListener('resize', layout);

    let top = -1;
    function setLabel(t) {
      if (APP.reduced) { label.textContent = t; return; }
      gsap.to(label, { duration: 0.6, scrambleText: { text: t, chars: 'АБВГДЕЖЗИКЛМНОПРСТУФХЭЮЯ', speed: 0.7 }, overwrite: true });
    }

    function render(time, dtMs) {
      const dt = Math.min(dtMs, 60) / 1000;
      if (!S.drag) {
        S.vel += (S.auto - S.vel) * Math.min(1, dt * 1.5);
        S.phi += S.vel * dt;
      }
      S.phi += APP.velocity() * 0.05;
      S.spin += dt * 5;
      if (!hero._visible) return;
      let best = 999, bi = 0;
      for (let i = 0; i < N; i++) {
        const c = cards[i];
        const a = ((c._base + S.phi) % 360 + 540) % 360 - 180;
        if (Math.abs(a) < Math.abs(best)) { best = a; bi = i; }
        const p = c._st.p;
        const ang = a * p;
        if (Math.abs(ang) > 115) {
          if (c._vis !== false) { c.style.visibility = 'hidden'; c._vis = false; }
          continue;
        }
        if (c._vis !== true) { c.style.visibility = 'visible'; c._vis = true; }
        const hv = c._st.hover;
        const rad = S.R * (0.5 + 0.5 * p) + hv * S.ch * 0.1;
        const sc = (1 + hv * 0.05) * (0.8 + 0.2 * p);
        c.style.transform = 'translate(-50%, -50%) rotate(' + ang.toFixed(3) + 'deg) translateY(' + (-rad).toFixed(2) + 'px) scale(' + sc.toFixed(4) + ')';
        c.style.zIndex = String(400 - Math.round(Math.abs(a)) + (hv > 0.01 ? 400 : 0));
        c.style.opacity = p < 1 ? Math.min(1, p * 3).toFixed(3) : '';
      }
      if (bi !== top) { top = bi; setLabel(cards[bi].dataset.label); }
      spin.style.transform = 'rotate(' + (S.spin - S.phi * 0.3).toFixed(2) + 'deg)';
    }
    gsap.ticker.add(render);

    // drag anywhere on the first screen to spin
    let lastX = 0, lastT = 0, moved = 0;
    hero.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('.hero__block')) return;
      S.drag = true; lastX = e.clientX; lastT = performance.now(); moved = 0; S.vel = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!S.drag) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const dphi = dx / S.R * 180 / Math.PI;
      S.phi += dphi;
      S.vel = APP.lerp(S.vel, dphi / (Math.max(8, now - lastT) / 1000), 0.35);
      lastT = now;
      moved += Math.abs(dx);
      if (moved > 8) hero.classList.add('is-dragging');
    });
    function release() {
      if (!S.drag) return;
      S.drag = false;
      S.vel = APP.clamp(S.vel, -480, 480);
      hero.classList.remove('is-dragging');
    }
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    wheel.addEventListener('click', function (e) {
      if (moved > 8) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // cards start stacked at the top and deal out during the intro
    cards.forEach(function (c) { c._st.p = 0; });
    APP.wheelIntro = function () {
      const tl = gsap.timeline();
      tl.to(cards.map(function (c) { return c._st; }), { p: 1, duration: 1.7, ease: 'expo.out', stagger: { each: 0.05, from: 'center' } }, 0)
        .from(S, { phi: S.phi - 100, duration: 2.4, ease: 'expo.out' }, 0);
      return tl;
    };
  };

  /* ---------- intro after the shutter ---------- */
  APP.heroIntro = function () {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    if (APP.reduced) {
      APP.$$('.wcard').forEach(function (c) { c._st.p = 1; });
      return tl;
    }
    tl.from('.hero__block', { scaleY: 0, duration: 1.4, ease: 'expo.out' }, 0)
      .from(APP.drumChars, { rotationX: 90, duration: 1.5, ease: 'expo.out', stagger: 0.06 }, 0.08)
      .from('.hero__welcome .mask > span', { yPercent: 115, duration: 1.1, stagger: 0.08 }, 0.25)
      .from('.hero__label .mask > span', { yPercent: 115, duration: 1.1, stagger: 0.08 }, 0.4)
      .from('.cross', { scale: 0, rotation: -90, duration: 1.1, stagger: 0.04, ease: 'back.out(2)' }, 0.2)
      .from('.hero__tag', { y: 12, opacity: 0, duration: 1.1 }, 0.7)
      .from('.tri--l', { x: -40, opacity: 0, duration: 1.1 }, 0.5)
      .from('.tri--r', { x: 40, opacity: 0, duration: 1.1 }, 0.5)
      .add(APP.wheelIntro(), 0.3)
      .from('.wheel__ring', { scale: 0.5, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0.5)
      .from('.nav__menu', { y: -30, opacity: 0, duration: 1 }, 0.6)
      .add(function () { APP.blinds(true); }, 1.25)
      .add(function () { APP.blinds(false); }, 2.6)
      .add(function () { if (APP.drumLoop) APP.drumLoop.play(); }, 1.8);
    return tl;
  };

  /* ---------- mouse depth + scroll-out ---------- */
  APP.initHeroMotion = function () {
    const hero = APP.$('.hero');
    gsap.set('.hero__stage', { xPercent: -50, x: 0 });
    if (APP.reduced) return;
    if (APP.fine) {
      const layers = [
        ['.hero__title', -16, -8], ['.hero__block', 10, 6], ['.hero__welcome', -6, -3],
        ['.hero__marks', 5, 4], ['.wheel', -12, -4],
      ].map(function (l) {
        const el = APP.$(l[0]);
        return { x: gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(el, 'y', { duration: 1.2, ease: 'power3' }), kx: l[1], ky: l[2] };
      });
      hero.addEventListener('pointermove', function (e) {
        const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
        layers.forEach(function (l) { l.x(nx * l.kx); l.y(ny * l.ky); });
      });
    }
    gsap.to('.hero__stage', {
      yPercent: -22, opacity: 0.25, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  };
})();
