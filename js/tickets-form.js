/* Ticket drawer form (create, edit, delete, time log, project items) and the
 * "Add a ticket to <item>" row in the map's detail panel. */
(function(App){
  var S = App.S, $ = App.$, el = App.el;

  /* "Add a ticket to <item>" row: creates a ticket already linked to the selected sheet or app */
  function quickAdd(key, it, value){
    var f = el('form', 'quick'), inp = el('input'), add = el('button', 'btn primary', 'Add'), more = el('button', 'btn', 'More…');
    inp.type = 'text'; inp.maxLength = 200; inp.value = value || '';
    inp.placeholder = 'Add a ticket to ' + it.name + '…';
    inp.setAttribute('aria-label', 'New ticket title for ' + it.name);
    add.type = 'submit'; more.type = 'button'; more.title = 'Add with owner, link and notes';
    f.appendChild(inp); f.appendChild(add); f.appendChild(more);
    f.addEventListener('submit', function(ev){
      ev.preventDefault();
      var title = inp.value.trim();
      if (!title) { inp.focus(); return; }
      var t = { id: App.newId('ticket'), title: title, type: 'ticket', status: 'todo', owner: '', url: '', target: key, notes: '', blocked: '', updated: App.today() };
      S.tdata.tickets.push(t);
      inp.value = '';
      App.changed(); App.select(key);
      S.detailNote = 'Added ' + t.id + '.'; App.showDetail();
    });
    more.addEventListener('click', function(){ App.showTab('tickets'); openForm(null, key); });
    return f;
  }

  function fillTargets(current){
    var sel = $('tTarget'); sel.innerHTML = '';
    function opt(parent, v, label){ var o = el('option', null, label); o.value = v; parent.appendChild(o); }
    function group(label){ var g = document.createElement('optgroup'); g.label = label; sel.appendChild(g); return g; }
    opt(sel, '', 'Not linked');
    S.model.depts.forEach(function(d){
      var g = group(d.name);
      opt(g, 'dept:' + d.name, 'Whole department');
      App.deptNodes(d).forEach(function(n){ opt(g, n.key, n.name); });
    });
    if (S.model.apps.length) {
      var ga = group('Connected apps');
      S.model.apps.forEach(function(n){ opt(ga, n.key, n.name); });
    }
    if (current && App.targetName(current) === null) opt(sel, current, current + ' (not on the map)');
    sel.value = current || '';
  }
  function fillProjects(current, selfId){
    var sel = $('tProject'); sel.innerHTML = '';
    function opt(v, label){ var o = el('option', null, label); o.value = v; sel.appendChild(o); }
    opt('', 'None');
    S.tdata.tickets.forEach(function(p){ if (p.type === 'project' && p.id !== selfId) opt(p.id, p.id + ' · ' + p.title); });
    if (current && !App.projectOf({ project: current })) opt(current, current + ' (not a project)');
    sel.value = current || '';
  }
  /* show the fields that belong to the chosen type */
  function syncKindUI(){
    var type = $('tType').value, t = S.editingId && App.findTicket(S.editingId);
    $('tProjectRow').hidden = type === 'project';
    $('tReqBox').hidden = type !== 'change';
    var showItems = !!t && t.type === 'project' && type === 'project';
    $('tItemsBox').hidden = !showItems;
    if (showItems) renderItems(t);
  }
  function renderItems(p){
    var ul = $('tItems'), its = App.itemsOf(p), st = App.projectStats(p);
    ul.innerHTML = '';
    $('tItemsSum').textContent = App.statsLine(st) || 'none yet';
    its.forEach(function(x){
      var li = el('li'), b = el('button'); b.type = 'button';
      b.appendChild(el('span', 'k', x.type));
      b.appendChild(el('span', 'n', x.id + ' ' + x.title));
      var s = App.statusLabel(x.status) + (x.type === 'change' && x.decision ? ' · ' + App.decisionLabel(x.decision) : '');
      b.appendChild(el('span', 's', s));
      b.addEventListener('click', function(){ openForm(x.id); });
      li.appendChild(b); ul.appendChild(li);
    });
  }

  function openForm(id, target, preset){
    var t = id ? App.findTicket(id) : null;
    preset = preset || {};
    S.editingId = t ? t.id : null;
    $('tformTitle').textContent = t ? t.id + ' · Edit' : 'New ' + (preset.type === 'change' ? 'change request' : preset.type || 'ticket');
    $('tTitle').value = t ? t.title : '';
    $('tDesc').value = t ? t.description || '' : '';
    $('tType').value = t ? t.type : preset.type || 'ticket';
    fillProjects(t ? t.project : preset.project || '', t ? t.id : null);
    $('tReqBy').value = t ? t.requestedBy || '' : '';
    $('tReqOn').value = t ? t.requested || '' : App.today();
    $('tImpact').value = t ? t.impact || '' : '';
    $('tDecision').value = t && t.decision ? t.decision : 'proposed';
    syncKindUI();
    setFormStatus(t ? t.status : 'todo');
    $('tBlocked').value = t ? t.blocked || '' : '';
    $('tOwner').value = t ? t.owner || '' : '';
    $('tUrl').value = t ? t.url || '' : '';
    $('tNotes').value = t ? t.notes || '' : '';
    fillTargets(t ? t.target : target || '');
    $('tDelete').hidden = !t;
    $('timeBox').hidden = !t; $('tHours').value = ''; $('tLogNote').value = '';
    if (t) renderLog(t);
    $('tform').hidden = false; $('tlayout').classList.add('open');
    App.renderBoard();
    $('tTitle').focus();
  }
  function closeForm(){ $('tform').hidden = true; $('tlayout').classList.remove('open'); S.editingId = null; App.renderBoard(); }

  /* ---------- status radios ---------- */
  function getFormStatus(){ var r = document.querySelector('#tform input[name="tStatus"]:checked'); return r ? r.value : 'todo'; }
  function syncStatusUI(){
    var cur = getFormStatus();
    Array.prototype.forEach.call(document.querySelectorAll('#tform .seg4 label'), function(l){ l.classList.toggle('on', l.querySelector('input').value === cur); });
    $('tBlockedRow').hidden = cur !== 'blocked';
  }
  function setFormStatus(s){ document.querySelector('#tform input[value="' + s + '"]').checked = true; syncStatusUI(); }

  /* ---------- time log ---------- */
  function renderLog(t){
    var ul = $('tLog'); ul.innerHTML = '';
    $('tTotal').textContent = App.fmtH(App.hoursOf(t));
    (t.log || []).slice().reverse().forEach(function(e){
      var li = el('li');
      li.appendChild(el('span', 'h', App.fmtH(+e.hours || 0)));
      li.appendChild(el('span', 'd', App.prettyDate(e.date)));
      var n = el('span', 'n', e.note || ''); if (e.note) n.title = e.note;
      li.appendChild(n);
      var x = el('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove entry');
      x.addEventListener('click', function(){ t.log.splice(t.log.indexOf(e), 1); t.updated = App.today(); App.changed(); renderLog(t); });
      li.appendChild(x);
      ul.appendChild(li);
    });
  }
  function logTime(){
    var t = S.editingId && App.findTicket(S.editingId), h = parseFloat($('tHours').value);
    if (!t) return;
    if (!(h > 0 && h <= 24)) { $('tHours').focus(); return; }
    (t.log = t.log || []).push({ date: App.today(), hours: Math.round(h * 100) / 100, note: $('tLogNote').value.trim() });
    t.updated = App.today(); $('tHours').value = ''; $('tLogNote').value = '';
    App.changed(); renderLog(t); $('tHours').focus();
  }

  /* ---------- events ---------- */
  $('tLogBtn').addEventListener('click', logTime);
  ['tHours', 'tLogNote'].forEach(function(id){ $(id).addEventListener('keydown', function(ev){ if (ev.key === 'Enter') { ev.preventDefault(); logTime(); } }); });
  $('newTix').addEventListener('click', function(){ openForm(null); });
  $('tCancel').addEventListener('click', closeForm);
  $('tClose').addEventListener('click', closeForm);
  $('tType').addEventListener('change', syncKindUI);
  [['tAddChange', 'change'], ['tAddFeature', 'feature'], ['tAddTicket', 'ticket']].forEach(function(b){
    $(b[0]).addEventListener('click', function(){ if (S.editingId) openForm(null, '', { type: b[1], project: S.editingId }); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('#tform input[name="tStatus"]'), function(r){ r.addEventListener('change', syncStatusUI); });
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && !$('tform').hidden) closeForm(); });

  $('tDelete').addEventListener('click', function(){
    var t = S.editingId && App.findTicket(S.editingId);
    var kids = t && t.type === 'project' ? App.itemsOf(t) : [];
    if (!t || !confirm('Delete ' + t.id + ' "' + t.title + '"?' + (kids.length ? '\n\nIts ' + kids.length + ' item' + (kids.length > 1 ? 's' : '') + ' will be kept but no longer belong to a project.' : ''))) return;
    kids.forEach(function(x){ delete x.project; });
    S.tdata.tickets = S.tdata.tickets.filter(function(x){ return x !== t; });
    closeForm(); App.changed();
  });
  $('tform').addEventListener('submit', function(ev){
    ev.preventDefault();
    var v = { title: $('tTitle').value.trim(), description: $('tDesc').value.trim(), type: $('tType').value, status: getFormStatus(), owner: $('tOwner').value.trim(),
              url: $('tUrl').value.trim(), target: $('tTarget').value, notes: $('tNotes').value.trim(),
              blocked: getFormStatus() === 'blocked' ? $('tBlocked').value.trim() : '', updated: App.today() };
    if (!v.title) return;
    /* project link and change-request fields only apply to some types; undefined drops them from the saved file */
    v.project = v.type === 'project' ? undefined : $('tProject').value || undefined;
    var isChange = v.type === 'change';
    v.requestedBy = isChange ? $('tReqBy').value.trim() || undefined : undefined;
    v.requested = isChange ? $('tReqOn').value || undefined : undefined;
    v.impact = isChange ? $('tImpact').value.trim() || undefined : undefined;
    v.decision = isChange ? $('tDecision').value : undefined;
    var t = S.editingId && App.findTicket(S.editingId);
    if (t && t.type === 'project' && v.type !== 'project') {
      var kids = App.itemsOf(t);
      if (kids.length) {
        if (!confirm(t.id + ' has ' + kids.length + ' item' + (kids.length > 1 ? 's' : '') + '. If it is no longer a project they will be kept but no longer belong to it. Continue?')) return;
        kids.forEach(function(x){ delete x.project; });
      }
    }
    if (t) Object.keys(v).forEach(function(key){ t[key] = v[key]; });
    else { v.id = App.newId(v.type); S.tdata.tickets.push(v); }
    closeForm(); App.changed();
  });

  App.openForm = openForm;
  App.closeForm = closeForm;
  App.quickAdd = quickAdd;
})(App);
