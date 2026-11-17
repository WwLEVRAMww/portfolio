/* Photo viewer: the clicked photo flies from its place to the centre. */
(function () {
  'use strict';
  const APP = (window.APP = window.APP || {});
  const pad2 = function (n) { return String(n).padStart(2, '0'); };

  APP.initLightbox = function () {
    const lb = APP.$('.lb');
    const bg = APP.$('.lb__bg', lb);
    const frame = APP.$('.lb__frame', lb);
    const img = APP.$('.lb__img', lb);
    const top = APP.$('.lb__top', lb);
    const bottom = APP.$('.lb__bottom', lb);
    const count = APP.$('.lb__count', lb);
    const title = APP.$('.lb__title', lb);
    const meta = APP.$('.lb__meta', lb);
    const thumbs = APP.$('.lb__thumbs', lb);
    let list = [], idx = 0, startIdx = 0, box = null, isOpen = false, busy = false;

    function fit(w, h) {
      const mob = APP.mobile();
      const maxW = window.innerWidth * (mob ? 0.92 : 0.8);
      const maxH = window.innerHeight * (mob ? 0.62 : 0.72);
      const s = Math.min(maxW / w, maxH / h);
      const W = w * s, H = h * s;
      return { left: (window.innerWidth - W) / 2, top: (window.innerHeight - H) / 2 - (mob ? 24 : 12), width: W, height: H };
    }
    function onScreen(el) {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
    }
    function holder(el) {
      return el ? (el.closest('.media, .frame__media, .dw__frame, .wcard, .scard__media') || el) : null;
    }
    function setText() {
      const it = list[idx];
      count.textContent = pad2(idx + 1) + ' / ' + pad2(list.length);
      title.textContent = it.title || '';
      meta.textContent = it.meta || '';
      APP.$$('.lb__thumb', thumbs).forEach(function (b, i) { b.classList.toggle('is-active', i === idx); });
    }
    function buildThumbs() {
      thumbs.innerHTML = list.map(function (it, i) {
        return '<button class="lb__thumb" type="button" aria-label="Фото ' + (i + 1) + '"><img alt=""></button>';
      }).join('');
      APP.$$('.lb__thumb', thumbs).forEach(function (b, i) {
        Photos.get(list[i].photo, 0.75, 120).then(function (r) { b.firstElementChild.src = r.url; });
        b.addEventListener('click', function () { if (i !== idx) go(i - idx); });
      });
    }
    function load(res) {
      img.src = res.url;
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    }
    // big enough for the screen, never the multi-megabyte original
    function bigWidth() { return Math.min(2600, Math.round(window.innerWidth * Math.min(2, window.devicePixelRatio || 1) * 0.8)); }

    function open(items, index, fromImg) {
      if (isOpen || !items || !items.length) return;
      list = items;
      idx = startIdx = Math.max(0, Math.min(items.length - 1, index || 0));
      box = holder(fromImg);
      isOpen = true; busy = true;
      const ratio = fromImg && fromImg.dataset.real !== '1' && fromImg.dataset.w ? (+fromImg.dataset.w / +fromImg.dataset.h) : null;
      Photos.get(list[idx].photo, ratio, bigWidth()).then(load).then(function () {
        return Photos.get(list[idx].photo, ratio, bigWidth());
      }).then(function (res) {
        lb.classList.add('is-open');
        lb.setAttribute('aria-hidden', 'false');
        APP.lock(true);
        buildThumbs();
        setText();
        const t = fit(res.w, res.h);
        gsap.to(bg, { opacity: 1, duration: 0.7, ease: 'power2.out' });
        if (box && onScreen(box) && !APP.reduced) {
          const r = box.getBoundingClientRect();
          gsap.fromTo(frame, { left: r.left, top: r.top, width: r.width, height: r.height, borderRadius: 14, opacity: 1, scale: 1 },
            Object.assign({ borderRadius: 4, duration: 1.05, ease: 'expo.inOut' }, t));
          box.style.visibility = 'hidden';
        } else {
          box = null;
          gsap.fromTo(frame, Object.assign({ opacity: 0, scale: 0.94, borderRadius: 4 }, t), { opacity: 1, scale: 1, duration: 0.7, ease: 'power3.out' });
        }
        gsap.fromTo([top, bottom], { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.55 });
        gsap.fromTo(APP.$$('.lb__thumb', thumbs), { y: 24, opacity: 0 }, {
          y: 0, opacity: function (i) { return i === idx ? 1 : 0.35; },
          stagger: 0.03, duration: 0.6, delay: 0.6, ease: 'power3.out', clearProps: 'opacity,transform',
        });
        setTimeout(function () { busy = false; }, 950);
        if (APP.refreshCursor) APP.refreshCursor();
      });
    }

    function go(d) {
      if (!isOpen || busy || list.length < 2) return;
      busy = true;
      const n = (idx + d + list.length) % list.length;
      const dir = d > 0 ? 1 : -1;
      Photos.get(list[n].photo, null, bigWidth()).then(function (res) {
        gsap.to(img, {
          xPercent: -14 * dir, opacity: 0, duration: 0.35, ease: 'power2.in',
          onComplete: function () {
            idx = n;
            setText();
            load(res).then(function () {
              gsap.set(img, { xPercent: 14 * dir });
              gsap.to(frame, Object.assign({ duration: 0.6, ease: 'expo.inOut' }, fit(res.w, res.h)));
              gsap.to(img, { xPercent: 0, opacity: 1, duration: 0.7, delay: 0.1, ease: 'expo.out', onComplete: function () { busy = false; } });
            });
          },
        });
      });
    }

    function close() {
      if (!isOpen || busy) return;
      busy = true;
      gsap.to([top, bottom], { opacity: 0, duration: 0.25 });
      function done() {
        lb.classList.remove('is-open');
        lb.setAttribute('aria-hidden', 'true');
        if (box) box.style.visibility = '';
        gsap.set(frame, { clearProps: 'all' });
        gsap.set(img, { clearProps: 'all' });
        APP.lock(false);
        isOpen = false; busy = false;
      }
      if (box && idx === startIdx && onScreen(box)) {
        const r = box.getBoundingClientRect();
        gsap.to(frame, { left: r.left, top: r.top, width: r.width, height: r.height, borderRadius: 14, duration: 0.9, ease: 'expo.inOut', onComplete: done });
        gsap.to(bg, { opacity: 0, duration: 0.7, delay: 0.2 });
      } else {
        if (box) box.style.visibility = '';
        box = null;
        gsap.to(frame, { opacity: 0, scale: 0.94, duration: 0.45, ease: 'power2.in' });
        gsap.to(bg, { opacity: 0, duration: 0.55, onComplete: done });
      }
    }

    APP.$('.lb__close', lb).addEventListener('click', close);
    APP.$('.lb__prev', lb).addEventListener('click', function () { go(-1); });
    APP.$('.lb__next', lb).addEventListener('click', function () { go(1); });
    bg.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    });
    let sx = null;
    frame.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    frame.addEventListener('pointerup', function (e) {
      if (sx == null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    });

    APP.lightbox = { open: open, close: close, go: go };
  };
})();
