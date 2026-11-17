/* Builds the repeated parts of the page from window.SITE (js/content.js). */
(function () {
  'use strict';
  const APP = (window.APP = window.APP || {});

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  APP.esc = esc;
  const pad2 = function (n) { return String(n).padStart(2, '0'); };

  function pick(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  const tpl = {
    wheel: function (S) {
      const n = S.wheel.length;
      return S.wheel.map(function (c, i) {
        const num = '<span class="wcard__num">' + pad2(i + 1) + '/' + pad2(n) + '</span>';
        const tri = '<span class="wcard__tri" aria-hidden="true">▲</span>';
        const label = '<span class="wcard__label">' + esc(c.label) + '</span>';
        const attrs = ' href="' + esc(c.link || '#series') + '" data-label="' + esc(c.label) + '"' +
          (c.filter ? ' data-filter="' + esc(c.filter) + '"' : '') +
          (c.series != null && c.series >= 0 ? ' data-series="' + c.series + '"' : '') + ' data-cursor="drag" draggable="false"';
        if (c.type === 'photo') {
          return '<a class="wcard wcard--photo"' + attrs + '>' +
            '<span class="wcard__media"><img data-photo="' + esc(c.photo) + '" data-ratio="0.68" alt="" draggable="false"></span>' +
            tri + num + label + '</a>';
        }
        let inner = '';
        if (c.type === 'red') {
          inner = '<span class="wcard__icon aperture" data-aperture="card"></span>' +
            (c.big ? '<span class="wcard__corner">' + esc(c.big) + '</span>' : '');
        } else if (c.type === 'paper') {
          inner = '<span class="wcard__big">' + esc(c.big || '') + '</span>' +
            '<span class="wcard__lines"><i></i><i></i><i></i></span>';
        } else {
          inner = '<span class="wcard__big wcard__big--sm">' + esc(c.big || '') + '</span>' +
            '<span class="wcard__arrow" aria-hidden="true">→</span>';
        }
        return '<a class="wcard wcard--' + esc(c.type) + '"' + attrs + '>' + tri + num + inner + label + '</a>';
      }).join('');
    },

    tape: function (S) {
      let half = '';
      const words = (S.tape && S.tape.length ? S.tape : S.genres) || [];
      for (let k = 0; k < 3; k++) {
        words.forEach(function (g) {
          half += '<span class="tape__item">' + esc(g) + '</span><span class="tape__star" aria-hidden="true">✦</span>';
        });
      }
      return '<span class="tape__half">' + half + '</span><span class="tape__half" aria-hidden="true">' + half + '</span>';
    },

    stats: function (S) {
      return S.stats.map(function (s) {
        return '<li class="stat"><span class="stat__num">' + (s.prefix ? '<small>' + esc(s.prefix) + '</small>' : '') + '<span data-count="' + esc(s.value) + '">0</span>' + esc(s.suffix || '') +
          '</span><span class="stat__label">' + esc(s.label) + '</span></li>';
      }).join('');
    },

    filters: function (S) {
      const counts = {};
      S.works.forEach(function (w) { counts[w.genre] = (counts[w.genre] || 0) + 1; });
      let html = '<button class="filter is-active" type="button" data-filter="*" role="tab" aria-selected="true"><span class="roll">Все</span><sup>' + S.works.length + '</sup></button>';
      S.genres.forEach(function (g) {
        if (!counts[g]) return;
        html += '<button class="filter" type="button" data-filter="' + esc(g) + '" role="tab" aria-selected="false"><span class="roll">' + esc(g) + '</span><sup>' + counts[g] + '</sup></button>';
      });
      return html;
    },

    works: function (S) {
      return S.works.map(function (w, i) {
        return '<figure class="work" data-genre="' + esc(w.genre) + '" data-i="' + i + '">' +
          '<div class="work__media media" data-reveal data-parallax data-cursor="view">' +
          '<div class="media__in"><img data-photo="' + esc(w.photo) + '" alt="' + esc(w.title) + '"></div>' +
          '<span class="vf" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
          '<span class="work__exif" aria-hidden="true" data-exif-text="' + esc(w.exif || '') + '"></span>' +
          '</div>' +
          '<figcaption class="work__cap"><span class="work__num">' + pad2(i + 1) + '</span>' +
          '<span class="work__title">' + esc(w.title) + '</span>' +
          '<span class="work__meta">' + esc(w.meta || [w.genre, w.year].filter(Boolean).join(' · ')) + '</span></figcaption>' +
          '</figure>';
      }).join('');
    },

    'series-l': function (S) {
      return S.series.map(function (s, i) {
        return '<button class="dw__row dw__row--l" type="button" data-i="' + i + '" data-cursor="view" data-cursor-label="Открыть">' +
          '<span class="dw__n">' + pad2(i + 1) + '</span><span class="dw__t">' + esc(s.title) + '</span></button>';
      }).join('');
    },

    'series-r': function (S) {
      return S.series.map(function (s, i) {
        return '<div class="dw__row dw__row--r" data-i="' + i + '"><span class="dw__g">' + esc(s.genre) + '</span><span class="dw__y">' + esc(s.year) + '</span></div>';
      }).join('');
    },

    film: function (S) {
      const stamp = String(S.nameLatin || 'FILM').trim().split(/\s+/).slice(-1)[0] + ' 400';
      return S.film.map(function (p, i) {
        const n = i + 1;
        const ar = (S.filmRatios && S.filmRatios[i]) || 1.5;
        return '<figure class="frame" data-i="' + i + '" data-cursor="view" style="--ar:' + ar.toFixed(4) + '">' +
          '<span class="frame__edge frame__edge--t"><b>' + esc(stamp) + '</b><span>▶ ' + n + '</span></span>' +
          '<div class="frame__media"><img data-photo="' + esc(p) + '" data-ratio="' + ar.toFixed(4) + '" alt=""></div>' +
          '<span class="frame__edge frame__edge--b"><span>' + n + '</span><span>' + n + 'A ▶</span></span>' +
          '</figure>';
      }).join('');
    },

    zoom: function (S) {
      return S.zoom.slice(0, 9).map(function (p, i) {
        return '<figure class="zoom__item' + (i === 4 ? ' zoom__item--c' : '') + '"><img data-photo="' + esc(p) + '" alt=""></figure>';
      }).join('');
    },

    services: function (S) {
      return S.services.map(function (s, i) {
        return '<article class="scard scard--' + esc(s.style || 'paper') + '" style="--i:' + i + '">' +
          '<figure class="scard__media"><img data-photo="' + esc(s.photo) + '" alt=""></figure>' +
          '<div class="scard__body">' +
          '<div class="scard__top"><span class="scard__num">' + pad2(i + 1) + '</span><span class="scard__price">' + esc(s.price) + '</span></div>' +
          '<h3 class="scard__title">' + esc(s.title) + '</h3>' +
          '<p class="scard__text">' + esc(s.text) + '</p>' +
          '<ul class="scard__list">' + (s.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>' +
          '<a class="scard__btn" href="#contact"><span class="roll">Записаться</span><span aria-hidden="true">→</span></a>' +
          '</div>' +
          '<div class="scard__shade" aria-hidden="true"></div>' +
          '</article>';
      }).join('');
    },

    process: function (S) {
      return S.process.map(function (p, i) {
        return '<li class="step"><span class="step__dot" aria-hidden="true"><i></i></span>' +
          '<span class="step__num">' + pad2(i + 1) + '</span>' +
          '<h3 class="step__title">' + esc(p.title) + '</h3>' +
          '<p class="step__text">' + esc(p.text) + '</p></li>';
      }).join('');
    },

    trail: function (S) {
      return S.trail.map(function (p) {
        return '<img class="trail__img" data-photo="' + esc(p) + '" data-ratio="0.78" alt="" draggable="false">';
      }).join('');
    },

    contacts: function (S) {
      return S.contacts.map(function (c) {
        const v = c.href
          ? '<a class="contacts__v roll" href="' + esc(c.href) + '" target="_blank" rel="noopener">' + esc(c.value) + '</a>'
          : '<span class="contacts__v">' + esc(c.value) + '</span>';
        return '<li class="contacts__item"><span class="contacts__k">' + esc(c.label) + '</span>' + v + '</li>';
      }).join('');
    },

    'contacts-mini': function (S) {
      return S.contacts.map(function (c) {
        return c.href
          ? '<li><a class="roll" href="' + esc(c.href) + '" target="_blank" rel="noopener">' + esc(c.label) + '</a></li>'
          : '<li>' + esc(c.value) + '</li>';
      }).join('');
    },
  };

  APP.render = function () {
    const S = window.SITE;
    if (!S) {
      document.body.innerHTML = '<p class="noscript">Ошибка в js/content.js — проверь запятые и кавычки в последнем изменённом месте.</p>';
      throw new Error('SITE is not defined: js/content.js failed to load');
    }
    const derived = {
      footerWord: String(S.name || '').trim().split(/\s+/).slice(-1)[0] || '',
      genresLine: ((S.tape && S.tape.length ? S.tape : S.genres) || []).slice(0, 3).join(' · '),
    };

    document.querySelectorAll('[data-list]').forEach(function (el) {
      const fn = tpl[el.dataset.list];
      if (fn) el.innerHTML = fn(S);
    });

    document.querySelectorAll('[data-bind]').forEach(function (el) {
      const key = el.dataset.bind;
      const v = key in derived ? derived[key] : pick(S, key);
      if (v != null) el.textContent = v;
    });

    const ring = document.querySelector('[data-ring-text]');
    if (ring) ring.textContent = (S.heroWord + ' • ' + S.name + ' • ' + S.role + ' • ').toUpperCase();

    // the "me" photo and the menu previews follow the content (Drive or local)
    if (S.about && S.about.photo && S.about.photo !== 'me') {
      document.querySelectorAll('img[data-photo="me"]').forEach(function (img) { img.dataset.photo = S.about.photo; });
    }
    if (S.menuPhotos) {
      document.querySelectorAll('.menu__link').forEach(function (a, i) { if (S.menuPhotos[i]) a.dataset.photo = S.menuPhotos[i]; });
    }

    document.querySelectorAll('[data-cta]').forEach(function (a) { a.href = S.ctaLink || '#contact'; });
    document.querySelectorAll('.year').forEach(function (el) { el.textContent = new Date().getFullYear(); });
    document.title = S.name + ' — ' + String(S.role).toLowerCase();
  };
})();
