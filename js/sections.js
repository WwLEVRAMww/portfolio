/* Scroll sections: tapes, about, works, series wave, film strip, zoom, services, process, trail, contact, footer. */
(function () {
  'use strict';
  const APP = (window.APP = window.APP || {});
  const pad2 = function (n) { return String(n).padStart(2, '0'); };

  /* ---------- tapes: speed and direction follow the scroll ---------- */
  APP.initTapes = function () {
    const sec = APP.watch(APP.$('.tapes'));
    APP.$$('.tape__track').forEach(function (track, k) {
      const dir = k % 2 ? 1 : -1;
      let x = 0, half = 0, boost = 0;
      function measure() { half = track.firstElementChild.offsetWidth; }
      measure();
      window.addEventListener('resize', measure);
      gsap.ticker.add(function (t, dtMs) {
        if (!sec._visible || !half || APP.reduced) return;
        const v = APP.velocity();
        boost = APP.lerp(boost, Math.min(Math.abs(v), 60), 0.08);
        const sign = APP.lenis && APP.lenis.direction === -1 ? -1 : 1;
        x += dir * sign * (50 + boost * 22) * Math.min(dtMs, 50) / 1000;
        x %= half;
        if (x > 0) x -= half;
        track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      });
    });
  };

  /* ---------- about: words light up, numbers count ---------- */
  APP.initAbout = function () {
    const lead = APP.$('[data-highlight]');
    if (lead && !APP.reduced) {
      const split = SplitText.create(lead, { type: 'words', wordsClass: 'w' });
      gsap.fromTo(split.words, { opacity: 0.13 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: lead, start: 'top 80%', end: 'bottom 45%', scrub: true },
      });
    }
    APP.$$('[data-count]').forEach(function (el) {
      const target = parseFloat(el.dataset.count) || 0;
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: function () {
          gsap.to(o, { v: target, duration: 2.2, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
        },
      });
    });
  };

  /* ---------- works: editorial grid, filter with Flip, EXIF on hover ---------- */
  APP.initWorks = function () {
    const items = APP.$$('.work');
    const btns = APP.$$('.filter');
    let current = '*';
    function pattern() {
      let k = 0;
      items.forEach(function (el) {
        el.classList.remove('p0', 'p1', 'p2', 'p3', 'p4');
        if (!el.hidden) el.classList.add('p' + (k++ % 5));
      });
    }
    pattern();

    function setFilter(f) {
      if (f === current) return;
      current = f;
      btns.forEach(function (b) {
        const on = b.dataset.filter === f;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      const grid = APP.$('.works__grid');
      const h0 = grid.offsetHeight;
      const state = Flip.getState(items);
      items.forEach(function (el) { el.hidden = !(f === '*' || el.dataset.genre === f); });
      pattern();
      const h1 = grid.offsetHeight;
      // children go absolute during the flip, so hold the grid height ourselves
      gsap.fromTo(grid, { height: h0 }, { height: h1, duration: 0.9, ease: 'power3.inOut', overwrite: true });
      Flip.from(state, {
        duration: 0.9, ease: 'power3.inOut', absolute: true, scale: false,
        onEnter: function (els) { return gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.7, delay: 0.3, ease: 'power3.out' }); },
        onLeave: function (els) { return gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.35, ease: 'power2.in' }); },
        onComplete: function () { gsap.set(grid, { clearProps: 'height' }); ScrollTrigger.refresh(); },
      });
    }
    APP.setWorksFilter = function (f) {
      const exists = btns.some(function (b) { return b.dataset.filter === f; });
      setFilter(exists ? f : '*');
    };
    btns.forEach(function (b) { b.addEventListener('click', function () { setFilter(b.dataset.filter); }); });

    items.forEach(function (el) {
      const media = el.querySelector('.work__media');
      const ex = el.querySelector('.work__exif');
      media.addEventListener('pointerenter', function () {
        gsap.to(ex, { duration: 0.9, scrambleText: { text: ex.dataset.exifText || ' ', chars: '0123456789/·.f', speed: 0.6 }, overwrite: true });
      });
      media.addEventListener('pointerleave', function () {
        gsap.to(ex, { duration: 0.35, scrambleText: { text: ' ', chars: '0123456789' }, overwrite: true });
      });
      media.addEventListener('click', function () {
        const vis = items.filter(function (i) { return !i.hidden; });
        const list = vis.map(function (i) {
          const w = window.SITE.works[+i.dataset.i];
          return { photo: w.photo, title: w.title, meta: w.genre + ' · ' + w.year + (w.exif ? ' · ' + w.exif : '') };
        });
        APP.lightbox.open(list, vis.indexOf(el), el.querySelector('img'));
      });
    });
  };

  /* ---------- series: two columns bend around the lens, centre row picks the photo ---------- */
  APP.initSeries = function () {
    const sec = APP.watch(APP.$('.series'));
    const L = APP.$$('.dw__row--l');
    const R = APP.$$('.dw__row--r');
    const imgs = APP.$$('.dw__img');
    const frame = APP.$('.dw__frame');
    const count = APP.$('.dw__count');
    const name = APP.$('.dw__name');
    const S = window.SITE.series;
    const xl = L.map(function (el) { return gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' }); });
    const xr = R.map(function (el) { return gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' }); });
    let tops = [], focus = -1, front = 0, z = 2;

    function measure() {
      tops = L.map(function (el) { const r = el.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2; });
    }
    measure();
    ScrollTrigger.addEventListener('refresh', measure);

    function show(i) {
      const s = S[i];
      count.textContent = pad2(i + 1) + ' / ' + pad2(S.length);
      gsap.to(name, { duration: 0.7, scrambleText: { text: s.title, chars: 'АБВГДЕЖЗИКЛМНОПРСТУФХЭЮЯ', speed: 0.7 }, overwrite: true });
      Photos.get(s.cover, 0.8, Math.round(frame.clientWidth * Math.min(2, window.devicePixelRatio || 1))).then(function (res) {
        if (focus !== i) return;
        const next = imgs[front ^ 1];
        next.src = res.url;
        next.style.zIndex = ++z;
        gsap.fromTo(next, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.25 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 0.9, ease: 'expo.out', overwrite: true });
        front ^= 1;
      });
    }

    gsap.ticker.add(function (time) {
      if (!sec._visible || !tops.length) return;
      const half = window.innerHeight / 2;
      const mid = window.scrollY + half;
      const mob = APP.mobile();
      const A = Math.min(window.innerWidth * 0.07, 120);
      let best = 1e9, bi = 0;
      for (let i = 0; i < L.length; i++) {
        const u = (tops[i] - mid) / half;
        const d = Math.abs(tops[i] - mid);
        if (d < best) { best = d; bi = i; }
        if (APP.reduced) continue;
        if (mob) {
          xl[i](Math.sin(u * Math.PI * 1.2 + time * 0.6) * A * 0.5);
        } else {
          const bend = (A / 2) * (1 - Math.cos(Math.PI * 1.6 * APP.clamp(u, -1.25, 1.25)));
          const drift = A * 0.08 * (1 + Math.sin(time * 1.3 + i * 0.9));
          xl[i](-(bend + drift));
          if (xr[i]) xr[i](bend + drift);
        }
      }
      if (bi !== focus) {
        if (focus >= 0) { L[focus].classList.remove('is-focus'); if (R[focus]) R[focus].classList.remove('is-focus'); }
        focus = bi;
        L[bi].classList.add('is-focus');
        if (R[bi]) R[bi].classList.add('is-focus');
        show(bi);
      }
    });

    function openSeries(i, fromImg) {
      const s = S[i];
      if (!s) return;
      const list = s.photos.map(function (p, k) {
        return { photo: p, title: s.title, meta: 'кадр ' + (k + 1) + ' из ' + s.photos.length };
      });
      APP.lightbox.open(list, 0, fromImg || (i === focus ? imgs[front] : null));
    }
    APP.openSeries = openSeries;
    L.forEach(function (el, i) { el.addEventListener('click', function () { openSeries(i); }); });
    frame.addEventListener('click', function () { openSeries(focus); });
  };

  /* ---------- film: pinned horizontal strip ---------- */
  APP.initFilm = function () {
    const sec = APP.$('.film');
    const track = APP.$('.film__track');
    const bar = APP.$('.film__bar span');
    const frames = APP.$$('.frame', track);
    const dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    const tween = gsap.to(track, {
      x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: {
        trigger: sec, start: 'top top', end: function () { return '+=' + Math.round(dist() * 0.75); },
        pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: function (self) { gsap.set(bar, { scaleX: self.progress }); },
      },
    });
    if (!APP.reduced) {
      frames.forEach(function (f) {
        const img = f.querySelector('img');
        gsap.fromTo(img, { xPercent: -6 }, {
          xPercent: 6, ease: 'none',
          scrollTrigger: { trigger: f, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      });
      const skew = frames.map(function (f) { return gsap.quickSetter(f, 'skewX', 'deg'); });
      let s = 0;
      gsap.ticker.add(function () {
        const v = tween.scrollTrigger ? tween.scrollTrigger.getVelocity() : 0;
        const target = APP.clamp(-v / 250, -8, 8);
        const next = s + (target - s) * 0.1;
        if (Math.abs(next - s) < 0.005 && Math.abs(next) < 0.01) return;
        s = Math.abs(next) < 0.01 ? 0 : next;
        skew.forEach(function (fn) { fn(s); });
      });
    }
    const list = window.SITE.film.map(function (p, i) { return { photo: p, title: 'Кадр ' + (i + 1), meta: 'Плёнка · ' + (i + 1) + 'A' }; });
    frames.forEach(function (f, i) {
      f.addEventListener('click', function () { APP.lightbox.open(list, i, f.querySelector('img')); });
    });
  };

  /* ---------- zoom: fly into the centre photo ---------- */
  APP.initZoom = function () {
    const sec = APP.$('.zoom');
    const grid = APP.$('.zoom__grid');
    const items = APP.$$('.zoom__item', grid);
    const center = APP.$('.zoom__item--c', grid);
    const shade = APP.$('.zoom__shade');
    const text = APP.$('.zoom__text');
    if (!center) return;
    gsap.set(grid, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
    const split = SplitText.create(text, { type: 'lines,chars', mask: 'lines' });
    const scaleTo = function () {
      return Math.max(window.innerWidth / center.offsetWidth, window.innerHeight / center.offsetHeight) * 1.01;
    };
    const others = items.filter(function (i) { return i !== center; });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: '+=230%', pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    tl.fromTo(grid, { scale: 1 }, { scale: scaleTo, ease: 'power2.in', duration: 1 }, 0)
      .fromTo(center.querySelector('img'), { scale: 1.4 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .to(center, { borderRadius: 0, ease: 'none', duration: 0.3 }, 0.7)
      .to(others, { opacity: 0, ease: 'none', duration: 0.25 }, 0.72)
      .to(shade, { opacity: 0.42, ease: 'none', duration: 0.3 }, 0.85)
      .from(split.chars, { yPercent: 120, ease: 'power3.out', duration: 0.3, stagger: 0.008 }, 0.95)
      .to({}, { duration: 0.4 });
    // the outer photos drift a little for depth
    others.forEach(function (el, i) {
      gsap.fromTo(el, { y: (i % 2 ? 30 : -30) }, {
        y: (i % 2 ? -30 : 30), ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top top', scrub: true },
      });
    });
  };

  /* ---------- services: sticky cards stack up ---------- */
  APP.initServices = function () {
    const cards = APP.$$('.scard');
    cards.forEach(function (card, i) {
      const media = card.querySelector('.scard__media img');
      if (!APP.reduced && media) {
        gsap.fromTo(media, { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 20%', scrub: true } });
      }
      const parts = APP.$$('.scard__top, .scard__title, .scard__text, .scard__list, .scard__btn', card);
      if (!APP.reduced) {
        gsap.from(parts, { y: 40, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: card, start: 'top 72%', once: true } });
      }
      if (i === cards.length - 1 || APP.reduced) return;
      const next = cards[i + 1];
      const st = {
        trigger: next, start: 'top bottom', scrub: true, invalidateOnRefresh: true,
        end: function () { return 'top ' + (window.innerHeight * 0.11 + (i + 1) * 26) + 'px'; },
      };
      gsap.to(card, { scale: 0.9 + i * 0.025, ease: 'none', scrollTrigger: st });
      gsap.to(card.querySelector('.scard__shade'), { opacity: 0.5, ease: 'none', scrollTrigger: Object.assign({}, st) });
    });
  };

  /* ---------- process: a red line draws through the steps ---------- */
  APP.initProcess = function () {
    const wrap = APP.$('.process__wrap');
    const svg = APP.$('.process__svg');
    const line = APP.$('.process__line');
    const ghost = APP.$('.process__ghost');
    const steps = APP.$$('.step', wrap);
    function build() {
      const w = wrap.getBoundingClientRect();
      const pts = steps.map(function (s) {
        const d = s.querySelector('.step__dot').getBoundingClientRect();
        return [d.left - w.left + d.width / 2, d.top - w.top + d.height / 2];
      });
      let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0])) {
          const my = (a[1] + b[1]) / 2;
          d += ' C' + a[0].toFixed(1) + ' ' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
        } else {
          // stay level past the step's text, then swing to the next dot
          const mx = a[0] + (b[0] - a[0]) * 0.8;
          d += ' C' + mx.toFixed(1) + ' ' + a[1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + b[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
        }
      }
      svg.setAttribute('viewBox', '0 0 ' + wrap.offsetWidth + ' ' + wrap.offsetHeight);
      line.setAttribute('d', d);
      ghost.setAttribute('d', d);
    }
    build();
    ScrollTrigger.addEventListener('refreshInit', build);
    const n = steps.length;
    gsap.fromTo(line, { drawSVG: '0%' }, {
      drawSVG: '100%', ease: 'none',
      scrollTrigger: {
        trigger: wrap, start: 'top 72%', end: 'bottom 62%', scrub: 0.6, invalidateOnRefresh: true,
        onUpdate: function (self) {
          steps.forEach(function (s, i) { s.classList.toggle('is-on', self.progress >= i / Math.max(1, n - 1) - 0.02); });
        },
      },
    });
    if (!APP.reduced) {
      steps.forEach(function (s) {
        gsap.from(APP.$$('.step__num, .step__title, .step__text', s), {
          y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08,
          scrollTrigger: { trigger: s, start: 'top 85%', once: true },
        });
      });
    }
  };

  /* ---------- trail: photos follow the pointer ---------- */
  APP.initTrail = function () {
    const area = APP.watch(APP.$('.trail__area'));
    const imgs = APP.$$('.trail__img', area);
    if (!imgs.length) return;
    if (!APP.fine) {
      const words = APP.$$('.trail__text span', area);
      if (words.length === 2) { words[0].textContent = 'Проведи'; words[1].textContent = 'пальцем'; }
    }
    let k = 0, z = 10, last = null, lastMove = -1e9;
    function spawn(x, y, dx, dy) {
      const el = imgs[k++ % imgs.length];
      el.style.zIndex = ++z;
      const w = el.offsetWidth, h = el.offsetHeight;
      gsap.killTweensOf(el);
      gsap.set(el, { x: x - w / 2, y: y - h / 2, rotation: gsap.utils.random(-14, 14), scale: 0.4, opacity: 0 });
      gsap.timeline()
        .to(el, { opacity: 1, scale: 1, x: '+=' + (dx * 0.4), y: '+=' + (dy * 0.4), duration: 0.45, ease: 'power3.out' })
        .to(el, { opacity: 0, scale: 0.25, y: '+=80', rotation: '+=' + gsap.utils.random(-25, 25), duration: 0.9, ease: 'power3.in' }, 0.6);
    }
    function at(x, y) {
      if (!last) { last = [x, y]; return; }
      const dx = x - last[0], dy = y - last[1];
      if (Math.hypot(dx, dy) > (APP.mobile() ? 55 : 85)) { spawn(x, y, dx, dy); last = [x, y]; }
    }
    area.addEventListener('pointermove', function (e) {
      const r = area.getBoundingClientRect();
      lastMove = performance.now();
      at(e.clientX - r.left, e.clientY - r.top);
    });
    area.addEventListener('pointerleave', function () { last = null; });
    gsap.ticker.add(function (time) {
      if (!area._visible || APP.reduced || performance.now() - lastMove < 2200) return;
      const w = area.clientWidth, h = area.clientHeight;
      at(w * (0.5 + 0.36 * Math.sin(time * 1.1)), h * (0.5 + 0.28 * Math.sin(time * 1.9 + 1)));
    });
    if (!APP.reduced) {
      gsap.from(APP.$$('.trail__text span', area), {
        yPercent: 60, opacity: 0, duration: 1.4, ease: 'power4.out', stagger: 0.12,
        scrollTrigger: { trigger: area, start: 'top 75%', once: true },
      });
    }
  };

  /* ---------- contact: letters get bolder near the cursor, live clock ---------- */
  APP.initContact = function () {
    const title = APP.watch(APP.$('.contact__title'));
    const split = SplitText.create(APP.$$('.contact__line', title), { type: 'chars', charsClass: 'char' });
    const chars = split.chars;
    if (!APP.reduced) {
      gsap.from(chars, {
        yPercent: 70, opacity: 0, duration: 1.3, ease: 'power4.out', stagger: 0.035,
        scrollTrigger: { trigger: title, start: 'top 85%', once: true },
      });
      const wts = chars.map(function () { return 300; });
      if (APP.fine) {
        let mx = -9999, my = -9999;
        window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
        gsap.ticker.add(function () {
          if (!title._visible) return;
          const rects = chars.map(function (c) { return c.getBoundingClientRect(); });
          for (let i = 0; i < chars.length; i++) {
            const r = rects[i];
            const d = Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2));
            const target = 250 + 650 * Math.max(0, 1 - d / 420);
            const w = wts[i] + (target - wts[i]) * 0.14;
            if (Math.abs(w - wts[i]) > 0.5 || Math.abs(target - w) > 0.5) {
              wts[i] = w;
              chars[i].style.fontWeight = Math.round(w);
            }
          }
        });
      } else {
        gsap.ticker.add(function (time) {
          if (!title._visible) return;
          chars.forEach(function (c, i) { c.style.fontWeight = Math.round(500 + 350 * Math.sin(time * 1.6 - i * 0.45)); });
        });
      }
    }
    const clock = APP.$('.clock__time');
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: window.SITE.timezone || 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    const tick = function () { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  };

  /* ---------- footer: giant surname fits the width and rises ---------- */
  APP.initFooter = function () {
    const big = APP.$('.footer__big');
    const word = big.firstElementChild;
    function fit() {
      big.style.fontSize = '100px';
      const w = word.offsetWidth || 1;
      big.style.fontSize = (100 * big.clientWidth * 0.97 / w).toFixed(2) + 'px';
    }
    fit();
    window.addEventListener('resize', fit);
    const split = SplitText.create(word, { type: 'chars', charsClass: 'char' });
    if (!APP.reduced) {
      gsap.from(split.chars, {
        yPercent: 100, duration: 1.4, ease: 'power4.out', stagger: 0.05,
        scrollTrigger: { trigger: big, start: 'top 98%', once: true },
      });
      split.chars.forEach(function (c) {
        c.addEventListener('pointerenter', function () {
          gsap.fromTo(c, { y: 0 }, { y: -0.12 * c.offsetHeight, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: true });
        });
      });
    }
    APP.$('.totop').addEventListener('click', function () { APP.scrollTo(0, { duration: 2.2 }); });
  };
})();
