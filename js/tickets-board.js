/* Tickets tab views: summary strip, Kanban board, table, plus the filter bar and Board/Table switch. */
(function(App){
  var S = App.S, $ = App.$, el = App.el, STATUSES = App.STATUSES;

  try { if (localStorage.getItem('tview') === 'table') S.tview = 'table'; } catch (e) {}
  function setView(v){
    S.tview = v;
    try { localStorage.setItem('tview', v); } catch (e) {}
    renderBoard();
  }

  function tixBadge(c){
    var b = el('span', 'tix', String(c));
    b.title = c + ' open ticket' + (c > 1 ? 's' : ''); b.setAttribute('aria-label', b.title);
    return b;
  }
  function avatar(owner){ var a = el('span', 'av', App.initials(owner)); a.title = owner; return a; }
  /* chip in the map's own colours: green sheet, purple app, yellow department */
  function linkChip(t){
    if (!t.target) return null;
    var tn = App.targetName(t.target);
    if (tn === null) return el('span', 'chip orphan', 'unlinked');
    var cls = t.target.indexOf('dept:') === 0 ? 'dept' : (S.items[t.target].kind === 'app' ? 'app' : 'sheet');
    return el('span', 'chip ' + cls, tn);
  }
  function visibleTickets(){
    var q = $('fSearch').value.trim().toLowerCase(), ft = $('fType').value, fo = $('fOwner').value, fs = $('fStatus').value;
    return S.tdata.tickets.filter(function(t){
      if (ft && t.type !== ft) return false;
      if (fo && t.owner !== fo) return false;
      if (fs === 'open' && t.status === 'done') return false;
      if (!q) return true;
      var pj = App.projectOf(t);
      return [t.id, t.title, t.description, t.owner, App.targetName(t.target), t.notes, t.blocked, t.requestedBy, t.impact, pj && pj.title, pj && pj.id].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  /* status bar, counts, and one red line per blocked ticket */
  function renderSummary(){
    var box = $('tsum'), all = S.tdata.tickets;
    box.innerHTML = '';
    box.hidden = !all.length;
    if (!all.length) return;
    var seg = el('div', 'tseg'), leg = el('div', 'tleg');
    STATUSES.forEach(function(s){
      var c = all.filter(function(t){ return t.status === s[0]; }).length, sp = el('span');
      if (c) { var i = el('i', 'st-' + s[0]); i.style.flex = String(c); i.title = c + ' ' + s[1].toLowerCase(); seg.appendChild(i); }
      sp.appendChild(el('b', null, String(c))); sp.appendChild(document.createTextNode(' ' + s[1].toLowerCase()));
      leg.appendChild(sp);
    });
    var open = all.filter(function(t){ return t.status !== 'done'; }).length;
    leg.appendChild(el('span', 'sp'));
    var os = el('span'); os.appendChild(el('b', null, String(open))); os.appendChild(document.createTextNode(' of ' + all.length + ' open'));
    leg.appendChild(os);
    box.appendChild(seg); box.appendChild(leg);
    all.filter(function(t){ return t.status === 'blocked'; }).forEach(function(t){
      var b = el('button', 'tattn'); b.type = 'button';
      b.appendChild(el('b', null, 'Blocked'));
      b.appendChild(document.createTextNode(' ' + t.id + ' ' + t.title + (t.blocked ? ' · ' + t.blocked : '')));
      b.addEventListener('click', function(){ App.openForm(t.id); });
      box.appendChild(b);
    });
  }

  /* table view: grouped by department, with the status changeable in place */
  function groupOf(t){
    if (t.target && t.target.indexOf('dept:') === 0 && App.targetName(t.target)) return t.target.slice(5);
    var it = t.target && S.items[t.target];
    if (it && it.kind !== 'section') return it.kind === 'app' ? 'Connected apps' : it.dept;
    return 'Not linked';
  }
  function renderTable(list){
    var tb = $('ttable'); tb.innerHTML = '';
    if (!list.length) { tb.appendChild(el('p', 'kempty tpad', 'No tickets match.')); return; }
    var head = el('div', 'tr head');
    ['ID', 'Title', 'Linked to', 'Type', 'Owner', 'Status', 'Time', 'Updated'].forEach(function(h){ head.appendChild(el('span', null, h)); });
    tb.appendChild(head);
    var groups = {};
    list.forEach(function(t){ var g = groupOf(t); (groups[g] = groups[g] || []).push(t); });
    S.model.depts.map(function(d){ return d.name; }).concat(['Connected apps', 'Not linked']).forEach(function(g){
      if (!groups[g]) return;
      var rows = groups[g], nOpen = rows.filter(function(t){ return t.status !== 'done'; }).length, nDone = rows.length - nOpen;
      var gr = el('div', 'tr grp');
      gr.appendChild(el('span', 'chip dept', g));
      gr.appendChild(el('span', null, nOpen + ' open' + (nDone ? ', ' + nDone + ' done' : '')));
      tb.appendChild(gr);
      rows.forEach(function(t){ tb.appendChild(makeRow(t)); });
    });
  }
  function makeRow(t){
    var r = el('div', 'tr row' + (t.status === 'done' ? ' done' : '') + (t.id === S.editingId ? ' sel' : ''));
    r.tabIndex = 0; r.setAttribute('role', 'button');
    r.appendChild(el('span', 'id', t.id));
    var ttl = el('span', 'ttl', t.title);
    if (t.description) { var dl = el('small', 'd', t.description.split('\n')[0]); dl.title = t.description; ttl.appendChild(dl); }
    if (t.type === 'project') {
      var rs = App.projectStats(t);
      if (rs.total || rs.hours) ttl.appendChild(el('small', 'd', App.statsLine(rs)));
    } else if (App.projectOf(t)) {
      ttl.appendChild(el('small', 'd', '↳ ' + App.projectOf(t).id + ' ' + App.projectOf(t).title));
    }
    if (t.type === 'change' && t.decision) ttl.appendChild(el('small', 'd', 'Change request · ' + App.decisionLabel(t.decision) + (t.impact ? ' · ' + t.impact : '')));
    if (t.status === 'blocked' && t.blocked) ttl.appendChild(el('small', null, t.blocked));
    r.appendChild(ttl);
    var cell = el('span'), chip = linkChip(t);
    if (chip) cell.appendChild(chip);
    r.appendChild(cell);
    r.appendChild(el('span', 'kind', t.type));
    var ow = el('span'); if (t.owner) ow.appendChild(avatar(t.owner));
    r.appendChild(ow);
    var sel = el('select', 'stsel s-' + t.status);
    sel.setAttribute('aria-label', 'Status of ' + t.id);
    STATUSES.forEach(function(s){ var o = el('option', null, s[1]); o.value = s[0]; sel.appendChild(o); });
    sel.value = t.status;
    sel.addEventListener('click', function(ev){ ev.stopPropagation(); });
    sel.addEventListener('keydown', function(ev){ ev.stopPropagation(); });
    sel.addEventListener('change', function(){ t.status = sel.value; if (t.status !== 'blocked') t.blocked = ''; t.updated = App.today(); App.changed(); });
    var sc = el('span'); sc.appendChild(sel); r.appendChild(sc);
    r.appendChild(el('span', 'hrs', App.hoursOf(t) ? App.fmtH(App.hoursOf(t)) : ''));
    r.appendChild(el('span', 'upd', App.prettyDate(t.updated)));
    r.addEventListener('click', function(){ App.openForm(t.id); });
    r.addEventListener('keydown', function(ev){ if (ev.target === r && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); App.openForm(t.id); } });
    return r;
  }

  function renderBoard(){
    var owners = [];
    S.tdata.tickets.forEach(function(t){ if (t.owner && owners.indexOf(t.owner) < 0) owners.push(t.owner); });
    owners.sort();
    var fo = $('fOwner'), cur = fo.value;
    fo.innerHTML = '';
    var all = el('option', null, 'Everyone'); all.value = ''; fo.appendChild(all);
    owners.forEach(function(o){ var op = el('option', null, o); op.value = o; fo.appendChild(op); });
    fo.value = owners.indexOf(cur) >= 0 ? cur : '';
    renderSummary();
    $('kanban').hidden = S.tview !== 'board'; $('ttable').hidden = S.tview !== 'table';
    $('vBoard').setAttribute('aria-pressed', String(S.tview === 'board'));
    $('vTable').setAttribute('aria-pressed', String(S.tview === 'table'));
    var shown = visibleTickets();
    if (S.tview === 'table') { renderTable(shown); return; }
    var k = $('kanban'); k.innerHTML = '';
    STATUSES.forEach(function(s){
      var list = shown.filter(function(t){ return t.status === s[0]; });
      var col = el('section', 'kcol'), h = el('h3'), hl = el('span');
      hl.appendChild(el('i', 'dot st-' + s[0])); hl.appendChild(document.createTextNode(s[1]));
      h.appendChild(hl);
      h.appendChild(el('span', 'kcount', String(list.length)));
      col.appendChild(h);
      col.addEventListener('dragover', function(ev){ ev.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function(){ col.classList.remove('over'); });
      col.addEventListener('drop', function(ev){
        ev.preventDefault(); col.classList.remove('over');
        var t = App.findTicket(ev.dataTransfer.getData('text/plain'));
        if (t && t.status !== s[0]) { t.status = s[0]; t.updated = App.today(); App.changed(); }
      });
      if (!list.length) col.appendChild(el('p', 'kempty', 'Nothing here'));
      list.forEach(function(t){ col.appendChild(makeCard(t)); });
      k.appendChild(col);
    });
  }
  function makeCard(t){
    var c = el('div', 'tcard' + (t.status === 'blocked' ? ' blocked' : '') + (t.status === 'done' ? ' done' : '') + (t.id === S.editingId ? ' sel' : ''));
    c.tabIndex = 0; c.setAttribute('role', 'button'); c.draggable = true;
    var top = el('div', 'top2', t.id);
    var kindBox = el('span');
    if (t.type === 'change' && t.decision) kindBox.appendChild(el('span', 'dec ' + t.decision, App.decisionLabel(t.decision)));
    kindBox.appendChild(document.createTextNode(' '));
    kindBox.appendChild(el('span', 'kind', t.type));
    top.appendChild(kindBox);
    c.appendChild(top);
    var title = el('div', 'tt', t.title);
    if (t.url && /^https?:\/\//i.test(t.url)) {
      var a = el('a', null, '↗'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Open link');
      a.addEventListener('click', function(ev){ ev.stopPropagation(); });
      title.appendChild(a);
    }
    c.appendChild(title);
    if (t.description) c.appendChild(el('div', 'desc', t.description));
    if (t.type === 'project') {
      var ps = App.projectStats(t);
      if (ps.total || ps.hours) {
        var pj = el('div', 'pj', App.statsLine(ps));
        if (ps.total) { var bar = el('div', 'bar2'), fill = el('i'); fill.style.width = Math.round(ps.done / ps.total * 100) + '%'; bar.appendChild(fill); pj.appendChild(bar); }
        c.appendChild(pj);
      }
    } else if (App.projectOf(t)) {
      c.appendChild(el('div', 'inproj', '↳ ' + App.projectOf(t).id + ' ' + App.projectOf(t).title));
    }
    if (t.status === 'blocked' && t.blocked) c.appendChild(el('div', 'why', t.blocked));
    var meta = el('div', 'row2'), chip = linkChip(t);
    meta.appendChild(chip || el('span'));
    if (App.hoursOf(t)) meta.appendChild(el('span', 'hrs', '⏱ ' + App.fmtH(App.hoursOf(t))));
    if (t.owner) meta.appendChild(avatar(t.owner));
    c.appendChild(meta);
    c.addEventListener('click', function(){ App.openForm(t.id); });
    c.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); App.openForm(t.id); } });
    c.addEventListener('dragstart', function(ev){ ev.dataTransfer.setData('text/plain', t.id); ev.dataTransfer.effectAllowed = 'move'; });
    return c;
  }

  $('fType').addEventListener('change', renderBoard);
  $('fOwner').addEventListener('change', renderBoard);
  $('fStatus').addEventListener('change', renderBoard);
  $('fSearch').addEventListener('input', renderBoard);
  $('vBoard').addEventListener('click', function(){ setView('board'); });
  $('vTable').addEventListener('click', function(){ setView('table'); });

  App.renderBoard = renderBoard;
  App.tixBadge = tixBadge;
})(App);
