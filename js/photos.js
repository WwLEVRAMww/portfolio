/* Photo slots.
   <img data-photo="07"> shows photos/07.(jpg|jpeg|png|webp) when that file exists.
   Otherwise it paints a soft "photographic" placeholder with the slot number,
   so every animation still has something to move. */
(function () {
  'use strict';

  const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'JPG'];
  const real = new Map(); // name -> Promise<info|null>
  const fake = new Map(); // name@ratio -> Promise<info>
  const queue = [];
  let pumping = false;
  let grain = null;

  // ---------- small helpers ----------
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(h1, h2, t) {
    const a = rgb(h1), b = rgb(h2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function blur(g, px) { try { g.filter = px > 0 ? 'blur(' + px.toFixed(1) + 'px)' : 'none'; } catch (e) { /* no canvas filters */ } }

  const PALETTES = [
    ['#101010', '#4a4a4a', '#cfcfcb', '#f4f4f0'], // b/w
    ['#1d120e', '#8a4128', '#e08a5c', '#f6dcc0'], // warm dusk
    ['#0e141c', '#3c5468', '#93a9b9', '#e2e8ec'], // cool
    ['#1f0805', '#a3291a', '#e2482f', '#f7c7b8'], // red
    ['#13160f', '#4d5a3e', '#9aa585', '#e4e6da'], // olive
    ['#211b14', '#7d6a50', '#c8b392', '#f2ebdf'], // sand
    ['#0b0b0b', '#2e2e2e', '#9b9b97', '#ebebe7'], // b/w, harder
  ];

  // ---------- compositions ----------
  function personPath(cx, cy, s, h) {
    // head + neck + shoulders, used for portraits
    // one closed outline: head, neck and shoulders without seams
    const hw = s * 0.145, hh = s * 0.19, neck = hw * 0.62, sh = cy + hh * 1.5;
    const p = new Path2D();
    p.moveTo(cx - neck, cy + hh * 0.72);
    p.bezierCurveTo(cx - hw * 1.12, cy + hh * 0.35, cx - hw * 1.08, cy - hh * 1.02, cx, cy - hh);
    p.bezierCurveTo(cx + hw * 1.08, cy - hh * 1.02, cx + hw * 1.12, cy + hh * 0.35, cx + neck, cy + hh * 0.72);
    p.lineTo(cx + neck * 1.05, sh - s * 0.03);
    p.bezierCurveTo(cx + s * 0.3, sh, cx + s * 0.44, sh + s * 0.07, cx + s * 0.52, h + 4);
    p.lineTo(cx - s * 0.52, h + 4);
    p.bezierCurveTo(cx - s * 0.44, sh + s * 0.07, cx - s * 0.3, sh, cx - neck * 1.05, sh - s * 0.03);
    p.closePath();
    return p;
  }

  function figurePath(fx, top, fh) {
    // tiny standing person for landscapes / architecture
    const p = new Path2D();
    const hr = fh * 0.08;
    p.arc(fx, top + hr, hr, 0, Math.PI * 2);
    p.moveTo(fx - hr * 1.3, top + hr * 2.3);
    p.lineTo(fx + hr * 1.3, top + hr * 2.3);
    p.lineTo(fx + hr * 1.0, top + fh * 0.58);
    p.lineTo(fx + hr * 0.8, top + fh);
    p.lineTo(fx - hr * 0.8, top + fh);
    p.lineTo(fx - hr * 1.0, top + fh * 0.58);
    p.closePath();
    return p;
  }

  function portrait(g, w, h, r, p) {
    const s = Math.min(w, h), L = Math.max(w, h);
    const cx = w * (0.5 + (r() - 0.5) * 0.34), cy = h * (0.4 + (r() - 0.5) * 0.06);
    const side = r() < 0.5 ? -1 : 1; // which side the light comes from
    const bg = g.createRadialGradient(cx + side * s * 0.25, cy - s * 0.1, s * 0.04, cx, cy, L * 0.85);
    bg.addColorStop(0, p[3]); bg.addColorStop(0.3, p[2]); bg.addColorStop(0.72, p[1]); bg.addColorStop(1, p[0]);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const body = personPath(cx, cy, s, h);
    // soft out-of-focus subject with a thin rim of light on one side
    g.save(); blur(g, s * 0.012); g.strokeStyle = rgba(p[3], 0.55); g.lineWidth = s * 0.014;
    g.translate(side * s * 0.008, -s * 0.004); g.stroke(body); g.restore();
    g.save(); blur(g, s * 0.007); g.fillStyle = p[0]; g.globalAlpha = 0.95; g.fill(body); g.restore();
    g.save(); g.clip(body);
    const fl = g.createRadialGradient(cx + side * s * 0.16, cy - s * 0.04, 0, cx + side * s * 0.16, cy - s * 0.04, s * 0.34);
    fl.addColorStop(0, rgba(p[2], 0.3)); fl.addColorStop(1, rgba(p[2], 0));
    g.fillStyle = fl; g.fillRect(0, 0, w, h);
    g.restore();
  }

  function bokeh(g, w, h, r, p) {
    const a = r() * Math.PI * 2, L = Math.max(w, h);
    const lg = g.createLinearGradient(w / 2 - Math.cos(a) * w / 2, h / 2 - Math.sin(a) * h / 2, w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2);
    lg.addColorStop(0, p[0]); lg.addColorStop(1, p[1]);
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'screen';
    for (let i = 0; i < 20; i++) {
      const x = r() * w, y = r() * h, rad = L * (0.025 + Math.pow(r(), 2) * 0.14), al = 0.07 + r() * 0.3;
      const col = r() < 0.6 ? p[2] : p[3];
      g.save(); blur(g, r() * 0.012 * L);
      const rg = g.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, rgba(col, al * 0.5)); rg.addColorStop(0.86, rgba(col, al * 0.8)); rg.addColorStop(1, rgba(col, al));
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.globalCompositeOperation = 'source-over';
  }

  function windowLight(g, w, h, r, p) {
    const L = Math.max(w, h);
    const lg = g.createLinearGradient(0, 0, w * 0.3, h);
    lg.addColorStop(0, p[1]); lg.addColorStop(1, p[0]);
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    const ox = w * (0.32 + r() * 0.36), oy = h * (0.3 + r() * 0.25);
    g.save(); g.translate(ox, oy); g.rotate(-0.35 + (r() - 0.5) * 0.4); blur(g, L * 0.007);
    const cols = 2 + Math.floor(r() * 2), rows = 2, pw = L * 0.15, ph = L * 0.21, gap = L * 0.022;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * (pw + gap) - cols * (pw + gap) / 2, y = j * (ph + gap) - rows * (ph + gap) / 2;
        g.save(); g.transform(1, 0, -0.32, 1, 0, 0);
        const pg = g.createLinearGradient(x, y, x + pw, y + ph);
        pg.addColorStop(0, rgba(p[3], 0.9)); pg.addColorStop(1, rgba(p[2], 0.6));
        g.fillStyle = pg; g.fillRect(x, y, pw, ph); g.restore();
      }
    }
    g.restore();
    // leaf shadows across the light
    g.save(); g.globalCompositeOperation = 'multiply'; blur(g, L * 0.012);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = rgba(p[0], 0.35 + r() * 0.3);
      g.beginPath();
      g.ellipse(ox + (r() - 0.5) * L * 0.5, oy + (r() - 0.5) * L * 0.45, L * (0.02 + r() * 0.03), L * (0.06 + r() * 0.06), r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.save(); g.globalCompositeOperation = 'screen';
    const gl = g.createRadialGradient(ox, oy, 0, ox, oy, L * 0.6);
    gl.addColorStop(0, rgba(p[2], 0.28)); gl.addColorStop(1, rgba(p[2], 0));
    g.fillStyle = gl; g.fillRect(0, 0, w, h); g.restore();
  }

  function horizon(g, w, h, r, p) {
    const L = Math.max(w, h), s = Math.min(w, h);
    const hy = h * (0.56 + (r() - 0.5) * 0.18);
    const sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, p[1]); sky.addColorStop(1, p[3]);
    g.fillStyle = sky; g.fillRect(0, 0, w, hy + 2);
    const sx = w * (0.25 + r() * 0.5), sr = s * 0.07, sy = hy - sr * (0.6 + r());
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, L * 0.55);
    glow.addColorStop(0, rgba(p[3], 0.95)); glow.addColorStop(0.25, rgba(p[2], 0.45)); glow.addColorStop(1, rgba(p[2], 0));
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.save(); blur(g, s * 0.006); g.fillStyle = rgba(p[3], 0.95); g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill(); g.restore();
    const gr = g.createLinearGradient(0, hy, 0, h);
    gr.addColorStop(0, p[1]); gr.addColorStop(1, p[0]);
    g.fillStyle = gr; g.fillRect(0, hy, w, h - hy);
    g.save(); blur(g, s * 0.012);
    const ref = g.createLinearGradient(0, hy, 0, h);
    ref.addColorStop(0, rgba(p[3], 0.55)); ref.addColorStop(1, rgba(p[3], 0));
    g.fillStyle = ref; g.fillRect(sx - sr * 1.3, hy, sr * 2.6, h - hy);
    g.restore();
    g.fillStyle = rgba(p[3], 0.18);
    for (let i = 0; i < 14; i++) {
      const y = hy + Math.pow(r(), 1.6) * (h - hy);
      g.fillRect(sx - sr * (1 + r() * 4), y, sr * (2 + r() * 8), Math.max(1, s * 0.003));
    }
    g.save(); blur(g, s * 0.004); g.fillStyle = rgba(p[3], 0.5); g.fillRect(0, hy - 1, w, Math.max(1.5, s * 0.004)); g.restore();
    if (r() < 0.75) {
      const n = r() < 0.5 ? 1 : 2, fh = s * 0.11, fx = w * (r() < 0.5 ? 0.33 : 0.67);
      g.fillStyle = p[0];
      for (let i = 0; i < n; i++) g.fill(figurePath(fx + i * fh * 0.28, hy - fh * 0.92, fh * (1 - i * 0.08)));
    }
  }

  function architecture(g, w, h, r, p) {
    const s = Math.min(w, h);
    const wall = g.createLinearGradient(0, 0, w, h);
    wall.addColorStop(0, p[3]); wall.addColorStop(1, p[2]);
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    // hard diagonal shadow
    g.save(); blur(g, s * 0.003); g.fillStyle = rgba(p[1], 0.78);
    g.beginPath(); g.moveTo(0, h * (0.15 + r() * 0.2)); g.lineTo(w * (0.55 + r() * 0.3), 0); g.lineTo(w * 0.05, 0); g.lineTo(0, 0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.72); g.lineTo(w, h * (0.48 + r() * 0.2)); g.lineTo(w, h); g.closePath(); g.fill();
    g.restore();
    // arch doorway
    const aw = w * (0.26 + r() * 0.12), ax = w * (0.18 + r() * 0.5), top = h * (0.22 + r() * 0.08), bottom = h * 0.86;
    const arch = new Path2D();
    arch.moveTo(ax, bottom); arch.lineTo(ax, top + aw / 2); arch.arc(ax + aw / 2, top + aw / 2, aw / 2, Math.PI, 0); arch.lineTo(ax + aw, bottom); arch.closePath();
    const inside = g.createLinearGradient(0, top, 0, bottom);
    inside.addColorStop(0, p[0]); inside.addColorStop(1, p[1]);
    g.fillStyle = inside; g.fill(arch);
    g.save(); g.clip(arch); blur(g, s * 0.01);
    g.fillStyle = rgba(p[3], 0.55);
    g.beginPath(); g.moveTo(ax, bottom); g.lineTo(ax + aw * 0.35, bottom - h * 0.12); g.lineTo(ax + aw, bottom - h * 0.12); g.lineTo(ax + aw, bottom); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = p[0];
    g.fill(figurePath(ax + aw * (0.35 + r() * 0.3), bottom - s * 0.2, s * 0.2));
  }

  function fabric(g, w, h, r, p) {
    const s = Math.min(w, h);
    const n = 48, f = 2.5 + r() * 4, ph = r() * 6;
    g.save(); blur(g, w * 0.012);
    for (let i = 0; i < n; i++) {
      const t = 0.5 + 0.5 * Math.sin((i / n) * Math.PI * 2 * f + ph) * (0.7 + 0.3 * Math.sin(i * 0.7));
      g.fillStyle = mix(p[1], p[3], Math.max(0, Math.min(1, t)) * 0.85);
      g.fillRect((i / n) * w - 2, -10, w / n + 4, h + 20);
    }
    g.restore();
    const sh = g.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, rgba(p[0], 0)); sh.addColorStop(1, rgba(p[0], 0.55));
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    // standing figure, slightly off-centre
    const fx = w * (r() < 0.5 ? 0.38 : 0.62), top = h * 0.14, fh = h * 0.8, hr = s * 0.06;
    const fig = new Path2D();
    fig.ellipse(fx, top + hr, hr * 0.85, hr, 0, 0, Math.PI * 2);
    fig.moveTo(fx - hr * 0.35, top + hr * 1.8);
    fig.lineTo(fx - hr * 1.6, top + hr * 2.6);
    fig.lineTo(fx - hr * 1.1, top + fh * 0.5);
    fig.lineTo(fx - hr * 2.4, top + fh);
    fig.lineTo(fx + hr * 2.4, top + fh);
    fig.lineTo(fx + hr * 1.1, top + fh * 0.5);
    fig.lineTo(fx + hr * 1.6, top + hr * 2.6);
    fig.lineTo(fx + hr * 0.35, top + hr * 1.8);
    fig.closePath();
    g.save(); blur(g, s * 0.03); g.globalAlpha = 0.35; g.fillStyle = p[0];
    g.beginPath(); g.ellipse(fx + hr * 2, top + fh, hr * 4, hr * 0.7, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.save(); blur(g, s * 0.003); g.fillStyle = p[0]; g.globalAlpha = 0.92; g.fill(fig); g.restore();
  }

  const KINDS = [portrait, bokeh, windowLight, horizon, architecture, fabric];

  function makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 200;
    const g = c.getContext('2d');
    const d = g.createImageData(200, 200);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  function labelFor(name) {
    if (name === 'me') return 'ПОРТРЕТ · me';
    return 'ФОТО ' + name;
  }

  function paint(name, ratio) {
    const LONG = 820;
    const w = Math.round(ratio >= 1 ? LONG : LONG * ratio);
    const h = Math.round(ratio >= 1 ? LONG / ratio : LONG);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const seed = hash(name);
    const r = rng(seed);
    const pal = PALETTES[hash(name + '#pal') % PALETTES.length];
    const kind = name === 'me' ? portrait : KINDS[seed % KINDS.length];
    kind(g, w, h, r, pal);
    blur(g, 0);
    // light leak
    if (r() < 0.3) {
      const lx = r() < 0.5 ? 0 : w, ly = r() * h;
      const lk = g.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * 0.6);
      lk.addColorStop(0, 'rgba(255,120,60,0.45)'); lk.addColorStop(1, 'rgba(255,120,60,0)');
      g.globalCompositeOperation = 'screen'; g.fillStyle = lk; g.fillRect(0, 0, w, h);
    }
    // vignette
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // film grain
    if (!grain) grain = makeGrain();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.22;
    g.fillStyle = g.createPattern(grain, 'repeat');
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // slot label
    const fs = Math.max(11, Math.round(Math.min(w, h) * 0.034));
    g.font = '500 ' + fs + 'px "JetBrains Mono", Consolas, monospace';
    g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = fs * 0.6;
    g.fillStyle = 'rgba(255,255,255,0.78)';
    g.fillText(labelFor(name), Math.round(fs * 1.3), Math.round(h - fs * 1.3));
    g.shadowBlur = 0;
    return new Promise(function (ok) {
      c.toBlob(function (blob) {
        ok({ url: blob ? URL.createObjectURL(blob) : c.toDataURL('image/jpeg', 0.84), w: w, h: h, real: false });
      }, 'image/jpeg', 0.84);
    });
  }

  function pump() {
    if (pumping) return;
    pumping = true;
    const step = function () {
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 12) queue.shift()();
      if (queue.length) setTimeout(step, 0); else pumping = false;
    };
    setTimeout(step, 0);
  }

  // ---------- real files ----------
  function candidates(name) {
    if (/[\/.]/.test(name)) return [name];
    return EXTS.map(function (e) { return 'photos/' + name + '.' + e; });
  }
  function load(url) {
    return new Promise(function (ok, fail) {
      const im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = fail;
      im.src = url;
    });
  }
  // all extensions are tried at once; the first one in EXTS order that loads wins
  function findReal(name) {
    if (!real.has(name)) {
      const tries = candidates(name).map(function (url) {
        return load(url).then(function (im) { return { url: url, w: im.naturalWidth, h: im.naturalHeight, real: true }; }, function () { return null; });
      });
      real.set(name, Promise.all(tries).then(function (res) {
        for (let i = 0; i < res.length; i++) if (res[i]) return res[i];
        return null;
      }));
    }
    return real.get(name);
  }

  function bucket(ratio) { return Math.round(Math.max(0.3, Math.min(3.5, ratio || 0.8)) * 20) / 20; }

  function defaultRatio(name) {
    if (name === 'me') return 0.8;
    return [0.8, 0.75, 1.5, 0.8, 1.333, 0.667][hash(name + '#r') % 6];
  }

  // Google Drive photos ("drive:<fileId>"): served resized by Google, size picked per slot.
  const known = {};
  const WIDTHS = [400, 700, 1000, 1400, 2000, 2600];
  function register(ref, info) { known[ref] = info; }
  function driveUrl(ref, width) {
    const want = Math.max(1, width || 1400);
    let w = WIDTHS[WIDTHS.length - 1];
    for (let i = 0; i < WIDTHS.length; i++) { if (WIDTHS[i] >= want) { w = WIDTHS[i]; break; } }
    return 'https://lh3.googleusercontent.com/d/' + ref.slice(6) + '=w' + w;
  }

  // Public: resolve a photo name to an image URL. width = rendered pixels wanted (Drive only).
  function get(name, ratio, width) {
    name = String(name);
    if (name.indexOf('drive:') === 0) {
      const k = known[name] || { w: 4, h: 5 };
      return Promise.resolve({ url: driveUrl(name, width), w: k.w, h: k.h, real: true });
    }
    return findReal(name).then(function (found) {
      if (found) return found;
      const rb = bucket(ratio || defaultRatio(name));
      const key = name + '@' + rb;
      if (!fake.has(key)) {
        fake.set(key, new Promise(function (ok) {
          queue.push(function () { paint(name, rb).then(ok); });
          pump();
        }));
      }
      return fake.get(key);
    });
  }

  function boxRatio(img) {
    const own = img.clientWidth && img.clientHeight ? img.clientWidth / img.clientHeight : 0;
    if (own) return own;
    const p = img.parentElement;
    return p && p.clientWidth && p.clientHeight ? p.clientWidth / p.clientHeight : 0;
  }

  function boxWidth(img) {
    const own = img.clientWidth || (img.parentElement && img.parentElement.clientWidth) || 600;
    return Math.round(own * Math.min(2, window.devicePixelRatio || 1));
  }

  function fill(img) {
    const name = img.dataset.photo;
    if (!name) return Promise.resolve();
    img.dataset.filled = name;
    const ratio = parseFloat(img.dataset.ratio) || boxRatio(img) || defaultRatio(name);
    return get(name, ratio, boxWidth(img)).then(function (res) {
      if (img.dataset.photo !== name) return;
      img.src = res.url;
      img.dataset.real = res.real ? '1' : '0';
      img.dataset.w = res.w; img.dataset.h = res.h;
      if (!img.getAttribute('alt')) img.setAttribute('alt', res.real ? '' : labelFor(name));
      const done = function () { img.classList.add('is-ready'); };
      if (img.complete) done(); else img.addEventListener('load', done, { once: true });
    });
  }

  function fillAll(root) {
    const imgs = Array.prototype.slice.call((root || document).querySelectorAll('img[data-photo]'));
    return Promise.all(imgs.map(fill));
  }

  // Load images only when they come near the screen (real photos are heavy).
  let io = null;
  function fillLazy(root) {
    const imgs = Array.prototype.slice.call((root || document).querySelectorAll('img[data-photo]:not([data-filled])'));
    if (!('IntersectionObserver' in window)) return fillAll(root);
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          fill(e.target);
        });
      }, { rootMargin: '150% 150% 150% 150%' });
    }
    imgs.forEach(function (img) { io.observe(img); });
    return Promise.resolve();
  }

  window.Photos = { get: get, fill: fill, fillAll: fillAll, fillLazy: fillLazy, register: register, label: labelFor, defaultRatio: defaultRatio };
})();
