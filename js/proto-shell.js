/* PROTOTYPE (throwaway, lives on branch proto/ux-shell, never main).
 * Question: how should ONE app hold (1) the documentation Map, (2) Ticket/project tracking, (3) Business flows?
 * Three app-shell variants wrap the EXISTING views, switched by ?variant= (0 = current UI, A, B, C).
 * Read-only: nothing here saves. Fields that do not exist yet are marked "stub". */
(function(App){
  var S = App.S, $ = App.$, el = App.el;
  var ORDER = ['0', 'A', 'B', 'C'];
  var NAME = { '0': 'Current UI', A: 'Left rail', B: 'Entity lens', C: 'Hub + omnibox' };
  var v = new URLSearchParams(location.search).get('variant');
  if (ORDER.indexOf(v) < 0) v = 'A';
  document.body.classList.add('pv-' + v);

  /* ---------- shared helpers ---------- */
  function low(s){ return String(s || '').toLowerCase(); }
  function nodes(){ return Object.keys(S.items).map(function(k){ return S.items[k]; }).filter(function(n){ return n.kind === 'sheet' || n.kind === 'app'; }); }
  function tix(){ return S.tdata.tickets || []; }
  function openTix(){ return tix().filter(function(t){ return t.status !== 'done'; }); }
  function flows(){ try { return App.parseFlows(S.flowsMd); } catch (e) { return []; } }
  function where(){
    var idx = {};
    if (S.model) S.model.depts.forEach(function(d){ d.sections.forEach(function(sc){ sc.nodes.forEach(function(n){ idx[n.key] = { dept: d.name, sec: sc }; }); }); });
    return idx;
  }
  function ticketsFor(key){ return tix().filter(function(t){ return t.target === key; }); }
  function flowsFor(name){
    var out = [];
    flows().forEach(function(f, fi){ f.steps.forEach(function(st){ if (st.sheet && low(st.sheet) === low(name)) out.push({ f: f, fi: fi, st: st }); }); });
    return out;
  }
  function chip(text, cls){ return el('span', 'pvChip' + (cls ? ' ' + cls : ''), text); }
  function btn(cls, text, fn){ var b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function activeTab(){ return $('tabTix').getAttribute('aria-selected') === 'true' ? 'tickets' : $('tabFlows').getAttribute('aria-selected') === 'true' ? 'flows' : 'map'; }
  function fire(node){ node.dispatchEvent(new Event('change', { bubbles: true })); }

  /* navigation; variant C hooks onNav to leave its Home page */
  var onNav = function(){};
  function openSheet(key){ App.showTab('map'); App.select(key); var n = S.items[key]; if (n && n.el) n.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); onNav('map'); }
  function openTicket(id){ App.showTab('tickets'); App.openForm(id); onNav('tickets'); }
  function openFlow(i){ S.flowIdx = i; App.showTab('flows'); onNav('flows'); }

  /* ---------- floating variant switcher ---------- */
  function go(k){ var u = new URL(location.href); u.searchParams.set('variant', k); location.replace(u.toString()); }
  function switcher(){
    var bar = el('div', 'pvBar'); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Prototype variant');
    function step(d){ go(ORDER[(ORDER.indexOf(v) + d + ORDER.length) % ORDER.length]); }
    bar.appendChild(el('span', 'pvTag', 'PROTOTYPE'));
    bar.appendChild(btn('pvArrow', '‹', function(){ step(-1); })).setAttribute('aria-label', 'Previous variant');
    bar.appendChild(el('span', 'pvLab', v + ' · ' + NAME[v]));
    bar.appendChild(btn('pvArrow', '›', function(){ step(1); })).setAttribute('aria-label', 'Next variant');
    document.body.appendChild(bar);
    document.addEventListener('keydown', function(ev){
      var a = document.activeElement, tag = a && a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a && a.isContentEditable)) return;
      if (ev.key === 'ArrowLeft') step(-1); else if (ev.key === 'ArrowRight') step(1);
    });
  }

  /* ---------- A: left rail (workspaces on the left, context list under the active one) ---------- */
  function buildA(){
    var page = $('page'), top = page.querySelector('.top'), tabs = top.querySelector('.tabs'), btns = top.querySelector('.topBtns');
    var rail = el('aside', 'pvRail'), sub = el('div', 'pvSub');
    rail.appendChild(el('div', 'pvBrand', 'Sheets map'));
    rail.appendChild(btns);
    rail.appendChild(el('div', 'pvH', 'Workspaces'));
    rail.appendChild(tabs);
    rail.appendChild(sub);
    page.insertBefore(rail, page.firstChild);
    function badge(tab, n){ var b = tab.querySelector('small'); if (!b) { b = el('small'); tab.appendChild(b); } b.textContent = n; }
    function row(label, n, fn){
      var b = btn('pvRow', '', fn); b.appendChild(el('span', null, label));
      if (n !== '' && n != null) b.appendChild(el('small', null, n));
      sub.appendChild(b);
    }
    function setF(type, status){ $('fType').value = type; $('fStatus').value = status; fire($('fType')); fire($('fStatus')); }
    function refresh(){
      if (!S.model) return;
      badge($('tabMap'), nodes().length); badge($('tabTix'), openTix().length); badge($('tabFlows'), flows().length);
      sub.textContent = '';
      var a = activeTab();
      sub.appendChild(el('div', 'pvH', a === 'map' ? 'Departments' : a === 'tickets' ? 'Views' : 'Flows'));
      if (a === 'map') {
        S.model.depts.forEach(function(d, i){
          row(d.name, App.openFor('dept:' + d.name).length || '', function(){ var it = S.items['edept:' + i]; if (it) it.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        });
        if (S.model.apps.length) row('Connected apps', S.model.apps.length, function(){ var b = $('map').querySelector('.appsBox'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      } else if (a === 'tickets') {
        [['All items', '', '', tix().length], ['Open only', '', 'open', openTix().length], ['Projects', 'project', '', tix().filter(function(t){ return t.type === 'project'; }).length],
         ['Change requests', 'change', '', tix().filter(function(t){ return t.type === 'change'; }).length], ['Features', 'feature', '', tix().filter(function(t){ return t.type === 'feature'; }).length]
        ].forEach(function(r){ row(r[0], r[3], function(){ setF(r[1], r[2]); }); });
      } else {
        flows().forEach(function(f, i){ row(f.title, f.steps.length, function(){ $('fPick').value = i; fire($('fPick')); }); });
      }
    }
    [$('tabMap'), $('tabTix'), $('tabFlows')].forEach(function(b){ b.addEventListener('click', function(){ setTimeout(refresh, 0); }); });
    new MutationObserver(refresh).observe($('stats'), { childList: true });
    [0, 400, 1200].forEach(function(ms){ setTimeout(refresh, ms); });
  }

  /* ---------- B: entity lens (one sheet or app, seen through Docs / Tickets / Flows) ---------- */
  function buildB(){
    var page = $('page'), ins = el('aside', 'pvIns'), fk = new URLSearchParams(location.search).get('pick'), lens = 'docs', q = '', lastSel = null;
    page.appendChild(ins);
    function pick(k){ fk = k; lens = 'docs'; draw(); if (!$('mapView').hidden) App.select(k); }
    function field(label, body, stub){
      var d = el('div', 'pvF' + (stub ? ' stub' : '')); d.appendChild(el('div', 'pvFL', label + (stub ? ' (stub)' : '')));
      d.appendChild(typeof body === 'string' ? el('div', 'pvFV', body) : body);
      return d;
    }
    function links(list){
      var w = el('div', 'pvChips');
      if (!list.length) return el('div', 'pvFV muted', 'None recorded');
      list.forEach(function(l){ var b = btn('pvChip link', l.name + (l.label ? ' · ' + l.label : ''), function(){ pick(l.key); }); w.appendChild(b); });
      return w;
    }
    function catalog(dept, sec){
      ins.appendChild(el('div', 'pvH', dept || 'All sheets and apps'));
      if (sec && sec.note) ins.appendChild(el('p', 'pvNote', sec.name + ': ' + sec.note));
      var inp = el('input'); inp.type = 'search'; inp.placeholder = 'Find a sheet or app'; inp.value = q; inp.setAttribute('aria-label', 'Find a sheet or app');
      var list = el('div', 'pvList');
      function fill(){
        list.textContent = ''; var last = null;
        nodes().filter(function(n){ return (!dept || n.dept === dept) && low(n.name).indexOf(low(q)) >= 0; }).forEach(function(n){
          var g = n.dept || 'Apps';
          if (g !== last) { list.appendChild(el('div', 'pvGroup', g)); last = g; }
          var b = btn('pvRow', '', function(){ pick(n.key); }); b.appendChild(el('span', null, n.name));
          var open = App.openFor(n.key).length;
          if (open) b.appendChild(el('small', null, open + ' open'));
          if (n.crit) b.appendChild(el('span', 'pill ' + n.crit, n.crit));
          list.appendChild(b);
        });
      }
      inp.addEventListener('input', function(){ q = inp.value; fill(); });
      ins.appendChild(inp); ins.appendChild(list); fill();
    }
    function entity(n){
      var idx = where(), w = idx[n.key] || {}, t = ticketsFor(n.key), fl = flowsFor(n.name), L = S.model.links;
      var feeds = L.filter(function(l){ return low(l.from) === n.key; }).map(function(l){ return { key: low(l.to), name: l.to, label: l.label }; });
      var fedBy = L.filter(function(l){ return low(l.to) === n.key; }).map(function(l){ return { key: low(l.from), name: l.from, label: l.label }; });
      ins.appendChild(btn('pvBack', '← All sheets', function(){ fk = null; if (!$('mapView').hidden) App.select(null); draw(); }));
      var h = el('h3', 'pvName', n.name); ins.appendChild(h);
      var meta = el('div', 'pvChips'); meta.appendChild(chip(n.kind === 'app' ? 'Connected app' : 'Sheet'));
      if (n.crit) meta.appendChild(el('span', 'pill ' + n.crit, n.crit));
      if (n.url && /^https?:\/\//i.test(n.url)) { var a = el('a', 'pvChip link', 'Open ↗'); a.href = n.url; a.target = '_blank'; a.rel = 'noopener'; meta.appendChild(a); }
      ins.appendChild(meta);
      ins.appendChild(el('div', 'pvCrumbS', (w.dept || 'No department') + (w.sec && w.sec.title ? ' › ' + w.sec.title : '')));
      var seg = el('div', 'pvSeg'); seg.setAttribute('role', 'group');
      [['docs', 'Docs'], ['tickets', 'Tickets ' + t.length], ['flows', 'Flows ' + fl.length]].forEach(function(l){
        var b = btn('', l[1], function(){ lens = l[0]; draw(); }); b.setAttribute('aria-pressed', String(lens === l[0])); seg.appendChild(b);
      });
      ins.appendChild(seg);
      if (lens === 'docs') {
        var owner = n.parts && n.parts[0];
        ins.appendChild(field('What it is', n.note || n.details || 'No description yet.'));
        ins.appendChild(field('Who uses it', [owner, w.dept && w.dept + ' team'].filter(Boolean).join(' · ') || 'Not recorded'));
        var teams = {}; fl.forEach(function(x){ teams[x.st.team] = 1; });
        var needs = el('div'); needs.appendChild(links(feeds));
        if (Object.keys(teams).length) needs.appendChild(el('div', 'pvFV muted', 'Used in flows by: ' + Object.keys(teams).join(', ')));
        ins.appendChild(field('Who needs it (feeds)', needs));
        ins.appendChild(field('Fed by', links(fedBy)));
        ins.appendChild(field('What it is for', 'This would be a new field: the one-line purpose, in business words.', true));
        if (w.sec && w.sec.note) ins.appendChild(field('Procedure: ' + (w.sec.title || ''), w.sec.note));
      } else if (lens === 'tickets') {
        if (!t.length) ins.appendChild(el('p', 'pvNote', 'No ticket or project points at this ' + n.kind + '.'));
        t.forEach(function(x){
          var b = btn('pvRow tall', '', function(){ openTicket(x.id); }); var l = el('span'); l.appendChild(el('code', null, x.id)); l.appendChild(document.createTextNode(' ' + x.title)); b.appendChild(l);
          b.appendChild(chip(App.statusLabel(x.status) + (x.owner ? ' · ' + x.owner : ''), 's-' + x.status)); ins.appendChild(b);
        });
      } else {
        if (!fl.length) ins.appendChild(el('p', 'pvNote', 'No business flow has a step on this ' + n.kind + '.'));
        fl.forEach(function(x){
          var b = btn('pvRow tall', '', function(){ openFlow(x.fi); }); var l = el('span'); l.appendChild(el('b', null, x.f.title)); l.appendChild(document.createTextNode(' › ' + x.st.title)); b.appendChild(l);
          b.appendChild(chip(x.st.team + (x.st.day ? ' · ' + x.st.day : ''))); ins.appendChild(b);
        });
      }
    }
    function draw(){
      if (!S.model) return;
      ins.textContent = '';
      var n = fk && S.items[fk];
      if (!n) catalog(null);
      else if (n.kind === 'dept') catalog(n.name);
      else if (n.kind === 'section') catalog(n.dept, n);
      else entity(n);
    }
    /* follow the map selection, and open the matching lens when the workspace changes */
    setInterval(function(){
      if (!$('mapView').hidden && S.selected !== lastSel) { lastSel = S.selected; fk = S.selected; lens = 'docs'; draw(); }
    }, 200);
    [['tabMap', 'docs'], ['tabTix', 'tickets'], ['tabFlows', 'flows']].forEach(function(p){
      $(p[0]).addEventListener('click', function(){ setTimeout(function(){ if (fk && S.items[fk] && S.items[fk].name) { lens = p[1]; draw(); } }, 0); });
    });
    new MutationObserver(draw).observe($('stats'), { childList: true });
    [0, 400, 1200].forEach(function(ms){ setTimeout(draw, ms); });
  }

  /* ---------- C: hub + omnibox (Home with three doors, breadcrumb, jump-to search) ---------- */
  function buildC(){
    var page = $('page'), top = page.querySelector('.top'), tabs = top.querySelector('.tabs'), btns = top.querySelector('.topBtns');
    var home = el('section', 'pvHome'), crumb = el('nav', 'pvCrumb'), cur = 'home';
    var LABEL = { map: 'Map', tickets: 'Tickets', flows: 'Flows' };
    tabs.hidden = true;
    top.firstElementChild.insertBefore(crumb, top.firstElementChild.firstChild);
    top.insertAdjacentElement('afterend', home);

    function drawCrumb(){
      crumb.textContent = '';
      crumb.appendChild(btn('pvHomeBtn', '⌂ Home', function(){ show('home'); })).setAttribute('aria-current', String(cur === 'home'));
      if (cur !== 'home') { crumb.appendChild(el('span', 'pvSep', '›')); crumb.appendChild(el('span', 'pvHere', LABEL[cur])); }
    }
    function show(name){
      cur = name;
      if (name === 'home') {
        $('mapView').hidden = $('board').hidden = $('flowsView').hidden = true; home.hidden = false; $('editBtn').hidden = true;
        App.select(null); App.closeForm(); drawHome();
      } else { home.hidden = true; App.showTab(name); }
      drawCrumb();
    }
    onNav = function(name){ home.hidden = true; cur = name; drawCrumb(); };

    function door(kicker, big, subtitle, rows, name){
      var d = el('article', 'pvDoor');
      d.appendChild(el('h2', null, kicker)); d.appendChild(el('div', 'pvBig', big)); d.appendChild(el('p', 'pvSubT', subtitle));
      var ul = el('ul', 'pvRows');
      rows.forEach(function(r){ var li = el('li'); var b = btn('pvRow', '', r[2]); b.appendChild(el('span', null, r[0])); if (r[1]) b.appendChild(el('small', null, r[1])); li.appendChild(b); ul.appendChild(li); });
      if (!rows.length) ul.appendChild(el('li', 'muted', 'Nothing yet'));
      d.appendChild(ul); d.appendChild(btn('btn', 'Open ' + LABEL[name] + ' →', function(){ show(name); }));
      return d;
    }
    function drawHome(){
      if (!S.model) return;
      home.textContent = '';
      var ns = nodes(), sheets = ns.filter(function(n){ return n.kind === 'sheet'; }), ft = flows(), open = openTix(), blocked = open.filter(function(t){ return t.status === 'blocked'; });
      var teams = {}; ft.forEach(function(f){ f.teams.forEach(function(t){ teams[t] = 1; }); });
      var doors = el('div', 'pvDoors');
      doors.appendChild(door('Documentation', sheets.length + ' sheets', S.model.depts.length + ' departments · ' + S.model.apps.length + ' apps · ' + S.model.links.length + ' links',
        sheets.filter(function(n){ return n.crit === 'high'; }).slice(0, 5).map(function(n){ return [n.name, n.dept, function(){ openSheet(n.key); }]; }), 'map'));
      var hot = blocked.concat(App.byPriority(open.filter(function(t){ return t.status !== 'blocked'; }))).slice(0, 5);
      doors.appendChild(door('Work', open.length + ' open', blocked.length + ' blocked · ' + open.filter(function(t){ return t.type === 'project'; }).length + ' projects running',
        hot.map(function(t){ return [t.title, (t.owner || '') + ' · ' + App.statusLabel(t.status), function(){ openTicket(t.id); }]; }), 'tickets'));
      doors.appendChild(door('Business flows', ft.length + (ft.length === 1 ? ' flow' : ' flows'), Object.keys(teams).length + ' teams involved',
        ft.map(function(f, i){ return [f.title, f.every || '', function(){ openFlow(i); }]; }), 'flows'));
      home.appendChild(doors);
      var attn = [];
      S.model.links.filter(function(l){ return /manual/i.test(l.label); }).forEach(function(l){ attn.push(['Manual copy', l.from + ' → ' + l.to, function(){ openSheet(low(l.from)); }]); });
      blocked.forEach(function(t){ attn.push(['Blocked', t.title + (t.blocked ? ' — ' + t.blocked : ''), function(){ openTicket(t.id); }]); });
      if (attn.length) {
        var box = el('section', 'pvAttn'); box.appendChild(el('h2', null, 'Needs attention'));
        attn.forEach(function(a){ var b = btn('pvRow', '', a[2]); b.appendChild(chip(a[0], a[0] === 'Blocked' ? 's-blocked' : '')); b.appendChild(el('span', null, a[1])); box.appendChild(b); });
        home.appendChild(box);
      }
    }

    /* omnibox */
    var omni = el('div', 'pvOmni'), inp = el('input'), res = el('ul', 'pvRes'), items = [], act = 0;
    inp.type = 'search'; inp.placeholder = 'Jump to a sheet, ticket or flow   ( / )'; inp.setAttribute('aria-label', 'Jump to a sheet, ticket or flow');
    res.hidden = true; omni.appendChild(inp); omni.appendChild(res); btns.insertBefore(omni, btns.firstChild);
    function results(s){
      s = low(s).trim(); var out = [];
      if (!s) return out;
      nodes().forEach(function(n){ if (low(n.name).indexOf(s) >= 0) out.push([n.kind === 'app' ? 'App' : 'Sheet', n.name, n.dept || '', function(){ openSheet(n.key); }]); });
      tix().forEach(function(t){ if ((low(t.title) + ' ' + low(t.id)).indexOf(s) >= 0) out.push(['Ticket', t.title, t.id + ' · ' + App.statusLabel(t.status), function(){ openTicket(t.id); }]); });
      flows().forEach(function(f, i){ if (low(f.title).indexOf(s) >= 0) out.push(['Flow', f.title, f.every || '', function(){ openFlow(i); }]); });
      return out.slice(0, 9);
    }
    function paint(){
      res.textContent = ''; items = results(inp.value); act = Math.min(act, Math.max(0, items.length - 1)); res.hidden = !items.length;
      items.forEach(function(r, i){
        var li = el('li'); var b = btn('pvRow' + (i === act ? ' act' : ''), '', function(){ pickRes(i); });
        b.appendChild(chip(r[0])); b.appendChild(el('span', null, r[1])); if (r[2]) b.appendChild(el('small', null, r[2])); li.appendChild(b); res.appendChild(li);
      });
    }
    function pickRes(i){ var r = items[i]; if (!r) return; inp.value = ''; res.hidden = true; inp.blur(); r[3](); }
    inp.addEventListener('input', function(){ act = 0; paint(); });
    inp.addEventListener('keydown', function(ev){
      if (ev.key === 'ArrowDown') { act = Math.min(act + 1, items.length - 1); paint(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { act = Math.max(act - 1, 0); paint(); ev.preventDefault(); }
      else if (ev.key === 'Enter') pickRes(act);
      else if (ev.key === 'Escape') { inp.value = ''; paint(); inp.blur(); }
    });
    document.addEventListener('click', function(ev){ if (!omni.contains(ev.target)) res.hidden = true; });
    document.addEventListener('keydown', function(ev){
      var a = document.activeElement, tag = a && a.tagName;
      if ((ev.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') || ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k')) { ev.preventDefault(); inp.focus(); }
    });

    /* start on Home unless the URL asked for a tab */
    cur = location.hash === '#tickets' ? 'tickets' : location.hash === '#flows' ? 'flows' : 'home';
    if (cur === 'home') show('home'); else { home.hidden = true; drawCrumb(); }
    new MutationObserver(function(){ if (cur === 'home') drawHome(); }).observe($('stats'), { childList: true });
    [400, 1200].forEach(function(ms){ setTimeout(function(){ if (cur === 'home') drawHome(); }, ms); });
  }

  switcher();
  if (v === 'A') buildA(); else if (v === 'B') buildB(); else if (v === 'C') buildC();
})(App);
