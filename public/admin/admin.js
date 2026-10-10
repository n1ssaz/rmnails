(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad2 = function (n) { return String(n).padStart(2, '0'); };

  var C = null;
  var dirty = false;

  function api(method, url, body, type) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'X-RM-Admin': '1' } };
    if (body !== undefined) {
      if (type) { opts.headers['Content-Type'] = type; opts.body = body; }
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ('Gabim ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  function toast(msg, bad) {
    var t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  function markDirty() {
    dirty = true;
    $('#saveBtn').disabled = false;
    $('#status').textContent = 'Ka ndryshime të paruajtura';
    $('#status').classList.add('dirty');
  }
  function markClean() {
    dirty = false;
    $('#saveBtn').disabled = true;
    $('#status').textContent = 'Të gjitha ndryshimet janë ruajtur';
    $('#status').classList.remove('dirty');
  }

  function save() {
    $('#saveBtn').disabled = true;
    $('#status').textContent = 'Duke ruajtur…';
    return api('PUT', '/api/content', C).then(function () {
      markClean(); toast('U ruajt ✓ — ndryshimet janë live në faqe');
    }).catch(function (e) {
      if (e.status === 401) return showLogin();
      $('#saveBtn').disabled = false; toast('Nuk u ruajt: ' + e.message, true);
    });
  }

  function setPath(path, v) {
    if (path.indexOf('text.') === 0) {
      var rest = path.slice(5), cut = rest.lastIndexOf('.'), key = rest.slice(0, cut);
      C.text[key] = C.text[key] || { en: '', sq: '' };
      C.text[key][rest.slice(cut + 1)] = LINE_KEYS[key] ? LINE_KEYS[key].toHtml(v) : fromEditable(v); return;
    }
    var keys = path.split('.'), o = C;
    for (var i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = v;
  }
  function onField(e) {
    var el = e.target, k = el.dataset && el.dataset.k; if (!k) return;
    var v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value;
    setPath(k, v); markDirty();
    if (el.dataset.rerender) render(el.dataset.rerender);
  }

  var TITLES = { calendar: 'Kalendari', services: 'Shërbimet & çmimet', texts: 'Tekstet', contact: 'Kontakti', reviews: 'Review-t', work: 'Punimet', photos: 'Fotot', security: 'Siguria' };
  function showTab(name) {
    $$('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    $$('.panel').forEach(function (p) { p.classList.toggle('on', p.dataset.panel === name); });
    $('#tabTitle').textContent = TITLES[name];
    try { sessionStorage.setItem('rm-admin-tab', name); } catch (e) {   }
  }

  function render(which) {
    var all = !which;
    if (all || which === 'calendar') renderWeek();
    if (all || which === 'calendar' || which === 'cal') { renderCal(); renderDay(); }
    if (all || which === 'services') renderServices();
    if (all || which === 'texts') renderTexts();
    if (all || which === 'contact') renderContact();
    if (all || which === 'reviews') renderReviews();
    if (all || which === 'work') renderWork();
    if (all || which === 'photos') renderPhotos();
  }

  var DAYS = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];
  var MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];
  var calMonth = (function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
  var selDay = null;
  var dateKey = function (d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  var toMin = function (s) { var p = String(s || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };

  function sch() {
    var s = C.schedule;
    s.week = s.week || {}; s.closedDates = s.closedDates || []; s.blocked = s.blocked || {};
    for (var i = 0; i < 7; i++) s.week[i] = s.week[i] || { open: '09:00', close: '20:00', closed: false };
    return s;
  }
  function isClosed(d) { var s = sch(); return !!s.week[d.getDay()].closed || s.closedDates.indexOf(dateKey(d)) > -1; }
  function slotsFor(d) {
    var s = sch(), w = s.week[d.getDay()], out = [];
    var step = Math.max(10, +s.slotMinutes || 30), last = toMin(w.close) - (+s.lastSlotBeforeClose || 0);
    for (var m = toMin(w.open); m <= last; m += step) out.push(pad2(Math.floor(m / 60)) + ':' + pad2(m % 60));
    return out;
  }

  function renderWeek() {
    var s = sch(), order = [1, 2, 3, 4, 5, 6, 0];
    $('#weekTable').innerHTML = order.map(function (i) {
      var w = s.week[i];
      return '<tr class="' + (w.closed ? 'closed' : '') + '"><td>' + DAYS[i] + '</td>' +
        '<td><label class="check"><input type="checkbox" data-week="' + i + '" ' + (w.closed ? '' : 'checked') + '> Hapur</label></td>' +
        '<td><input type="time" step="900" data-k="schedule.week.' + i + '.open" data-rerender="cal" value="' + esc(w.open) + '" aria-label="Hapet ' + DAYS[i] + '"' + (w.closed ? ' disabled' : '') + '></td>' +
        '<td><input type="time" step="900" data-k="schedule.week.' + i + '.close" data-rerender="cal" value="' + esc(w.close) + '" aria-label="Mbyllet ' + DAYS[i] + '"' + (w.closed ? ' disabled' : '') + '></td></tr>';
    }).join('');
    $('#slotMinutes').value = String(s.slotMinutes || 30);
    $('#lastSlot').value = String(s.lastSlotBeforeClose == null ? 60 : s.lastSlotBeforeClose);
    $('#daysAhead').value = s.daysAhead || 14;
  }

  function renderCal() {
    var s = sch(), y = calMonth.getFullYear(), m = calMonth.getMonth();
    $('#calTitle').textContent = MONTHS[m] + ' ' + y;
    var first = new Date(y, m, 1), startPad = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var html = ['Hë', 'Ma', 'Më', 'En', 'Pr', 'Sh', 'Di'].map(function (w) { return '<div class="cal__wd">' + w + '</div>'; }).join('');
    for (var p = 0; p < startPad; p++) html += '<div class="cal__d muted-d"></div>';
    for (var d = 1; d <= days; d++) {
      var dt = new Date(y, m, d), k = dateKey(dt), cls = ['cal__d'];
      if (dt < today) cls.push('past');
      if (isClosed(dt)) cls.push('closed');
      if (+dt === +today) cls.push('today');
      if (selDay === k) cls.push('sel');
      var blocked = (s.blocked[k] || []).length;
      html += '<button type="button" class="' + cls.join(' ') + '" data-day="' + k + '" aria-label="' + d + ' ' + MONTHS[m] + (isClosed(dt) ? ', mbyllur' : '') + (blocked ? ', ' + blocked + ' orë të zëna' : '') + '">' + d + (blocked ? '<span class="dot"></span>' : '') + '</button>';
    }
    $('#cal').innerHTML = html;
  }

  function renderDay() {
    var box = $('#dayPanel');
    if (!selDay) { box.innerHTML = '<p class="muted">Kliko një ditë për ta mbyllur ose për të bllokuar orë të zëna.</p>'; return; }
    var s = sch(), p = selDay.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    var weekClosed = !!s.week[d.getDay()].closed, dateClosed = s.closedDates.indexOf(selDay) > -1;
    var blocked = s.blocked[selDay] || [];
    var html = '<h4>' + DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + '</h4>';
    if (weekClosed) {
      html += '<p class="muted">Kjo ditë e javës është e mbyllur te “Orari i javës”.</p>';
    } else {
      html += '<label class="check"><input type="checkbox" id="dayClosed" ' + (dateClosed ? 'checked' : '') + '> Mbyll këtë ditë (pushim, festë…)</label>';
      if (!dateClosed) {
        var slots = slotsFor(d);
        html += '<p class="muted">Kliko orët që janë të zëna. Klientet nuk mund t’i zgjedhin ato.</p>' +
          '<div class="slots">' + slots.map(function (t) {
            var b = blocked.indexOf(t) > -1;
            return '<button type="button" class="slot' + (b ? ' blocked' : '') + '" data-slot="' + t + '" aria-pressed="' + b + '">' + t + '</button>';
          }).join('') + '</div>' +
          '<div class="day__actions"><button type="button" class="btn btn--line btn--small" id="blockAll">Blloko të gjitha</button>' +
          '<button type="button" class="btn btn--line btn--small" id="unblockAll">Hiq bllokimet</button></div>';
      }
    }
    box.innerHTML = html;
  }

  function bindCalendar() {
    $('#weekTable').addEventListener('change', function (e) {
      var i = e.target.dataset.week; if (i == null) return;
      sch().week[i].closed = !e.target.checked; markDirty(); render('calendar');
    });
    $('#slotMinutes').addEventListener('change', function (e) { sch().slotMinutes = +e.target.value; markDirty(); renderDay(); });
    $('#lastSlot').addEventListener('change', function (e) { sch().lastSlotBeforeClose = +e.target.value; markDirty(); renderDay(); });
    $('#daysAhead').addEventListener('input', function (e) { sch().daysAhead = Math.min(60, Math.max(1, +e.target.value || 14)); markDirty(); });
    $('#calPrev').addEventListener('click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal(); });
    $('#calNext').addEventListener('click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal(); });
    $('#cal').addEventListener('click', function (e) {
      var b = e.target.closest('[data-day]'); if (!b) return;
      selDay = b.dataset.day; renderCal(); renderDay();
    });
    $('#dayPanel').addEventListener('click', function (e) {
      var s = sch();
      var slot = e.target.closest('[data-slot]');
      if (slot) {
        var list = s.blocked[selDay] = s.blocked[selDay] || [], t = slot.dataset.slot, i = list.indexOf(t);
        if (i > -1) list.splice(i, 1); else list.push(t);
        list.sort(); if (!list.length) delete s.blocked[selDay];
        markDirty(); renderCal(); renderDay(); return;
      }
      if (e.target.id === 'blockAll') {
        var p = selDay.split('-'); s.blocked[selDay] = slotsFor(new Date(+p[0], +p[1] - 1, +p[2]));
        markDirty(); renderCal(); renderDay();
      }
      if (e.target.id === 'unblockAll') { delete s.blocked[selDay]; markDirty(); renderCal(); renderDay(); }
    });
    $('#dayPanel').addEventListener('change', function (e) {
      if (e.target.id !== 'dayClosed') return;
      var s = sch(), i = s.closedDates.indexOf(selDay);
      if (e.target.checked && i < 0) s.closedDates.push(selDay);
      if (!e.target.checked && i > -1) s.closedDates.splice(i, 1);
      s.closedDates.sort(); markDirty(); renderCal(); renderDay();
    });
  }

  function renderServices() {
    $('#svcList').innerHTML = C.services.map(function (s, i) {
      var base = 'services.' + i + '.';
      return '<div class="item">' +
        '<div class="item__head"><b>' + pad2(i + 1) + ' · ' + esc(s.en || 'Shërbim i ri') + '</b>' +
          '<div class="item__tools">' +
            '<button class="icon-btn" data-svc-move="' + i + '" data-dir="-1" aria-label="Lart"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="icon-btn" data-svc-move="' + i + '" data-dir="1" aria-label="Poshtë"' + (i === C.services.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="btn btn--danger btn--small" data-svc-del="' + i + '">Fshi</button></div></div>' +
        '<div class="pair3">' +
          '<label class="field"><span>Emri (EN)</span><input type="text" data-k="' + base + 'en" value="' + esc(s.en) + '"></label>' +
          '<label class="field"><span>Emri (SQ)</span><input type="text" data-k="' + base + 'sq" value="' + esc(s.sq) + '"></label>' +
          '<label class="field"><span>Çmimi (L)</span><input type="number" min="0" step="50" data-k="' + base + 'price" value="' + esc(s.price) + '"></label></div>' +
        '<div class="pair">' +
          '<label class="field"><span>Përshkrimi (EN)</span><textarea rows="2" data-k="' + base + 'd.en">' + esc(s.d && s.d.en) + '</textarea></label>' +
          '<label class="field"><span>Përshkrimi (SQ)</span><textarea rows="2" data-k="' + base + 'd.sq">' + esc(s.d && s.d.sq) + '</textarea></label></div>' +
        '<div class="addon-box"><label class="check"><input type="checkbox" data-svc-addon="' + i + '" ' + (s.addon ? 'checked' : '') + '> Ka shtesë me pagesë (p.sh. French / Ombré)</label>' +
          (s.addon ? '<div class="pair3">' +
            '<label class="field"><span>Shtesa (EN)</span><input type="text" data-k="' + base + 'addon.en" value="' + esc(s.addon.en) + '"></label>' +
            '<label class="field"><span>Shtesa (SQ)</span><input type="text" data-k="' + base + 'addon.sq" value="' + esc(s.addon.sq) + '"></label>' +
            '<label class="field"><span>+ Çmimi (L)</span><input type="number" min="0" step="50" data-k="' + base + 'addon.price" value="' + esc(s.addon.price) + '"></label></div>' : '') +
        '</div></div>';
    }).join('');
  }
  function bindServices() {
    $('#svcList').addEventListener('click', function (e) {
      var mv = e.target.closest('[data-svc-move]'), del = e.target.closest('[data-svc-del]');
      if (mv) {
        var i = +mv.dataset.svcMove, j = i + +mv.dataset.dir, a = C.services;
        if (j < 0 || j >= a.length) return;
        var t = a[i]; a[i] = a[j]; a[j] = t; markDirty(); renderServices();
      }
      if (del) {
        var k = +del.dataset.svcDel;
        if (!confirm('Ta fshij shërbimin “' + (C.services[k].en || '') + '”?')) return;
        C.services.splice(k, 1); markDirty(); renderServices();
      }
    });
    $('#svcList').addEventListener('change', function (e) {
      var i = e.target.dataset.svcAddon; if (i == null) return;
      C.services[+i].addon = e.target.checked ? { en: 'French / Ombré', sq: 'French / Ombre', price: 200 } : null;
      markDirty(); renderServices();
    });
    $('#svcAdd').addEventListener('click', function () {
      var id = 'svc-' + Date.now().toString(36);
      C.services.push({ id: id, en: '', sq: '', price: 0, d: { en: '', sq: '' }, addon: null });
      markDirty(); renderServices();
      var last = $$('#svcList .item').pop(); if (last) { last.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('input', last).focus(); }
    });
  }

  var GROUPS = [
    ['hero', 'Hero (pjesa e parë)'], ['st', 'Filozofia'], ['ab', 'Artistja'], ['sv', 'Shërbimet & lista e çmimeve'],
    ['sd', 'Studio'], ['ex', 'Përvoja'], ['lv', 'Client Love'], ['wk', 'Punimet'], ['bk', 'Rezervimi'],
    ['ct', 'Kontakti'], ['nav', 'Menuja'], ['cta', 'Butonat'], ['ft', 'Footer']
  ];
  var UI_LABELS = {
    today: 'Etiketa “Sot” te datat', pickDate: 'Mesazh: zgjidh datë', noTimes: 'Mesazh: s’ka orë të lira', closedDay: 'Etiketa e ditës së mbyllur',
    readyHint: 'Mesazh: gati për WhatsApp', bookThis: 'Butoni “Book this”', loveEmpty: 'Client Love bosh — titulli', loveEmptySub: 'Client Love bosh — teksti',
    waHello: 'WhatsApp: përshëndetja', waService: 'WhatsApp: Shërbimi', waDate: 'WhatsApp: Data', waTime: 'WhatsApp: Ora', waName: 'WhatsApp: Emri', waThanks: 'WhatsApp: mbyllja'
  };
  function renderTexts() {
    var q = ($('#textSearch').value || '').trim().toLowerCase();
    var keys = Object.keys(C.text);
    var match = function (k, en, sq) { return !q || (k + ' ' + en + ' ' + sq).toLowerCase().indexOf(q) > -1; };
    var html = GROUPS.map(function (g) {
      var items = keys.filter(function (k) { return k.split('.')[0] === g[0]; }).filter(function (k) { return match(k, C.text[k].en, C.text[k].sq); });
      if (!items.length) return '';
      return '<div class="tgroup"><h3>' + g[1] + '</h3>' + items.map(function (k) {
        var t = C.text[k], lk = LINE_KEYS[k];
        var en = lk ? lk.toPlain(t.en) : toEditable(t.en), sq = lk ? lk.toPlain(t.sq) : toEditable(t.sq);
        var rows = lk ? 3 : Math.min(8, Math.max(1, Math.ceil(Math.max(en.length, sq.length) / 48)));
        return '<div class="titem"><div class="titem__key"><b>' + esc(stripTags(t.en).slice(0, 44) || k) + '</b>' + esc(k) + (lk ? '<br><i>' + esc(lk.hint) + '</i>' : '') + '</div>' +
          '<label class="field"><span class="lang-tag">EN</span><textarea rows="' + rows + '" data-k="text.' + k + '.en">' + esc(en) + '</textarea></label>' +
          '<label class="field"><span class="lang-tag">SQ</span><textarea rows="' + rows + '" data-k="text.' + k + '.sq">' + esc(sq) + '</textarea></label></div>';
      }).join('') + '</div>';
    }).join('');
    var ui = Object.keys(UI_LABELS).filter(function (k) { return match(k + ' ' + UI_LABELS[k], (C.ui.en || {})[k] || '', (C.ui.sq || {})[k] || ''); });
    if (ui.length) html += '<div class="tgroup"><h3>Mesazhet e rezervimit &amp; WhatsApp</h3>' + ui.map(function (k) {
      return '<div class="titem"><div class="titem__key"><b>' + UI_LABELS[k] + '</b>' + k + '</div>' +
        '<label class="field"><span class="lang-tag">EN</span><textarea rows="1" data-k="ui.en.' + k + '">' + esc((C.ui.en || {})[k]) + '</textarea></label>' +
        '<label class="field"><span class="lang-tag">SQ</span><textarea rows="1" data-k="ui.sq.' + k + '">' + esc((C.ui.sq || {})[k]) + '</textarea></label></div>';
    }).join('') + '</div>';
    $('#textGroups').innerHTML = html || '<p class="muted">Asnjë tekst nuk përputhet me kërkimin.</p>';
  }
  function stripTags(s) { var d = document.createElement('div'); d.innerHTML = String(s || '').replace(/</g, ' <'); return d.textContent.replace(/\s+/g, ' ').trim(); }

  var LINE_KEYS = {
    'hero.title': {
      toPlain: function (h) { return linesOf(h).join('\n'); },
      toHtml: function (t) {
        var l = t.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        return l.map(function (x, i) {
          var inner = escText(x);
          if (i === 1) return '<span class="ln"><em>' + inner + '</em></span>';
          return '<span class="ln' + (i === 2 ? ' ln--push' : '') + '"><span>' + inner + '</span></span>';
        }).join('');
      },
      hint: 'Një rresht për çdo rresht të titullit. Rreshti i 2-të del i pjerrët.'
    },
    'lv.title': {
      toPlain: function (h) { return linesOf(h).join('\n'); },
      toHtml: function (t) { return t.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return '<span>' + escText(x) + '</span>'; }).join(''); },
      hint: 'Dy rreshta: rreshti i 2-të del i pjerrët.'
    }
  };
  function linesOf(html) {
    var d = document.createElement('div'); d.innerHTML = html || '';
    var spans = Array.prototype.filter.call(d.children, function (c) { return c.tagName === 'SPAN'; });
    return spans.length ? spans.map(function (s) { return s.textContent.trim(); }) : [d.textContent.trim()];
  }

  function escText(s) { return String(s).replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toEditable(html) { return String(html || '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '); }
  function fromEditable(text) { return String(text).replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;'); }

  var CONTACT_FIELDS = [
    ['phoneDisplay', 'Telefoni (si shfaqet)', '069 602 0609'], ['phoneIntl', 'Telefoni ndërkombëtar (WhatsApp, pa +)', '355696020609'],
    ['instagram', 'Instagram i studios (pa @)', 'rm_nailsuite'], ['artistInstagram', 'Instagram i artistes (pa @)', '_rmaxhari_'],
    ['addressLine1', 'Adresa — rreshti 1', 'Ish Fusha Aviacionit'], ['addressLine2', 'Adresa — rreshti 2', 'Kompleksi IBN'],
    ['city', 'Qyteti', 'Tiranë'], ['hours', 'Orari (teksti që shfaqet)', '09:00 — 20:00'],
    ['mapQuery', 'Kërkimi në hartë (Google Maps)', 'Kompleksi IBN, Fusha e Aviacionit, Tirana']
  ];
  function renderContact() {
    C.settings = C.settings || {};
    $('#contactForm').innerHTML = CONTACT_FIELDS.map(function (f) {
      return '<label class="field"><span>' + f[1] + '</span><input type="text" data-k="settings.' + f[0] + '" value="' + esc(C.settings[f[0]]) + '" placeholder="' + esc(f[2]) + '"></label>';
    }).join('');
  }

  function renderReviews() {
    C.testimonials = C.testimonials || [];
    $('#revList').innerHTML = C.testimonials.map(function (t, i) {
      var base = 'testimonials.' + i + '.';
      return '<div class="item"><div class="item__head"><b>' + esc(t.name || 'Review e re') + '</b>' +
        '<div class="item__tools"><button class="btn btn--danger btn--small" data-rev-del="' + i + '">Fshi</button></div></div>' +
        '<label class="field"><span>Emri i klientes</span><input type="text" data-k="' + base + 'name" value="' + esc(t.name) + '" placeholder="p.sh. Erisa M."></label>' +
        '<div class="pair"><label class="field"><span>Komenti (SQ)</span><textarea rows="3" data-k="' + base + 'sq">' + esc(t.sq) + '</textarea></label>' +
        '<label class="field"><span>Komenti (EN)</span><textarea rows="3" data-k="' + base + 'en">' + esc(t.en) + '</textarea></label></div>' +
        '<label class="check"><input type="checkbox" data-k="' + base + 'sample" ' + (t.sample ? 'checked' : '') + '> Shembull — nuk është koment real (shfaqet vetëm te kompjuteri yt)</label></div>';
    }).join('') || '<p class="muted">Ende nuk ka review.</p>';
  }
  function bindReviews() {
    $('#revList').addEventListener('click', function (e) {
      var d = e.target.closest('[data-rev-del]'); if (!d) return;
      if (!confirm('Ta fshij këtë review?')) return;
      C.testimonials.splice(+d.dataset.revDel, 1); markDirty(); renderReviews();
    });
    $('#revAdd').addEventListener('click', function () {
      C.testimonials.push({ name: '', sq: '', en: '' }); markDirty(); renderReviews();
      var last = $$('#revList .item').pop(); if (last) { last.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('input', last).focus(); }
    });
  }

  var PHOTOS = [
    ['hero.jpg', 'Hero — foto kryesore', 'vertikale ose katrore', 1.13, 'arch-left'],
    ['artist.jpg', 'Artistja — portreti (hark)', '3:4', 0.75, 'arch'], ['artist-detail.jpg', 'Artistja — detaj i vogël', '1:1', 1, ''],
    ['service-manicure.jpg', 'Services — foto e madhe (manikyr)', '16:9', 1.7, ''], ['service-pedicure.jpg', 'Services — foto e vogël (pedikyr)', '3:2', 1.43, ''],
    ['pricelist-2.jpg', 'Lista e çmimeve — foto me shirita', '4:5', 0.77, ''],
    ['studio-2.jpg', 'Studio — foto 1 majtas (hark)', '3:4', 0.75, 'arch'], ['studio-1.jpg', 'Studio — foto 2 në mes (e madhe)', '3:4', 0.71, 'round'],
    ['studio-3.jpg', 'Studio — foto 3 djathtas (hark)', '3:4', 0.75, 'arch'],
    ['love.jpg', 'Client Love — sfondi', '16:9 (e errët)', 1.9, '']
  ];
  function focusOf(name) { var f = (C.imageFocus || {})[name]; return { x: f ? f.x : 50, y: f ? f.y : 50, zoom: f && f.zoom ? f.zoom : 1 }; }
  function focusStyle(name) {
    var f = (C.imageFocus || {})[name]; if (!f) return '';
    return 'object-position:' + f.x + '% ' + f.y + '%;transform-origin:' + f.x + '% ' + f.y + '%;transform:scale(' + (f.zoom || 1) + ')';
  }
  function imgUrl(name) { var v = (C.imageVersions || {})[name]; return v ? '../media/' + name + '?v=' + v : '../images/' + name; }
  function photoCard(name, label, hint, extra, ratio, shape) {
    return '<div class="photo"><div class="photo__img" data-preview="' + esc(name) + '"><img src="' + esc(imgUrl(name)) + '" alt="" style="' + focusStyle(name) + '" onerror="this.remove()"><span>Pa foto ende</span></div>' +
      '<div class="photo__body"><b>' + esc(label) + '</b><small>' + esc(name) + (hint ? ' · ' + esc(hint) : '') + '</small>' + (extra || '') +
      '<div class="photo__btns"><button type="button" class="btn btn--line btn--small" data-upload="' + esc(name) + '">Ndrysho foton</button>' +
      '<button type="button" class="btn btn--line btn--small" data-adjust="' + esc(name) + '" data-ratio="' + (ratio || 1) + '" data-shape="' + esc(shape || '') + '" data-label="' + esc(label) + '">Rregullo pozicionin</button></div></div></div>';
  }
  function renderPhotos() {
    $('#photoList').innerHTML = PHOTOS.map(function (p) { return photoCard(p[0], p[1], p[2], '', p[3], p[4]); }).join('');
  }
  function renderWork() {
    $('#workList').innerHTML = (C.work || []).map(function (w, i) {
      var base = 'work.' + i + '.';
      return photoCard(w.img, 'Punimi ' + (i + 1), '',
        '<label class="field"><span>Teksti (EN)</span><input type="text" data-k="' + base + 'en" value="' + esc(w.en) + '"></label>' +
        '<label class="field"><span>Teksti (SQ)</span><input type="text" data-k="' + base + 'sq" value="' + esc(w.sq) + '"></label>', w.r || 1, '');
    }).join('');
  }

  function toJpeg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2400, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Nuk u përpunua fotoja')); }, 'image/jpeg', 0.9);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Skedari nuk është foto')); };
      img.src = url;
    });
  }
  var uploadTarget = null;
  function bindUploads() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-upload]'); if (!b) return;
      uploadTarget = b.dataset.upload; $('#filePick').value = ''; $('#filePick').click();
    });
    $('#filePick').addEventListener('change', function (e) {
      var f = e.target.files[0], name = uploadTarget; if (!f || !name) return;
      toast('Duke ngarkuar ' + name + '…');
      toJpeg(f).then(function (blob) {
        return api('POST', '/api/upload?name=' + encodeURIComponent(name), blob, 'image/jpeg');
      }).then(function (r) {
        C.imageVersions = C.imageVersions || {}; C.imageVersions[name] = r.version;
        renderPhotos(); renderWork();
        return save();
      }).then(function () { toast('Fotoja u ndryshua ✓'); })
        .catch(function (err) { if (err.status === 401) return showLogin(); toast('Ngarkimi dështoi: ' + err.message, true); });
    });
  }

  var fx = null;
  function drawFocus() {
    var img = $('#focusImg');
    img.style.objectPosition = fx.x + '% ' + fx.y + '%';
    img.style.transformOrigin = fx.x + '% ' + fx.y + '%';
    img.style.transform = 'scale(' + fx.zoom + ')';
    $('#focusX').value = fx.x; $('#focusY').value = fx.y; $('#focusZ').value = fx.zoom;
    $('#focusXv').textContent = Math.round(fx.x) + '%'; $('#focusYv').textContent = Math.round(fx.y) + '%';
    $('#focusZv').textContent = Math.round(fx.zoom * 100) + '%';
  }
  function openFocus(btn) {
    var name = btn.dataset.adjust, ratio = +btn.dataset.ratio || 1, f = focusOf(name);
    fx = { name: name, x: f.x, y: f.y, zoom: f.zoom };
    $('#focusTitle').textContent = btn.dataset.label;
    var frame = $('#focusFrame');
    frame.className = 'focus__frame' + (btn.dataset.shape ? ' focus__frame--' + btn.dataset.shape : '');

    frame.style.aspectRatio = String(ratio);
    frame.style.width = 'min(640px, 100%, calc(45vh * ' + ratio + '))';
    frame.style.height = 'auto';
    $('#focusImg').src = imgUrl(name);
    drawFocus();
    $('#focusDlg').showModal();
  }
  function bindFocus() {
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-adjust]'); if (b) openFocus(b); });
    ['X', 'Y', 'Z'].forEach(function (k) {
      $('#focus' + k).addEventListener('input', function (e) {
        var v = +e.target.value; if (k === 'X') fx.x = v; else if (k === 'Y') fx.y = v; else fx.zoom = v; drawFocus();
      });
    });
    var frame = $('#focusFrame'), drag = null;
    frame.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, fx: fx.x, fy: fx.y }; frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
    });
    frame.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = frame.getBoundingClientRect(), k = 1.4 / fx.zoom;

      fx.x = Math.max(0, Math.min(100, drag.fx - (e.clientX - drag.x) / r.width * 100 * k));
      fx.y = Math.max(0, Math.min(100, drag.fy - (e.clientY - drag.y) / r.height * 100 * k));
      drawFocus();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { frame.addEventListener(t, function () { drag = null; frame.classList.remove('dragging'); }); });
    $('#focusReset').addEventListener('click', function () { fx.x = 50; fx.y = 50; fx.zoom = 1; drawFocus(); });
    $('#focusCancel').addEventListener('click', function () { $('#focusDlg').close(); });
    $('#focusSave').addEventListener('click', function () {
      C.imageFocus = C.imageFocus || {};
      if (fx.x === 50 && fx.y === 50 && fx.zoom === 1) delete C.imageFocus[fx.name];
      else C.imageFocus[fx.name] = { x: Math.round(fx.x * 10) / 10, y: Math.round(fx.y * 10) / 10, zoom: Math.round(fx.zoom * 100) / 100 };
      $('#focusDlg').close(); renderPhotos(); renderWork();
      save().then(function () { if (!dirty) toast('Pozicioni u ruajt ✓'); });
    });
  }

  function bindSecurity() {
    $('#pwForm').addEventListener('submit', function (e) {
      e.preventDefault();
      api('POST', '/api/password', { current: $('#pwCur').value, next: $('#pwNew').value }).then(function () {
        $('#pwForm').reset(); toast('Fjalëkalimi u ndryshua ✓');
      }).catch(function (err) { toast(err.message, true); });
    });
    $('#logoutBtn').addEventListener('click', function () {
      if (dirty && !confirm('Ke ndryshime të paruajtura. Të dalësh gjithsesi?')) return;
      api('POST', '/api/logout', {}).finally(function () { dirty = false; location.reload(); });
    });
  }

  function showLogin() {
    $('#app').hidden = true; $('#login').hidden = false; $('#loginPw').focus();
  }
  function startApp() {
    return fetch('../data/content.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
      C = c; C.text = C.text || {}; C.ui = C.ui || { en: {}, sq: {} }; C.schedule = C.schedule || {}; C.services = C.services || [];
      $('#login').hidden = true; $('#app').hidden = false;
      render(); markClean();
      var tab = null; try { tab = sessionStorage.getItem('rm-admin-tab'); } catch (e) {   }
      showTab(TITLES[tab] ? tab : 'calendar');
    });
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); $('#loginErr').textContent = '';
    api('POST', '/api/login', { password: $('#loginPw').value }).then(function () {
      $('#loginPw').value = ''; return startApp();
    }).catch(function (err) { $('#loginErr').textContent = err.message; });
  });
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('#saveBtn').addEventListener('click', save);
  $('#textSearch').addEventListener('input', renderTexts);
  document.addEventListener('input', onField);
  document.addEventListener('change', function (e) { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') onField(e); });
  document.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (dirty) save(); } });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  bindCalendar(); bindServices(); bindReviews(); bindUploads(); bindFocus(); bindSecurity();

  api('GET', '/api/session').then(function (s) { return s.authed ? startApp() : showLogin(); })
    .catch(function () { showLogin(); $('#loginErr').textContent = 'Serveri nuk po përgjigjet. Hape faqen me “node server.js”.'; });
})();
