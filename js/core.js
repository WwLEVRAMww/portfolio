/* Shared pieces: helpers, smooth scroll, cursor, grain, HUD, theme, menu, magnetic, roll text. */
(function () {
  'use strict';
  const APP = (window.APP = window.APP || {});

  APP.fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  APP.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  APP.$ = function (s, r) { return (r || document).querySelector(s); };
  APP.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  APP.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  APP.lerp = function (a, b, t) { return a + (b - a) * t; };
  APP.pad2 = function (n) { return String(n).padStart(2, '0'); };
  APP.mobile = function () { return window.innerWidth <= 700; };

  // marks el._visible while the element is on (or near) the screen
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target._visible = e.isIntersecting; });
  }, { rootMargin: '15% 0px' });
  APP.watch = function (el) { if (el) { el._visible = false; io.observe(el); } return el; };

  /* ---------- aperture icon (menu button, red cards) ---------- */
  APP.Aperture = function (el, opts) {
    opts = opts || {};
    const solid = !!opts.solid;
    const sw = opts.stroke || 3;
    el.innerHTML = '<svg viewBox="-50 -50 100 100" aria-hidden="true">' +
      (solid
        ? '<path class="ap-body" fill="currentColor" fill-rule="evenodd"/><path class="ap-lines" fill="none" stroke-width="' + sw + '" stroke-linecap="round"/>'
        : '<circle r="46" fill="none" stroke="currentColor" stroke-width="' + sw + '"/><path class="ap-lines" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"/>') +
      '</svg>';
    const body = el.querySelector('.ap-body');
    const lines = el.querySelector('.ap-lines');
    if (solid) lines.setAttribute('stroke', opts.cut || 'var(--accent)');
    const st = { open: opts.open == null ? 0.45 : opts.open, rot: opts.rot || 0 };
    const R = 46;
    function draw() {
      const h = 6 + st.open * 30;
      const V = [];
      for (let i = 0; i < 6; i++) {
        const a = st.rot + i * Math.PI / 3;
        V.push([Math.cos(a) * h, Math.sin(a) * h]);
      }
      const f = function (n) { return n.toFixed(2); };
      let hex = 'M' + V.map(function (v) { return f(v[0]) + ' ' + f(v[1]); }).join('L') + 'Z';
      let d = solid ? '' : hex;
      for (let i = 0; i < 6; i++) {
        const v = V[(i + 1) % 6];
        const a = st.rot + i * Math.PI / 3 + 2 * Math.PI / 3;
        const dx = Math.cos(a), dy = Math.sin(a);
        const b = v[0] * dx + v[1] * dy;
        const t = -b + Math.sqrt(Math.max(0, b * b - (v[0] * v[0] + v[1] * v[1]) + R * R));
        d += 'M' + f(v[0]) + ' ' + f(v[1]) + 'L' + f(v[0] + dx * t) + ' ' + f(v[1] + dy * t);
      }
      lines.setAttribute('d', d);
      if (body) body.setAttribute('d', 'M46 0A46 46 0 1 0 -46 0A46 46 0 1 0 46 0Z' + hex);
    }
    draw();
    return { st: st, draw: draw, to: function (vars) { return gsap.to(st, Object.assign({ onUpdate: draw }, vars)); } };
  };

  /* ---------- smooth scroll ---------- */
  APP.initScroll = function () {
    gsap.registerPlugin(ScrollTrigger, Flip, SplitText, ScrambleTextPlugin, DrawSVGPlugin, CustomEase);
    ScrollTrigger.config({ ignoreMobileResize: true });
    CustomEase.create('shutter', 'M0,0 C0.7,0 0.15,1 1,1');
    if (!APP.reduced) {
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
      APP.lenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      const href = a.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      APP.scrollTo(href);
    });
  };
  APP.velocity = function () { return APP.lenis ? APP.lenis.velocity : 0; };
  APP.scrollTo = function (target, opts) {
    const el = target === '#top' || target === 0 ? 0 : (typeof target === 'string' ? document.querySelector(target) : target);
    if (el == null) return;
    if (APP.lenis) {
      APP.lenis.scrollTo(el, Object.assign({ duration: 1.8, easing: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); } }, opts || {}));
    } else if (el === 0) {
      window.scrollTo({ top: 0 });
    } else {
      el.scrollIntoView();
    }
  };
  APP.lock = function (on) {
    if (APP.lenis) { if (on) APP.lenis.stop(); else APP.lenis.start(); }
    document.documentElement.style.overflow = on ? 'hidden' : '';
  };

  /* ---------- cursor ---------- */
  APP.initCursor = function () {
    if (!APP.fine) return;
    const cur = APP.$('.cursor');
    const dot = APP.$('.cursor-dot');
    const label = APP.$('.cursor__label');
    document.documentElement.classList.add('has-cursor');
    gsap.set([cur, dot], { x: -100, y: -100 });
    const xTo = gsap.quickTo(cur, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(cur, 'y', { duration: 0.5, ease: 'power3' });
    const dxTo = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'none' });
    const dyTo = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'none' });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      xTo(e.clientX); yTo(e.clientY); dxTo(e.clientX); dyTo(e.clientY);
    }, { passive: true });
    const names = { view: 'Смотреть', drag: 'Крути', open: 'Открыть' };
    let state = null;
    function update(target) {
      const t = target && target.closest ? target.closest('[data-cursor], a, button') : null;
      const s = t ? (t.dataset.cursor || 'link') : '';
      const txt = t && t.dataset.cursorLabel ? t.dataset.cursorLabel : (names[s] || '');
      if (s === state && label.textContent === txt) return;
      state = s;
      cur.dataset.state = s;
      label.textContent = txt;
    }
    document.addEventListener('pointerover', function (e) { update(e.target); });
    APP.refreshCursor = function () {
      const r = cur.getBoundingClientRect();
      update(document.elementFromPoint(r.left, r.top));
    };
    document.addEventListener('pointerdown', function () { cur.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { cur.classList.remove('is-down'); });
    document.documentElement.addEventListener('mouseleave', function () { gsap.to([cur, dot], { opacity: 0, duration: 0.3 }); });
    document.documentElement.addEventListener('mouseenter', function () { gsap.to([cur, dot], { opacity: 1, duration: 0.3 }); });
  };

  /* ---------- film grain ---------- */
  APP.initGrain = function () {
    const c = document.createElement('canvas');
    c.width = c.height = 180;
    const g = c.getContext('2d');
    const d = g.createImageData(180, 180);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    APP.$('.grain').style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
  };

  /* ---------- roll text: letters slide up on hover ---------- */
  APP.initRoll = function (root) {
    APP.$$('.roll', root).forEach(function (el) {
      if (el.dataset.rolled) return;
      el.dataset.rolled = '1';
      const text = el.textContent.trim();
      if (!text) return;
      if (!el.getAttribute('aria-label') && el.tagName !== 'SPAN') el.setAttribute('aria-label', text);
      const chars = Array.from(text).map(function (ch, i) {
        const c = ch === ' ' ? '&nbsp;' : APP.esc(ch);
        return '<span class="roll__c" style="--i:' + i + '"><span>' + c + '</span><span>' + c + '</span></span>';
      }).join('');
      el.innerHTML = '<span class="roll__w" aria-hidden="true">' + chars + '</span>';
    });
  };

  /* ---------- magnetic elements ---------- */
  APP.initMagnetic = function () {
    if (!APP.fine) return;
    APP.$$('.magnetic').forEach(function (el) {
      const inner = el.querySelector('.magnetic__in');
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      const ixTo = inner ? gsap.quickTo(inner, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' }) : null;
      const iyTo = inner ? gsap.quickTo(inner, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' }) : null;
      el.addEventListener('pointermove', function (e) {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        xTo(dx * 0.35); yTo(dy * 0.35);
        if (ixTo) { ixTo(dx * 0.18); iyTo(dy * 0.18); }
      });
      el.addEventListener('pointerleave', function () {
        xTo(0); yTo(0);
        if (ixTo) { ixTo(0); iyTo(0); }
      });
    });
  };

  /* ---------- HUD: progress, frame counter, exposure readout ---------- */
  APP.initHud = function () {
    const bar = APP.$('.progress');
    const num = APP.$('.hud__num');
    const val = APP.$('.hud__val');
    let frame = 1;
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        gsap.set(bar, { scaleX: self.progress });
        const f = 1 + Math.round(self.progress * 35);
        if (f !== frame) {
          frame = f;
          num.textContent = APP.pad2(f);
          gsap.fromTo(num, { yPercent: self.direction > 0 ? 60 : -60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power3.out', overwrite: true });
        }
      },
    });
    ScrollTrigger.create({
      trigger: '.contact', start: 'top 70%', end: 'max', refreshPriority: -1,
      onToggle: function (self) { document.body.classList.toggle('near-end', self.isActive); },
    });
    let current = val.textContent;
    APP.$$('[data-exif]').forEach(function (sec) {
      const spacer = sec.parentElement && sec.parentElement.classList.contains('pin-spacer') ? sec.parentElement : sec;
      ScrollTrigger.create({
        trigger: spacer, start: 'top 55%', end: 'bottom 55%', refreshPriority: -1,
        onToggle: function (self) {
          if (!self.isActive || sec.dataset.exif === current) return;
          current = sec.dataset.exif;
          gsap.to(val, { duration: 0.9, scrambleText: { text: current, chars: '0123456789/·.', speed: 0.5 }, overwrite: true });
        },
      });
    });
  };

  /* ---------- page colour: dark zone in the middle ---------- */
  APP.initTheme = function () {
    const root = document.documentElement;
    const light = { '--bg-rgb': '221, 220, 216', '--ink-rgb': '18, 18, 18' };
    const dark = { '--bg-rgb': '14, 14, 14', '--ink-rgb': '233, 232, 228' };
    APP.$$('[data-theme-zone="dark"]').forEach(function (zone) {
      ScrollTrigger.create({
        trigger: zone, start: 'top 55%', end: 'bottom 45%',
        refreshPriority: -1, // measure after the pinned sections inside the zone
        onToggle: function (self) {
          gsap.to(root, Object.assign({ duration: 0.8, ease: 'power2.inOut', overwrite: 'auto' }, self.isActive ? dark : light));
        },
      });
    });
  };

  /* ---------- header behaviour ---------- */
  APP.initNav = function () {
    const nav = APP.$('.nav');
    const hero = APP.$('.hero');
    ScrollTrigger.create({
      trigger: hero, start: 'bottom 30%',
      onEnter: function () { document.body.classList.add('past-hero'); },
      onLeaveBack: function () { document.body.classList.remove('past-hero'); },
    });
    if (APP.lenis) {
      APP.lenis.on('scroll', function (l) {
        if (document.body.classList.contains('menu-open')) return;
        const past = l.scroll > hero.offsetHeight * 0.8;
        if (past && l.direction === 1 && l.velocity > 3) nav.classList.add('is-hidden');
        else if (l.direction === -1 || !past) nav.classList.remove('is-hidden');
      });
    }
  };

  /* ---------- fullscreen menu ---------- */
  APP.initMenu = function () {
    const btn = APP.$('.nav__menu');
    const txt = APP.$('.nav__menu-txt');
    const menu = APP.$('.menu');
    const links = APP.$$('.menu__link', menu);
    const inners = APP.$$('.menu__txt > span', menu);
    const nums = APP.$$('.menu__num', menu);
    const aside = APP.$('.menu__aside', menu);
    const icon = APP.Aperture(APP.$('[data-aperture]', btn), { open: 0.42, stroke: 3.2 });
    APP.navIcon = icon;
    let open = false;

    btn.addEventListener('pointerenter', function () { if (!open) icon.to({ open: 0.85, rot: '+=' + Math.PI / 3, duration: 0.7, ease: 'power3.out', overwrite: true }); });
    btn.addEventListener('pointerleave', function () { if (!open) icon.to({ open: 0.42, duration: 0.7, ease: 'power3.out', overwrite: true }); });

    function circle(r) {
      const b = btn.getBoundingClientRect();
      const x = b.right - 23, y = b.top + b.height / 2;
      return 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)';
    }

    function setLabel(t) {
      txt.removeAttribute('data-rolled');
      txt.textContent = t;
      APP.initRoll(btn);
    }

    function toggle(force) {
      open = typeof force === 'boolean' ? force : !open;
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      menu.setAttribute('aria-hidden', String(!open));
      setLabel(open ? 'Закрыть' : 'Меню');
      const R = Math.hypot(window.innerWidth, window.innerHeight);
      gsap.killTweensOf([menu, inners, nums, aside]);
      if (open) {
        APP.lock(true);
        gsap.set(menu, { visibility: 'visible' });
        gsap.fromTo(menu, { clipPath: circle(0) }, { clipPath: circle(R), duration: 1, ease: 'power3.inOut' });
        gsap.fromTo(inners, { yPercent: 110, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1, ease: 'power4.out', stagger: 0.06, delay: 0.35, clearProps: 'transform' });
        gsap.fromTo(nums, { opacity: 0 }, { opacity: 0.45, duration: 0.6, stagger: 0.06, delay: 0.5 });
        gsap.fromTo(aside, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.6, ease: 'power3.out' });
        icon.to({ open: 0.08, rot: '+=' + Math.PI, duration: 0.9, ease: 'power3.inOut', overwrite: true });
      } else {
        gsap.to(menu, {
          clipPath: circle(0), duration: 0.8, ease: 'power3.inOut',
          onComplete: function () { gsap.set(menu, { visibility: 'hidden' }); },
        });
        icon.to({ open: 0.42, rot: '-=' + Math.PI, duration: 0.9, ease: 'power3.inOut', overwrite: true });
        APP.lock(false);
      }
    }
    APP.toggleMenu = toggle;
    btn.addEventListener('click', function () { toggle(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) toggle(false); });

    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const href = a.getAttribute('href');
        toggle(false);
        setTimeout(function () { APP.scrollTo(href, { duration: 1.4 }); }, 380);
      });
    });

    // floating photo preview that follows the cursor over the links
    if (APP.fine) {
      const prev = APP.$('.menu__preview', menu);
      const imgs = APP.$$('img', prev);
      let front = 0, shown = false, lastX = 0;
      const xTo = gsap.quickTo(prev, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(prev, 'y', { duration: 0.6, ease: 'power3' });
      const rTo = gsap.quickTo(prev, 'rotation', { duration: 0.8, ease: 'power3' });
      menu.addEventListener('pointermove', function (e) {
        xTo(e.clientX + 30); yTo(e.clientY - prev.offsetHeight / 2);
        rTo(APP.clamp((e.clientX - lastX) * 0.6, -14, 14));
        lastX = e.clientX;
      });
      links.forEach(function (a) {
        a.addEventListener('pointerenter', function () {
          const next = imgs[front ^ 1];
          Photos.get(a.dataset.photo, 0.8, 600).then(function (res) {
            next.src = res.url;
            gsap.set(next, { zIndex: 2 });
            gsap.set(imgs[front], { zIndex: 1 });
            gsap.fromTo(next, { clipPath: 'inset(100% 0 0 0)', scale: 1.2 }, { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 0.6, ease: 'expo.out' });
            front ^= 1;
          });
          if (!shown) { shown = true; gsap.to(prev, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }); }
        });
        a.addEventListener('pointerleave', function () {
          shown = false;
          gsap.to(prev, { opacity: 0, scale: 0.6, duration: 0.4, ease: 'power3.in' });
        });
      });
    }
  };

  /* ---------- section headings: letters rise, rule draws ---------- */
  APP.initHeadings = function () {
    APP.$$('.sec-head').forEach(function (head) {
      ScrollTrigger.create({ trigger: head, start: 'top 88%', once: true, onEnter: function () { head.classList.add('is-in'); } });
    });
    APP.$$('[data-split]').forEach(function (el) {
      if (APP.reduced) return;
      SplitText.create(el, {
        type: 'lines,chars', mask: 'lines', autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.chars, {
            yPercent: 115, rotate: 6, duration: 1.15, ease: 'power4.out', stagger: 0.028,
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        },
      });
    });
  };

  /* ---------- images: clip reveal, parallax, velocity skew ---------- */
  APP.initImages = function (root) {
    APP.$$('[data-reveal]', root).forEach(function (el) {
      if (el.dataset.revealed) return;
      el.dataset.revealed = '1';
      if (APP.reduced) return;
      const img = el.querySelector('img');
      const st = { trigger: el, start: 'top 92%', once: true };
      gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.out', scrollTrigger: st });
      if (img) gsap.fromTo(img, { scale: 1.35 }, { scale: 1, duration: 2, ease: 'expo.out', scrollTrigger: Object.assign({}, st) });
    });
    APP.$$('[data-parallax]', root).forEach(function (el) {
      if (el.dataset.parallaxed || APP.reduced) return;
      el.dataset.parallaxed = '1';
      const img = el.querySelector('img');
      if (!img) return;
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  };

  APP.initSkew = function () {
    if (APP.reduced) return;
    const els = APP.$$('.work__media, .stat');
    const set = els.map(function (el) { return gsap.quickSetter(el, 'skewY', 'deg'); });
    let s = 0;
    gsap.ticker.add(function () {
      const target = APP.clamp(APP.velocity() * -0.1, -4, 4);
      const next = s + (target - s) * 0.12;
      if (Math.abs(next - s) < 0.005 && Math.abs(next) < 0.01) return;
      s = Math.abs(next) < 0.01 ? 0 : next;
      for (let i = 0; i < set.length; i++) set[i](s);
    });
  };
})();
