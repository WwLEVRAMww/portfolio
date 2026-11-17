/* Photos from Google Drive.
   The site reads the Drive folder named in SITE.drive: every subfolder is one series,
   folders starting with "_" are skipped (the first image in "_assets" is the "me" photo).
   Photo order and covers come from packs-config.json, which the /edit page maintains. */
(function () {
  'use strict';
  const APP = (window.APP = window.APP || {});
  const FIELDS = 'files(id,name,mimeType,imageMediaMetadata(width,height,rotation,exposureTime,aperture,focalLength,isoSpeed,cameraModel))';

  function list(cfg, q, byName) {
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) +
      '&key=' + encodeURIComponent(cfg.apiKey) + '&fields=' + encodeURIComponent(FIELDS) +
      '&pageSize=200' + (byName ? '&orderBy=name' : '');
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Drive API ' + r.status);
      return r.json();
    }).then(function (j) { return j.files || []; });
  }

  function fmtExif(m) {
    const parts = [];
    if (m.focalLength) parts.push(Math.round(m.focalLength) + ' мм');
    if (m.aperture) parts.push('f/' + (Math.round(m.aperture * 10) / 10));
    if (m.exposureTime) parts.push(m.exposureTime < 1 ? '1/' + Math.round(1 / m.exposureTime) : m.exposureTime + ' с');
    if (m.isoSpeed) parts.push('ISO ' + m.isoSpeed);
    return parts.join(' · ');
  }

  function photoOf(f) {
    const m = f.imageMediaMetadata || {};
    let w = m.width || 0, h = m.height || 0;
    if (m.rotation === 1 || m.rotation === 3) { const t = w; w = h; h = t; }
    const exif = fmtExif(m) || (w && h ? w + ' × ' + h + ' px' : '');
    const ref = 'drive:' + f.id;
    if (window.Photos) Photos.register(ref, { w: w || 4, h: h || 5, camera: m.cameraModel || '' });
    return { ref: ref, id: f.id, w: w, h: h, exif: exif };
  }

  function arrange(files, pk) {
    if (!pk || !pk.photoOrder || !pk.photoOrder.length) return files;
    const byId = {};
    files.forEach(function (f) { byId[f.id] = f; });
    const ordered = pk.photoOrder.filter(function (id) { return byId[id]; }).map(function (id) { return byId[id]; });
    const rest = files.filter(function (f) { return pk.photoOrder.indexOf(f.id) < 0; });
    return ordered.concat(rest);
  }

  APP.loadDrive = function (S) {
    const cfg = S.drive;
    if (!cfg || !cfg.apiKey || !cfg.folderId) return Promise.resolve(null);
    const configReq = fetch('packs-config.json?' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    const foldersReq = list(cfg, "'" + cfg.folderId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false");
    return Promise.all([foldersReq, configReq]).then(function (res) {
      const folders = res[0], pcfg = res[1];
      const conf = (pcfg && pcfg.packs) || {};
      const assets = folders.filter(function (f) { return f.name === (cfg.assetsFolder || '_assets'); })[0];
      // packs in the editor's order first, then any new folders
      const keyOrder = Object.keys(conf);
      const packs = folders.filter(function (f) { return f.name.charAt(0) !== '_'; }).sort(function (a, b) {
        const ia = keyOrder.indexOf(a.id), ib = keyOrder.indexOf(b.id);
        return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
      });
      const imageQ = function (id) { return "'" + id + "' in parents and mimeType contains 'image/' and trashed=false"; };
      return Promise.all([
        Promise.all(packs.map(function (f) { return list(cfg, imageQ(f.id), true); })),
        assets ? list(cfg, imageQ(assets.id), true) : Promise.resolve([]),
        packs.length ? Promise.resolve([]) : list(cfg, imageQ(cfg.folderId), true),
      ]).then(function (lists) {
        const out = [];
        packs.forEach(function (f, i) {
          const files = arrange(lists[0][i], conf[f.id]);
          if (!files.length) return;
          const pk = conf[f.id];
          const coverFile = (pk && pk.coverId && files.filter(function (x) { return x.id === pk.coverId; })[0]) ||
            files.filter(function (x) { return /^cover/i.test(x.name); })[0] || files[0];
          out.push({ id: f.id, name: f.name, photos: files.map(photoOf), cover: photoOf(coverFile) });
        });
        if (!out.length && lists[2].length) {
          const files = arrange(lists[2], conf[cfg.folderId]);
          out.push({ id: cfg.folderId, name: 'Портфолио', photos: files.map(photoOf), cover: photoOf(files[0]) });
        }
        if (!out.length) return null;
        return { packs: out, me: lists[1].length ? photoOf(lists[1][0]) : null };
      });
    });
  };

  // Without Drive: one series from photos/01..24 (or numbered placeholders).
  APP.localData = function () {
    const photos = [];
    for (let i = 1; i <= 24; i++) {
      const n = String(i).padStart(2, '0');
      photos.push({ ref: n, id: n, w: 0, h: 0, exif: '' });
    }
    return { packs: [{ id: 'local', name: 'Портфолио', photos: photos, cover: photos[0] }], me: { ref: 'me', id: 'me', w: 0, h: 0, exif: '' } };
  };

  // Spread the Drive photos over every part of the page.
  APP.applyDrive = function (S, data) {
    const packs = data.packs;
    const total = packs.reduce(function (n, p) { return n + p.photos.length; }, 0);
    // round-robin pool: every pack's cover first, then the next photo of each pack, ...
    const pool = [];
    const seen = {};
    const push = function (ph, pack, k) { if (!seen[ph.id]) { seen[ph.id] = 1; pool.push({ ph: ph, pack: pack, k: k }); } };
    packs.forEach(function (p) { push(p.cover, p, p.photos.indexOf(p.photos.filter(function (x) { return x.id === p.cover.id; })[0])); });
    for (let k = 0; ; k++) {
      let any = false;
      packs.forEach(function (p) { if (k < p.photos.length) { any = true; push(p.photos[k], p, k); } });
      if (!any) break;
    }
    const at = function (i) { return pool[i % pool.length]; };
    const portrait = function (x) { return x.ph.h >= x.ph.w; };
    const landscape = pool.filter(function (x) { return !portrait(x); });

    S.genres = packs.map(function (p) { return p.name; }).filter(function (v, i, a) { return a.indexOf(v) === i; });

    S.works = pool.slice(0, Math.min(10, pool.length)).map(function (x) {
      return { photo: x.ph.ref, title: x.pack.name, genre: x.pack.name, meta: 'кадр ' + (x.k + 1) + ' из ' + x.pack.photos.length, exif: x.ph.exif };
    });

    S.series = packs.map(function (p) {
      return { title: p.name, genre: p.photos.length + ' фото', year: '', cover: p.cover.ref, photos: p.photos.map(function (x) { return x.ref; }) };
    });

    const rest = pool.slice(S.works.length);
    const filmSrc = (rest.length >= 8 ? rest : pool).slice(0, 16);
    S.film = filmSrc.map(function (x) { return x.ph.ref; });
    S.filmRatios = filmSrc.map(function (x) { return x.ph.w && x.ph.h ? x.ph.w / x.ph.h : 1.5; });

    // zoom: the centre photo fills the screen, so prefer a horizontal one there
    const centre = landscape[0] || pool[0];
    const others = pool.filter(function (x) { return x !== centre; });
    const zoom = [];
    for (let i = 0; i < 9; i++) zoom.push(i === 4 ? centre : others[(i < 4 ? i : i - 1) % others.length]);
    S.zoom = zoom.map(function (x) { return x.ph.ref; });

    S.trail = pool.slice(0, 14).map(function (x) { return x.ph.ref; });
    S.loaderShots = packs.map(function (p) { return p.cover.ref; });
    S.menuPhotos = [0, 1, 2, 3, 4, 5].map(function (i) { return at(i * 2 + 1).ph.ref; });
    (S.services || []).forEach(function (s, i) { s.photo = at(i + 3).ph.ref; });

    if (data.me) S.about.photo = data.me.ref;
    else S.about.photo = pool[0].ph.ref;

    // wheel: the design cards from content.js, with the series covers and the "me" photo between them
    const design = (S.wheelCards || []).slice();
    const photoCards = [{ type: 'photo', photo: S.about.photo, label: 'Это я', link: '#about' }];
    packs.forEach(function (p, i) { photoCards.push({ type: 'photo', photo: p.cover.ref, label: p.name, series: i }); });
    let extra = 0;
    while (photoCards.length + design.length < 12 && extra < pool.length) {
      const x = pool[(packs.length + extra++) % pool.length];
      photoCards.push({ type: 'photo', photo: x.ph.ref, label: x.pack.name, series: packs.indexOf(x.pack) });
    }
    // design cards sit at fixed places around the circle, photos fill the rest
    const slots = [1, 4, 6, 9, 11];
    const wheel = [];
    for (let i = 0; i < 12 && (photoCards.length || design.length); i++) {
      const wantDesign = slots.indexOf(i) >= 0;
      if (wantDesign && design.length) wheel.push(design.shift());
      else if (photoCards.length) wheel.push(photoCards.shift());
      else wheel.push(design.shift());
    }
    S.wheel = wheel;

    S.stats = [
      { value: packs.length, label: packs.length === 1 ? 'серия на сайте' : 'серий на сайте' },
      { value: total, label: 'кадров в портфолио' },
      { value: S.readyDays || 10, prefix: 'до ', label: 'дней — готовые фото' },
    ];
    S.fromDrive = true;
  };
})();
