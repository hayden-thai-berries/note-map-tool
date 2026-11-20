/* Edit the map with a form instead of Markdown: click a card, section or department on the map and change it here.
 * Every change edits the parsed model, writes it back to the Markdown text (serialize.js) and redraws the map.
 * Saving stays with the Save button in editor.js. */
(function(App){
  var S = App.S, $ = App.$, el = App.el;
  var root = $('mform'), ed = $('ed'), checked = false, skipFill = false, wantFocus = false;
  var HOWS = ['IMPORTRANGE', 'manual copy', 'connector', 'CSV import', 'Apps Script'];

  function active(){ return !$('editor').hidden && !root.hidden; }
  function say(t){ $('status').textContent = t || ''; }
  function clean(v){ return String(v).replace(/[|\r\n]/g, ' ').trim(); }
  function secKey(di, si){ return 'sec:' + di + ':' + si; }
  function sheetNames(){
    var r = [];
    S.model.depts.forEach(function(d){ App.deptNodes(d).forEach(function(n){ r.push(n.name); }); });
    S.model.apps.forEach(function(n){ r.push(n.name); });
    return r;
  }
  function unique(base){
    var n = base, i = 1;
    while (S.nodeEls[n.toLowerCase()]) n = base + ' ' + (++i);
    return n;
  }
  function newNode(kind, name, dept){
    return { name: name, key: name.toLowerCase(), kind: kind, url: null, crit: null, details: '', parts: [], note: '', dept: dept };
  }

  /* where a card, section or department sits in the model */
  function whereNode(n){
    var d, s, i;
    for (d = 0; d < S.model.depts.length; d++) for (s = 0; s < S.model.depts[d].sections.length; s++) {
      i = S.model.depts[d].sections[s].nodes.indexOf(n);
      if (i >= 0) return { list: S.model.depts[d].sections[s].nodes, i: i, di: d, si: s };
    }
    i = S.model.apps.indexOf(n);
    return i >= 0 ? { list: S.model.apps, i: i } : null;
  }
  function whereSec(sc){
    for (var d = 0; d < S.model.depts.length; d++) { var i = S.model.depts[d].sections.indexOf(sc); if (i >= 0) return { di: d, si: i }; }
    return null;
  }

  /* run one change: confirm once if the file holds things the form would lose, edit the model, write it back, redraw.
   * fn gets the model and may return the key to select afterwards (null = nothing). opts.keep leaves the form alone so typing is not interrupted. */
  function edit(fn, opts){
    if (!checked) {
      if (App.mapLossy(ed.value) && !confirm('This file has comments or lines the form cannot keep. Editing here will drop them (the previous file is kept as ' + S.param + '.bak once you save). Continue?')) { fill(); return; }
      checked = true;
    }
    var r = fn(S.model), text = App.stringify(S.model);
    ed.value = text;
    say('Unsaved changes. Press Save to keep them.');
    App.render(text);
    skipFill = !!(opts && opts.keep);
    App.select(r === undefined ? null : r);
    skipFill = false;
  }

  function dropLinks(name){
    var key = name.toLowerCase(), before = S.model.links.length;
    S.model.links = S.model.links.filter(function(l){ return l.from.toLowerCase() !== key && l.to.toLowerCase() !== key; });
    return before - S.model.links.length;
  }
  function renameNode(n, v){
    var oldKey = n.key, key = v.toLowerCase(), moved = false;
    S.model.links.forEach(function(l){
      if (l.from.toLowerCase() === oldKey) l.from = v;
      if (l.to.toLowerCase() === oldKey) l.to = v;
    });
    S.tdata.tickets.forEach(function(t){ if (t.target === oldKey) { t.target = key; moved = true; } });
    n.name = v; n.key = key;
    if (moved) retargeted();
  }
  /* ticket targets were renamed: redraw the board and save once typing pauses */
  var tixTimer = null;
  function retargeted(){
    App.renderBoard();
    clearTimeout(tixTimer); tixTimer = setTimeout(App.saveTickets, 600);
  }
  function removeNode(n){
    var w = whereNode(n), gone = dropLinks(n.name);
    w.list.splice(w.i, 1);
    if (gone) say(gone + ' link' + (gone > 1 ? 's' : '') + ' to ' + n.name + ' removed.');
  }

  /* ---------- small form pieces ---------- */
  function field(label, input){
    var l = el('label', null, label); l.appendChild(input); return l;
  }
  function text(value, onChange, type){
    var i = el('input'); i.type = type || 'text'; i.value = value || '';
    i.addEventListener('input', function(){ onChange(i.value); });
    return i;
  }
  function area(value, onChange, rows){
    var a = el('textarea'); a.value = value || ''; a.rows = rows || 3; a.spellcheck = true;
    a.addEventListener('input', function(){ onChange(a.value); });
    return a;
  }
  function btn(label, fn, extra){
    var b = el('button', 'btn' + (extra ? ' ' + extra : ''), label); b.type = 'button';
    if (/\boff\b/.test(extra || '')) b.disabled = true;
    b.addEventListener('click', fn); return b;
  }
  function row(){ var r = el('div', 'mrow'); Array.prototype.slice.call(arguments).forEach(function(c){ if (c) r.appendChild(c); }); return r; }
  function select(options, value, onChange){
    var s = el('select');
    options.forEach(function(o){ var op = el('option', null, o.label); op.value = o.value; if (o.value === value) op.selected = true; s.appendChild(op); });
    s.addEventListener('change', function(){ onChange(s.value); });
    return s;
  }

  /* ---------- forms per kind ---------- */
  function nodeForm(it){
    var n = it, w = whereNode(n), f = el('div', 'mbox');
    f.appendChild(el('h3', null, n.kind === 'app' ? 'Connected app' : 'Sheet in ' + (n.dept || '')));
    var name = text(n.name, function(v){
      if (!clean(v)) return;
      edit(function(){ renameNode(n, clean(v)); return n.key; }, { keep: true });
      refreshLinks();
    });
    name.id = 'mfName';
    f.appendChild(field('Name', name));
    f.appendChild(field(n.kind === 'app' ? 'What it does' : 'Owner or details', text(n.details, function(v){
      edit(function(){ n.details = clean(v); n.parts = n.details ? [n.details] : []; return n.key; }, { keep: true });
    })));
    var cr = el('div', 'seg'); cr.setAttribute('role', 'group'); cr.setAttribute('aria-label', 'Criticality');
    [['', 'None'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']].forEach(function(c){
      var b = el('button', null, c[1]); b.type = 'button'; b.setAttribute('aria-pressed', String((n.crit || '') === c[0]));
      b.addEventListener('click', function(){ edit(function(){ n.crit = c[0] || null; return n.key; }); });
      cr.appendChild(b);
    });
    var cl = el('div', 'lbl', 'Criticality'); f.appendChild(cl); f.appendChild(cr);
    f.appendChild(field('Link (URL)', text(n.url, function(v){
      edit(function(){ n.url = /^https?:\/\//i.test(v.trim()) ? clean(v) : null; return n.key; }, { keep: true });
    }, 'url')));
    f.appendChild(field('Note', area(n.note, function(v){ edit(function(){ n.note = v.trim(); return n.key; }, { keep: true }); }, 4)));
    var mv = null;
    if (n.kind !== 'app') {
      var opts = [];
      S.model.depts.forEach(function(d, di){ d.sections.forEach(function(sc, si){ opts.push({ value: di + ':' + si, label: d.name + (sc.title ? ' › ' + sc.title : '') }); }); });
      mv = field('Move to', select(opts, w.di + ':' + w.si, function(v){
        var p = v.split(':'), to = S.model.depts[+p[0]];
        edit(function(){ removeFrom(n); to.sections[+p[1]].nodes.push(n); n.dept = to.name; return n.key; });
      }));
    }
    f.appendChild(mv || el('span'));
    f.appendChild(row(
      btn('↑ Up', function(){ shift(w.list, w.i, -1, n.key); }, w.i === 0 ? 'off' : ''),
      btn('↓ Down', function(){ shift(w.list, w.i, 1, n.key); }, w.i === w.list.length - 1 ? 'off' : ''),
      btn('Delete', function(){ edit(function(){ removeNode(n); return null; }); }, 'danger')));
    return f;
  }
  function removeFrom(n){ var w = whereNode(n); w.list.splice(w.i, 1); }
  function shift(list, i, d, key){
    var j = i + d;
    if (j < 0 || j >= list.length) return;
    edit(function(){ var t = list[i]; list[i] = list[j]; list[j] = t; return typeof key === 'function' ? key(j) : key; });
  }

  function sectionForm(it){
    var sc = it.ref, w = whereSec(sc), dp = S.model.depts[w.di], f = el('div', 'mbox');
    f.appendChild(el('h3', null, 'Section in ' + dp.name));
    var title = text(sc.title, function(v){ edit(function(){ sc.title = clean(v); return secKey(w.di, w.si); }, { keep: true }); });
    title.id = 'mfName';
    f.appendChild(field('Title', title));
    f.appendChild(field('Note', area(sc.note, function(v){ edit(function(){ sc.note = v.trim(); return secKey(w.di, w.si); }, { keep: true }); }, 4)));
    var prevPlain = w.si > 0 && dp.sections[w.si - 1].title == null;
    f.appendChild(row(
      btn('↑ Up', function(){ shift(dp.sections, w.si, -1, function(j){ return secKey(w.di, j); }); }, w.si === 0 || prevPlain ? 'off' : ''),
      btn('↓ Down', function(){ shift(dp.sections, w.si, 1, function(j){ return secKey(w.di, j); }); }, w.si === dp.sections.length - 1 ? 'off' : ''),
      btn('+ Sheet', function(){ addSheet(sc, dp); })));
    f.appendChild(row(btn('Delete section', function(){
      if (sc.nodes.length && !confirm('Delete this section and its ' + sc.nodes.length + ' sheet(s)? Links to them are removed too.')) return;
      edit(function(){ sc.nodes.slice().forEach(removeNode); dp.sections.splice(w.si, 1); return null; });
    }, 'danger')));
    return f;
  }

  function deptForm(it){
    var dp = it.ref, di = S.model.depts.indexOf(dp), f = el('div', 'mbox'), dkey = 'edept:' + di;
    f.appendChild(el('h3', null, 'Department'));
    var name = text(dp.name, function(v){
      if (!clean(v)) return;
      edit(function(){
        var moved = false;
        S.tdata.tickets.forEach(function(t){ if (t.target === 'dept:' + dp.name) { t.target = 'dept:' + clean(v); moved = true; } });
        dp.name = clean(v);
        dp.sections.forEach(function(sc){ sc.nodes.forEach(function(n){ n.dept = dp.name; }); });
        if (moved) retargeted();
        return dkey;
      }, { keep: true });
    });
    name.id = 'mfName';
    f.appendChild(field('Name', name));
    f.appendChild(field('Lines under the name (for example Lead: Ana)', area(dp.text.join('\n'), function(v){
      edit(function(){ dp.text = v.split('\n').map(function(l){ return l.trim(); }).filter(Boolean); return dkey; }, { keep: true });
    }, 3)));
    f.appendChild(row(
      btn('↑ Up', function(){ shift(S.model.depts, di, -1, function(j){ return 'edept:' + j; }); }, di === 0 ? 'off' : ''),
      btn('↓ Down', function(){ shift(S.model.depts, di, 1, function(j){ return 'edept:' + j; }); }, di === S.model.depts.length - 1 ? 'off' : ''),
      btn('+ Section', function(){
        edit(function(){ dp.sections.push({ title: 'New section', note: '', nodes: [] }); wantFocus = true; return secKey(di, dp.sections.length - 1); });
      })));
    f.appendChild(row(
      btn('+ Sheet', function(){ addSheet(dp.sections[dp.sections.length - 1], dp); }),
      btn('Delete department', function(){
        var n = App.deptNodes(dp).length;
        if (n && !confirm('Delete ' + dp.name + ' and its ' + n + ' sheet(s)? Links to them are removed too.')) return;
        edit(function(){ App.deptNodes(dp).forEach(removeNode); S.model.depts.splice(di, 1); return null; });
      }, 'danger')));
    return f;
  }

  function addSheet(sec, dp){
    edit(function(){
      if (!sec) { sec = { title: null, note: '', nodes: [] }; dp.sections.push(sec); }
      var n = newNode('sheet', unique('New sheet'), dp.name);
      sec.nodes.push(n); wantFocus = true;
      return n.key;
    });
  }

  /* ---------- links ---------- */
  function linkRow(l){
    var names = sheetNames().map(function(x){ return { value: x, label: x }; });
    function opts(cur){
      var o = names.slice();
      if (!names.some(function(x){ return x.value.toLowerCase() === cur.toLowerCase(); })) o.unshift({ value: cur, label: cur + ' (not on the map)' });
      return o;
    }
    function val(cur){ var m = names.filter(function(x){ return x.value.toLowerCase() === cur.toLowerCase(); })[0]; return m ? m.value : cur; }
    var r = el('div', 'mlink');
    r.appendChild(row(
      select(opts(l.from), val(l.from), function(v){ edit(function(){ l.from = v; return S.selected; }); }),
      el('span', 'arrow', '→'),
      select(opts(l.to), val(l.to), function(v){ edit(function(){ l.to = v; return S.selected; }); })));
    var how = text(l.label, function(v){ edit(function(){ l.label = v; return S.selected; }, { keep: true }); });
    how.setAttribute('list', 'mfHows'); how.placeholder = 'How (IMPORTRANGE, manual copy, ...)'; how.setAttribute('aria-label', 'How it is linked');
    r.appendChild(row(how, btn('Delete', function(){ edit(function(){ S.model.links.splice(S.model.links.indexOf(l), 1); return S.selected; }); }, 'danger')));
    return r;
  }
  function linksBox(){
    var f = el('div', 'mbox mlinks'), sel = S.selected && S.nodeEls[S.selected] ? S.items[S.selected] : null;
    f.appendChild(el('h3', null, sel ? 'Links of ' + sel.name : 'Links'));
    var dl = el('datalist'); dl.id = 'mfHows';
    HOWS.forEach(function(h){ var o = el('option'); o.value = h; dl.appendChild(o); });
    f.appendChild(dl);
    var n = 0;
    S.model.links.forEach(function(l){
      if (sel && l.from.toLowerCase() !== sel.key && l.to.toLowerCase() !== sel.key) return;
      f.appendChild(linkRow(l)); n++;
    });
    if (!n) f.appendChild(el('p', 'hint', sel ? 'No links yet.' : 'No links yet. Pick a card, then add one.'));
    var names = sheetNames();
    if (names.length > 1) f.appendChild(btn('+ Link' + (sel ? ' from ' + sel.name : ''), function(){
      var from = sel ? sel.name : names[0], to = names.filter(function(x){ return x.toLowerCase() !== from.toLowerCase(); })[0];
      edit(function(){ S.model.links.push({ from: from, to: to, label: '' }); return S.selected; });
    }));
    return f;
  }

  function refreshLinks(){
    var old = root.querySelector('.mlinks');
    if (old) old.replaceWith(linksBox());
  }

  /* ---------- the panel ---------- */
  function fill(){
    root.innerHTML = '';
    if (!active() || !S.model) return;
    var it = S.selected && S.items[S.selected], f;
    if (!it) {
      var g = el('div', 'mbox');
      g.appendChild(el('p', 'hint', 'Click a card, a section or a department name on the map to edit it.'));
      g.appendChild(row(
        btn('+ Department', function(){ edit(function(){ S.model.depts.push({ name: 'New department', sections: [], text: [] }); wantFocus = true; return 'edept:' + (S.model.depts.length - 1); }); }),
        btn('+ App', function(){ edit(function(){ var n = newNode('app', unique('New app'), null); S.model.apps.push(n); wantFocus = true; return n.key; }); })));
      root.appendChild(g);
    } else {
      f = it.kind === 'section' ? sectionForm(it) : it.kind === 'dept' ? deptForm(it) : nodeForm(it);
      root.appendChild(f);
    }
    root.appendChild(linksBox());
    if (wantFocus) { var i = $('mfName'); if (i) { i.focus(); i.select(); } wantFocus = false; }
  }

  function setMode(form){
    root.hidden = !form; ed.hidden = form; $('syntax').hidden = form;
    $('mfBtn').setAttribute('aria-pressed', String(form)); $('mtBtn').setAttribute('aria-pressed', String(!form));
    fill(); App.showDetail();
  }

  $('mfBtn').addEventListener('click', function(){ setMode(true); });
  $('mtBtn').addEventListener('click', function(){ setMode(false); });
  $('editBtn').addEventListener('click', function(){ fill(); App.showDetail(); });

  App.formActive = active;
  App.onSelect = function(){ if (!skipFill) fill(); };
  fill();
})(App);
