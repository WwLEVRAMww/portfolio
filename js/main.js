/* Boot order: start the loader, fetch the photos from Google Drive, build the page,
   then wire every animation. */
(function () {
  'use strict';
  const APP = window.APP;

  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // one broken effect must never block the rest of the page
  function safe(name, fn) {
    try { fn(); } catch (e) {
      console.error('[portfolio] ' + name + ':', e);
      document.documentElement.setAttribute('data-error', name + ': ' + (e && e.message));
    }
  }
  function run(names) { names.forEach(function (n) { safe(n, function () { APP[n](document); }); }); }

  function initScrollFx() {
    // pinned sections first, so later triggers measure with their spacing
    run([
      'initFilm', 'initZoom', 'initHeadings', 'initImages', 'initSkew', 'initTapes', 'initAbout',
      'initWorks', 'initSeries', 'initServices', 'initProcess', 'initTrail', 'initContact',
      'initFooter', 'initTheme', 'initHud', 'initNav', 'initMagnetic',
    ]);
    safe('refresh', function () { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
  }

  function decoded(root) {
    return Promise.all(Array.prototype.map.call(root.querySelectorAll('img[data-photo]'), function (img) {
      if (img.complete && img.naturalWidth) return null;
      return new Promise(function (ok) { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', ok, { once: true }); });
    }));
  }

  function boot() {
    const S = window.SITE;
    run(['initScroll', 'initGrain', 'initCursor']);

    // photos: Google Drive if configured, otherwise photos/01..24 or placeholders
    const content = Promise.race([APP.loadDrive(S), wait(9000).then(function () { return null; })])
      .catch(function (e) { console.warn('[portfolio] Google Drive:', e); return null; })
      .then(function (data) {
        safe('photos', function () { APP.applyDrive(S, data || APP.localData()); });
        if (!data) S.fromDrive = false;
      });

    const shots = content.then(function () {
      return (S.loaderShots || ['01', '02', '03']).map(function (r) { return Photos.get(r, 0.68, 900); });
    });

    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const ready = content.then(function () {
      safe('render', function () { APP.render(); });
      run(['initRoll', 'initDrum', 'initBlock', 'initWheel', 'initHeroMotion', 'initMenu', 'initLightbox']);
      const hero = APP.$('.hero');
      const heroPhotos = Photos.fillAll(hero).then(function () { return decoded(hero); });
      Photos.fillLazy(document);
      return Promise.race([Promise.all([fonts, heroPhotos]), wait(7000)]);
    }).catch(function () {}).then(function () { safe('scroll effects', initScrollFx); });

    function start() {
      document.body.classList.remove('is-loading');
      safe('hero intro', function () { APP.heroIntro(); });
      if (APP.lenis) APP.lenis.start();
      ScrollTrigger.refresh();
    }
    APP.runLoader(shots, ready).then(start, function (e) {
      console.error('[portfolio] loader:', e);
      const l = APP.$('.loader');
      if (l) l.remove();
      start();
    });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
