(function () {
  'use strict';

  var PHONE_INTL = '355696020609';
  var IMG_V = {};
  var IMG_FOCUS = {};
  var SCHEDULE = {
    slotMinutes: 30, daysAhead: 14, lastSlotBeforeClose: 60,
    week: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} }, closedDates: [], blocked: {}
  };

  var FRENCH = { en: 'French / Ombré', sq: 'French / Ombre', price: 200 };
  var XXL = { en: 'XXL length / Ombré', sq: 'Gjatësia XXL / Ombre', price: 200 };

  var SERVICES = [
    { id: 'gel-mani',  en: 'Gel manicure',            sq: 'Manikyr xhel',                price: 800,
      d: { en: 'Russian-technique manicure, careful cuticle work and a long-lasting gel finish.', sq: 'Manikyr me teknikë ruse, kujdes i imët për kutikulat dhe përfundim me xhel që zgjat.' } },
    { id: 'gel-nails', en: 'Gel nails, one colour',   sq: 'Thonj me xhel (njëngjyrësh)', price: 1000, addon: FRENCH,
      d: { en: 'Gel on the natural nail in a single shade of your choice.', sq: 'Xhel mbi thoin natyral, në një ngjyrë sipas zgjedhjes tënde.' } },
    { id: 'tips',      en: 'Nails with tips',         sq: 'Thonj me tipsa',              price: 1200, addon: FRENCH,
      d: { en: 'Extra length built with tips, shaped and finished in gel.', sq: 'Gjatësi shtesë me tipsa, e formuar dhe e përfunduar me xhel.' } },
    { id: 'tips-c',    en: 'Nails with C-curve tips', sq: 'Thonj me tipsa C',            price: 1500, addon: XXL,
      d: { en: 'C-curve tips for a sculpted, elegant arch.', sq: 'Tipsa C për një hark të skalitur dhe elegant.' } },
    { id: 'refill',    en: 'Gel refill',              sq: 'Rimbushje thonjsh',           price: 1000,
      d: { en: 'Regrowth filled and your set refreshed.', sq: 'Mbushja e pjesës së rritur dhe rifreskimi i setit.' } },
    { id: 'refill-c',  en: 'C-tip refill',            sq: 'Rimbushje tipsa C',           price: 1200,
      d: { en: 'Refill and reshape for C-curve tip sets.', sq: 'Rimbushje dhe riformim për setet me tipsa C.' } },
    { id: 'pedi',      en: 'Pedicure',                sq: 'Pedikyr',                     price: 1000,
      d: { en: 'Clean, precise care for your feet.', sq: 'Kujdes i pastër dhe i saktë për këmbët e tua.' } }
  ];

  var WORK = [
    { img: 'work-1.jpg', w: 19.5, r: .95, en: 'gel manicure',      sq: 'manikyr xhel' },
    { img: 'work-2.jpg', w: 14.4, r: 1,   en: 'pedicure',          sq: 'pedikyr' },
    { img: 'work-3.jpg', w: 21.5, r: .85, en: 'nails with tips',   sq: 'thonj me tipsa' },
    { img: 'work-4.jpg', w: 16.1, r: .70, en: 'french / ombré',    sq: 'french / ombre' },
    { img: 'work-5.jpg', w: 14.4, r: .92, en: 'c-curve tips',      sq: 'tipsa c' },
    { img: 'work-6.jpg', w: 14.1, r: .79, en: 'gel nails',         sq: 'thonj me xhel' }
  ];

  var TESTIMONIALS = [
    { sample: true, name: 'Erisa M.',
      sq: 'Thonjtë më qëndruan perfekt për tre javë. Punë shumë e pastër dhe e kujdesshme.',
      en: 'My nails stayed perfect for three weeks. Very clean, careful work.' },
    { sample: true, name: 'Klea H.',
      sq: 'Ambient i qetë dhe shumë i bukur. Manikyri rus më i mirë që kam bërë në Tiranë.',
      en: 'A calm, beautiful space. The best Russian manicure I’ve had in Tirana.' },
    { sample: true, name: 'Anxhela D.',
      sq: 'Kujdes i veçantë për çdo detaj. Dola nga studio me duar si të reja.',
      en: 'Real care for every detail. I left the studio with hands like new.' },
    { sample: true, name: 'Megi K.',
      sq: 'French-i më i hollë dhe më elegant që kam pasur ndonjëherë. Do kthehem patjetër!',
      en: 'The finest, most elegant French I’ve ever had. I’ll definitely be back!' },
    { sample: true, name: 'Elona S.',
      sq: 'Pedikyri ishte relaksues dhe rezultati i përsosur. E rekomandoj me gjithë zemër.',
      en: 'The pedicure was relaxing and the result perfect. I recommend it wholeheartedly.' }
  ];

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lang = 'en';
  var STR = function () { return window.RM_STR[lang]; };
  var L = function (o) { return (o && (o[lang] || o.en)) || ''; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  function loadFigure(fig) {
    if (fig.dataset.loading) return;
    fig.dataset.loading = '1';
    var list = (fig.dataset.img || '').split('|');
    var i = 0;
    (function next() {
      if (i >= list.length) return;
      var img = new Image();
      img.alt = fig.dataset.alt || fig.dataset.label || '';
      img.decoding = 'async';
      var f = IMG_FOCUS[list[i]];
      if (f) {
        img.style.objectPosition = f.x + '% ' + f.y + '%';
        if (f.zoom && f.zoom !== 1) { img.style.scale = String(f.zoom); img.style.transformOrigin = f.x + '% ' + f.y + '%'; }
      }
      img.onload = function () {
        fig.appendChild(img);
        requestAnimationFrame(function () { fig.classList.add('has-img'); });
      };
      img.onerror = function () { i++; next(); };
      img.src = (IMG_V[list[i]] ? 'media/' + list[i] + '?v=' + IMG_V[list[i]] : 'images/' + list[i]);
    })();
  }

  var imgIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { loadFigure(e.target); imgIO.unobserve(e.target); } });
  }, { rootMargin: '800px 0px' }) : null;

  function watchImages(root) {
    $$('.ph[data-img]', root).forEach(function (f) {
      if (f.dataset.loading) return;
      if (imgIO && !f.classList.contains('hero__img')) imgIO.observe(f); else loadFigure(f);
    });
  }

  var revealIO = 'IntersectionObserver' in window && !reduced ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;

  function watchReveals(root) {
    $$('.reveal:not(.in)', root).forEach(function (el) {
      if (revealIO) revealIO.observe(el); else el.classList.add('in');
    });
  }

  function renderPrices() {
    $('#priceList').innerHTML = SERVICES.map(function (s, i) {
      var add = s.addon ? '<span class="price__add">+ ' + esc(L(s.addon)) + ' +' + esc(s.addon.price) + ' L</span>' : '';
      return '<li class="price__row reveal">' +
        '<span class="price__no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<h4 class="price__name">' + esc(L(s)) + '</h4>' +
        '<div class="price__info"><p>' + esc(L(s.d)) + '</p>' +
          '<div class="price__meta"><span class="price__val">' + esc(s.price) + ' L</span>' + add + '</div>' +
          '<button type="button" class="price__book" data-service="' + esc(s.id) + '" aria-label="' + esc(STR().bookThis + ': ' + L(s)) + '">' + esc(STR().bookThis) + ' →</button>' +
        '</div></li>';
    }).join('');
    watchReveals($('#priceList'));
  }

  var BLINDS = [6.8, 24.6, 27.7, 0, 44.2, 19.5, 34.7, 14.7, 24.6, 58.8, 41.2, 9.2, 36.6, 31.6, 49.3, 17, 28, 4, 39, 22, 12];
  function renderBlinds() {
    var per = 3, n = SERVICES.length * per, h = 100 / n, html = '';
    for (var i = 0; i < n; i++) {
      html += '<i class="' + (i % per === per - 1 ? 'row-end' : '') + '" style="--t:' + (i * h) + '%;--h:' + h + '%;--x:' + BLINDS[i % BLINDS.length] + '%"></i>';
    }
    $('#priceBlinds').innerHTML = html;
  }

  function renderWork() {
    $('#workGrid').innerHTML = WORK.map(function (w) {
      return '<figure class="work__item reveal" style="--w:' + w.w + ';--r:' + w.r + '">' +
        '<div class="ph" data-img="' + esc(w.img) + '" data-label="" data-alt="' + esc(L(w)) + '"></div>' +
        '<figcaption>' + esc(L(w)) + '</figcaption></figure>';
    }).join('');
    watchImages($('#workGrid')); watchReveals($('#workGrid'));
  }

  var loveIdx = 0, loveTimer = null;
  var IS_PREVIEW = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/.test(location.hostname) || location.protocol === 'file:';
  function renderLove() {
    var QUOTES = TESTIMONIALS.filter(function (t) { return IS_PREVIEW || !t.sample; });
    var box = $('#loveQuote');
    clearInterval(loveTimer);
    if (!QUOTES.length) {
      box.innerHTML = '<p class="love__q love__q--empty">“' + STR().loveEmpty + '”</p><p class="love__who">' + STR().loveEmptySub + '</p>';
      return;
    }
    var n = QUOTES.length;
    var show = function () {
      var i = ((loveIdx % n) + n) % n, t = QUOTES[i];
      box.innerHTML =
        '<div class="love__slide"><p class="love__stars" aria-label="5 / 5">★★★★★</p><p class="love__q">“' + esc(L(t)) + '”</p>' +
        '<p class="love__who">— ' + esc(t.name) + '</p></div>' +
        (n > 1 ? '<div class="love__nav"><button type="button" data-dir="-1" aria-label="Previous">←</button>' +
          '<span>' + String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0') + '</span>' +
          '<button type="button" data-dir="1" aria-label="Next">→</button></div>' : '');
      var slide = box.querySelector('.love__slide');
      slide.classList.add('swap');
    };
    var start = function () {
      clearInterval(loveTimer);
      if (n > 1 && !reduced) loveTimer = setInterval(function () { loveIdx++; show(); }, 7000);
    };
    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-dir]'); if (!b) return;
        loveIdx += +b.dataset.dir; show(); start();
      });
    }
    show(); start();
  }

  var state = { svc: null, addon: false, date: null, time: null };

  var SQ_DAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'];
  var SQ_DAYS_S = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
  var SQ_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
  function fmtDate(d, opts) {
    if (lang !== 'sq') return new Intl.DateTimeFormat('en-GB', opts).format(d);
    if (opts.weekday === 'short') return SQ_DAYS_S[d.getDay()];
    if (opts.month === 'short' && !opts.day) return SQ_MONTHS[d.getMonth()].slice(0, 3);
    var day = SQ_DAYS[d.getDay()];
    return day.charAt(0).toUpperCase() + day.slice(1) + ', ' + d.getDate() + ' ' + SQ_MONTHS[d.getMonth()];
  }
  function sameDay(a, b) { return a && b && a.toDateString() === b.toDateString(); }
  function svcById(id) { return SERVICES.filter(function (s) { return s.id === id; })[0]; }

  function renderChips() {
    $('#svcChips').innerHTML = SERVICES.map(function (s) {
      var on = state.svc === s.id;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-id="' + esc(s.id) + '">' +
        '<span class="chip__name">' + esc(L(s)) + '</span><span class="chip__price">' + esc(s.price) + ' L</span></button>';
    }).join('');
    var s = svcById(state.svc);
    var wrap = $('#addonWrap');
    if (s && s.addon) {
      wrap.hidden = false;
      $('#addonLabel').innerHTML = esc(L(s.addon)) + ' <b>+' + esc(s.addon.price) + ' L</b>';
      $('#addon').checked = state.addon;
    } else { wrap.hidden = true; state.addon = false; }
  }

  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function toMin(hhmm) { var p = String(hhmm || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function dayHours(d) {
    var w = SCHEDULE.week[d.getDay()] || {};
    var closed = !!w.closed || (SCHEDULE.closedDates || []).indexOf(dateKey(d)) > -1;
    return { closed: closed, open: toMin(w.open || '09:00'), close: toMin(w.close || '20:00') };
  }
  function slotsFor(d) {
    var h = dayHours(d); if (h.closed) return [];
    var out = [], step = Math.max(10, +SCHEDULE.slotMinutes || 30), last = h.close - (+SCHEDULE.lastSlotBeforeClose || 0);
    for (var m = h.open; m <= last; m += step) out.push(pad2(Math.floor(m / 60)) + ':' + pad2(m % 60));
    return out;
  }

  function renderDates() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var html = '', days = Math.min(60, Math.max(1, +SCHEDULE.daysAhead || 14));
    if (state.date && dayHours(state.date).closed) { state.date = null; state.time = null; }
    for (var i = 0; i < days; i++) {
      var d = new Date(today); d.setDate(today.getDate() + i);
      var on = sameDay(d, state.date), off = dayHours(d).closed;
      html += '<button type="button" class="date' + (on ? ' on' : '') + (off ? ' date--off' : '') + '" role="radio" aria-checked="' + on + '" data-t="' + d.getTime() + '"' + (off ? ' disabled' : '') + ' aria-label="' + fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (off ? ' — ' + esc(STR().closedDay) : '') + '">' +
        '<span class="date__wd">' + (i === 0 ? STR().today : fmtDate(d, { weekday: 'short' })) + '</span>' +
        '<span class="date__d">' + d.getDate() + '</span>' +
        '<span class="date__m">' + fmtDate(d, { month: 'short' }) + '</span></button>';
    }
    $('#dateStrip').innerHTML = html;
  }

  function renderTimes() {
    if (!state.date) { $('#timeGrid').innerHTML = '<p class="times__hint">' + esc(STR().pickDate) + '</p>'; return; }
    var now = new Date(), isToday = sameDay(state.date, now);
    var blocked = (SCHEDULE.blocked || {})[dateKey(state.date)] || [];
    var html = '', free = 0;
    slotsFor(state.date).forEach(function (hh) {
      var past = isToday && toMin(hh) <= now.getHours() * 60 + now.getMinutes() + 60;
      var off = past || blocked.indexOf(hh) > -1;
      if (off && state.time === hh) state.time = null;
      if (!off) free++;
      var on = state.time === hh;
      html += '<button type="button" class="time' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-t="' + hh + '"' + (off ? ' disabled' : '') + '>' + hh + '</button>';
    });
    $('#timeGrid').innerHTML = free ? html : '<p class="times__hint">' + esc(STR().noTimes) + '</p>';
  }

  function updateSummary() {
    var s = svcById(state.svc);
    var total = s ? s.price + (state.addon && s.addon ? s.addon.price : 0) : null;
    $('#sumService').textContent = s ? L(s) + (state.addon && s.addon ? ' + ' + L(s.addon) : '') : '—';
    $('#sumDate').textContent = state.date ? fmtDate(state.date, { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
    $('#sumTime').textContent = state.time || '—';
    $('#sumPrice').textContent = total ? total + ' L' : '—';

    var done = [!!s, !!state.date, !!state.time];
    var ready = done[0] && done[1] && done[2];
    $('#sendWa').disabled = !ready;
    var hint = $('#bookHint');
    hint.textContent = ready ? STR().readyHint : (lang === 'sq' ? window.RM_SQ['bk.hint'] : hint.dataset.en);
    hint.classList.toggle('ready', ready);

    var current = done.indexOf(false); if (current === -1) current = 3;
    $$('.progress li').forEach(function (li, i) {
      li.classList.toggle('done', i < 3 ? done[i] : false);
      li.classList.toggle('current', i === current);
    });
    $$('.bstep').forEach(function (f, i) {
      f.classList.toggle('is-done', i < 3 && done[i]);
      f.classList.toggle('is-current', i === current);
    });
    $('.progress').style.setProperty('--p', (done.filter(Boolean).length / 3));
  }

  function renderBooking() { renderChips(); renderDates(); renderTimes(); updateSummary(); }

  function selectService(id, scroll) {
    state.svc = id;
    renderChips(); updateSummary();
    if (scroll) {
      $('#book').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      var chip = $('.chip[data-id="' + id + '"]');
      if (chip) {

        var list = $('#svcChips');
        if (list.scrollHeight > list.clientHeight) list.scrollTop = chip.offsetTop - list.offsetTop - 8;
        chip.classList.add('pulse'); setTimeout(function () { chip.classList.remove('pulse'); }, 1600);
      }
    }
  }

  function bindBooking() {
    $('#svcChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      if (state.svc !== b.dataset.id) state.addon = false;
      selectService(b.dataset.id, false);
    });
    $('#addon').addEventListener('change', function (e) { state.addon = e.target.checked; updateSummary(); });
    var chips = $('#svcChips');
    var fadeEnd = function () { chips.classList.toggle('at-end', chips.scrollTop + chips.clientHeight >= chips.scrollHeight - 4); };
    chips.addEventListener('scroll', fadeEnd, { passive: true });
    window.addEventListener('resize', fadeEnd); setTimeout(fadeEnd, 0);
    $('#dateStrip').addEventListener('click', function (e) {
      var b = e.target.closest('.date'); if (!b || b.disabled) return;
      state.date = new Date(+b.dataset.t);
      renderDates(); renderTimes(); updateSummary();
    });
    $('#timeGrid').addEventListener('click', function (e) {
      var b = e.target.closest('.time'); if (!b || b.disabled) return;
      state.time = b.dataset.t; renderTimes(); updateSummary();
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-service]'); if (!b) return;
      e.preventDefault(); state.addon = false; selectService(b.dataset.service, true);
    });
    $('#booker').addEventListener('submit', function (e) {
      e.preventDefault();
      var s = svcById(state.svc); if (!s || !state.date || !state.time) return;
      var t = STR(), name = $('#clientName').value.trim();
      var lines = [
        t.waHello, '',
        '• ' + t.waService + ': ' + L(s) + (state.addon && s.addon ? ' + ' + L(s.addon) : '') + ' (' + (s.price + (state.addon && s.addon ? s.addon.price : 0)) + ' L)',
        '• ' + t.waDate + ': ' + fmtDate(state.date, { weekday: 'long', day: 'numeric', month: 'long' }),
        '• ' + t.waTime + ': ' + state.time
      ];
      if (name) lines.push('• ' + t.waName + ': ' + name);
      lines.push('', t.waThanks);
      var url = 'https://wa.me/' + PHONE_INTL + '?text=' + encodeURIComponent(lines.join('\n'));
      $('#sendWa').classList.add('sent');
      setTimeout(function () { $('#sendWa').classList.remove('sent'); }, 2400);
      window.open(url, '_blank', 'noopener');
    });
  }

  function setLang(next) {
    lang = next === 'sq' ? 'sq' : 'en';
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (el) {
      if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
      var v = lang === 'sq' ? window.RM_SQ[el.dataset.i18n] : null;
      el.innerHTML = v != null ? v : el.dataset.en;
    });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    store('rm-lang-v2', lang);
    renderPrices(); renderWork(); renderLove(); renderBooking();
  }

  function bindChrome() {
    var header = $('.site-header'), float = $('.float-cta');
    var bookVisible = false, footVisible = false;
    var onScroll = function () {
      var y = window.scrollY;
      header.classList.toggle('scrolled', y > 40);
      float.classList.toggle('show', y > window.innerHeight * 0.85 && !bookVisible && !footVisible);
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) {
        if (e.target.id === 'book') bookVisible = e.isIntersecting; else footVisible = e.isIntersecting;
      }); onScroll(); }).observe($('#book'));
      new IntersectionObserver(function (es) { footVisible = es[0].isIntersecting; onScroll(); }).observe($('.footer'));
    }

    var burger = $('.burger'), menu = $('#menu');
    var setMenu = function (open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', open);
      if (open) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add('open'); }); }
      else { menu.classList.remove('open'); setTimeout(function () { if (!menu.classList.contains('open')) menu.hidden = true; }, 500); }
    };
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

    $$('.lang button').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href="#top"]'); if (!a) return;
      e.preventDefault();
      setMenu(false);
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  }

  function bindParallax() {
    if (reduced) return;
    var els = $$('[data-parallax]'), ticking = false, hero = $('.hero');
    var run = function () {
      var vh = window.innerHeight;

      hero.style.setProperty('--hp', Math.min(1, window.scrollY / vh).toFixed(3));
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var off = (r.top + r.height / 2 - vh / 2) * -parseFloat(el.dataset.parallax);
        el.style.translate = '0 ' + off.toFixed(1) + 'px';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    window.addEventListener('resize', run); run();
  }

  function bindHeroPin() {
    var hero = $('.hero');
    var fit = function () { hero.style.setProperty('--hero-top', Math.min(0, window.innerHeight - hero.offsetHeight) + 'px'); };
    window.addEventListener('resize', fit); fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  function applyContent(c) {
    if (Array.isArray(c.services) && c.services.length) SERVICES = c.services;
    if (Array.isArray(c.work) && c.work.length) WORK = c.work;
    if (Array.isArray(c.testimonials)) TESTIMONIALS = c.testimonials;
    if (c.schedule) SCHEDULE = c.schedule;
    if (c.imageVersions) IMG_V = c.imageVersions;
    if (c.imageFocus) IMG_FOCUS = c.imageFocus;
    if (c.ui) ['en', 'sq'].forEach(function (l) { if (c.ui[l]) Object.assign(window.RM_STR[l], c.ui[l]); });
    if (c.text) $$('[data-i18n]').forEach(function (el) {
      var t = c.text[el.dataset.i18n]; if (!t) return;
      if (t.en) { el.dataset.en = t.en; el.innerHTML = t.en; }
      if (t.sq) window.RM_SQ[el.dataset.i18n] = t.sq;
    });
    if (c.settings) applySettings(c.settings);
  }

  function applySettings(s) {
    if (s.phoneIntl) PHONE_INTL = String(s.phoneIntl).replace(/\D/g, '');
    var set = function (sel, fn) { $$(sel).forEach(fn); };
    var addrDots = [s.addressLine1, s.addressLine2, s.city].filter(Boolean).join(' · ');
    var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.mapQuery || addrDots);
    set('[data-href="tel"]', function (a) { a.href = 'tel:+' + PHONE_INTL; });
    set('[data-href="wa"]', function (a) { a.href = 'https://wa.me/' + PHONE_INTL; });
    set('[data-href="ig"]', function (a) { a.href = 'https://www.instagram.com/' + encodeURIComponent(s.instagram || '') + '/'; });
    set('[data-href="artist-ig"]', function (a) { a.href = 'https://www.instagram.com/' + encodeURIComponent(s.artistInstagram || '') + '/'; });
    set('[data-href="maps"]', function (a) { a.href = maps; });
    set('[data-bind="phone"]', function (e) { e.textContent = s.phoneDisplay || ''; });
    set('[data-bind="ig"]', function (e) { e.textContent = '@' + (s.instagram || ''); });
    set('[data-bind="artist-ig"]', function (e) { e.textContent = '@' + (s.artistInstagram || ''); });
    set('[data-bind="hours"]', function (e) { e.textContent = s.hours || ''; });
    set('[data-bind="addr-full"]', function (e) { e.innerHTML = esc(s.addressLine1) + ',<br>' + esc(s.addressLine2) + ' — ' + esc(s.city); });
    set('[data-bind="addr-short"]', function (e) { e.textContent = [s.addressLine2, s.city].filter(Boolean).join(', '); });
    set('[data-bind="addr-line"]', function (e) { e.textContent = addrDots; });
    set('[data-bind="menu-line"]', function (e) { e.textContent = [s.addressLine2, s.city, s.hours].filter(Boolean).join(' · '); });
    set('[data-bind="pin-ring"]', function (e) { e.textContent = ['RM NAILS SUITE', s.addressLine2, s.city].filter(Boolean).join(' · ').toUpperCase() + ' ·'; });
    set('iframe[data-src="map"]', function (f) {
      var src = 'https://www.google.com/maps?q=' + encodeURIComponent(s.mapQuery || addrDots) + '&z=15&output=embed';
      if (f.getAttribute('src') !== src) f.setAttribute('src', src);
    });
  }

  function loadContent() {
    if (location.protocol === 'file:') return Promise.resolve(null);
    return Promise.race([
      fetch('data/content.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }),
      new Promise(function (res) { setTimeout(function () { res(null); }, 2500); })
    ]).catch(function () { return null; });
  }

  loadContent().then(function (c) {
  if (c) { try { applyContent(c); } catch (e) { console.warn('content.json not applied', e); } }

  var saved = store('rm-lang-v2');
  bindChrome();
  bindBooking();
  setLang(saved === 'en' ? 'en' : 'sq');
  watchImages(document);
  watchReveals(document);
  renderBlinds();
  bindParallax();
  bindHeroPin();
  requestAnimationFrame(function () { setTimeout(function () { document.body.classList.add('loaded'); }, 60); });
  });
})();
