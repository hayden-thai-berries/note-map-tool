/* Flows tab: swimlane diagram, flow picker, Markdown editor, and loading/saving maps/<map>.flows.md. */
(function(App){
  var S = App.S, $ = App.$, el = App.el;

  var LANE_W = 110, LANE_H = 150, CARD_W = 190, CARD_H = 100, GAP = 140, PAD = 20, SVGNS = 'http://www.w3.org/2000/svg';
  var timer = null, flows = [], selStep = -1, suppressClick = false;
  /* the arrow open in the editor: { kind: 'in', to: step index, tIdx: index in that step's triggers, -1 = automatic arrow }
   * or { kind: 'back', step: step index, bIdx: index in its backs }. Indices, because every edit re-reads the text. */
  var selArrow = null;
  function sameArrow(a, b){
    return !!a && a.kind === b.kind && (a.kind === 'in' ? a.to === b.to && a.tIdx === b.tIdx : a.step === b.step && a.bIdx === b.bIdx);
  }

  function flowsFile(){ return S.param.replace(/\.md$/, '') + '.flows.md'; }
  function setStatus(t){ $('fstatus').textContent = t || ''; }

  /* a sheet or connected app on the map, by name (capitals ignored) */
  function findNode(name){
    var key = name.toLowerCase(), hit = null;
    if (!S.model) return null;
    S.model.depts.forEach(function(d){ App.deptNodes(d).forEach(function(n){ if (n.key === key) hit = n; }); });
    S.model.apps.forEach(function(n){ if (n.key === key) hit = n; });
    return hit;
  }

  function chip(cls, text, title, href){
    var c = el(href ? 'a' : 'span', 'fchip ' + cls, text);
    if (title) c.title = title;
    if (href) { c.href = href; c.target = '_blank'; c.rel = 'noopener'; }
    return c;
  }

  function cardChips(st, warn){
    var box = el('div', 'fchips');
    if (st.sheet) {
      var n = findNode(st.sheet);
      if (n) box.appendChild(chip(n.kind === 'app' ? 'app' : 'sheet', n.name, [n.kind === 'app' ? 'Connected app' : 'Sheet in ' + n.dept, n.details].filter(Boolean).join(' · '), n.url));
      else { box.appendChild(chip('bad', st.sheet, 'Not on the map')); warn.push('Step "' + st.title + '": "' + st.sheet + '" is not a sheet or app on the map.'); }
    }
    if (st.ticket) {
      var t = App.findTicket(st.ticket);
      if (t) box.appendChild(chip('t-' + t.status, t.id + ' · ' + App.statusLabel(t.status), t.title));
      else { box.appendChild(chip('bad', st.ticket, 'No such ticket')); warn.push('Step "' + st.title + '": ticket "' + st.ticket + '" does not exist.'); }
    }
    return box;
  }

  /* the department on the map with the same name as a team, if there is one */
  function deptOf(team){
    var key = team.toLowerCase(), hit = null;
    if (S.model) S.model.depts.forEach(function(d){ if (d.name.toLowerCase() === key) hit = d; });
    return hit;
  }
  function laneBtn(text, title, fn, disabled){
    var b = el('button', 'fbtn', text); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.disabled = !!disabled;
    b.addEventListener('click', function(ev){ ev.stopPropagation(); fn(); });
    return b;
  }
  function laneLabel(flow, team, i){
    var lab = el('div', 'flabel'), name = el('div', 'fname', team), d = deptOf(team);
    name.title = 'Double-click to rename';
    name.addEventListener('dblclick', function(){ startRename(lab, name, i); });
    lab.appendChild(name);
    if (d) {
      var b = el('span', 'fdept', 'Department');
      b.title = 'A department on the map' + (d.text.length ? ': ' + d.text.join(' · ') : '');
      lab.appendChild(b);
    }
    var empty = !flow.steps.some(function(st){ return st.team.toLowerCase() === team.toLowerCase(); });
    var ctl = el('div', 'fctl');
    ctl.appendChild(laneBtn('✎', 'Rename lane', function(){ startRename(lab, name, i); }));
    ctl.appendChild(laneBtn('▲', 'Move lane up', function(){ moveLane(i, -1); }, i === 0));
    ctl.appendChild(laneBtn('▼', 'Move lane down', function(){ moveLane(i, 1); }, i === flow.teams.length - 1));
    if (empty) ctl.appendChild(laneBtn('✕', 'Remove empty lane', function(){ flows[S.flowIdx].teams.splice(i, 1); commit(false); }));
    lab.appendChild(ctl);
    return lab;
  }
  function startRename(lab, name, i){
    var inp = el('input', 'frename'), finished = false;
    inp.value = flows[S.flowIdx].teams[i]; inp.maxLength = 60; inp.setAttribute('aria-label', 'Lane name');
    function finish(save){
      if (finished) return; finished = true;
      if (save) renameLane(i, inp.value); else renderFlows(true);
    }
    inp.addEventListener('keydown', function(ev){ if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
    inp.addEventListener('blur', function(){ finish(true); });
    lab.replaceChild(inp, name); inp.focus(); inp.select();
  }

  function drawFlow(flow){
    var host = $('fcanvas'), warn = flow.warn.slice(), n = flow.steps.length;
    host.textContent = '';
    var width = Math.max(600, LANE_W + PAD * 2 + n * CARD_W + Math.max(0, n - 1) * GAP), height = flow.teams.length * LANE_H;
    host.style.width = width + 'px'; host.style.height = height + 'px';
    function x(i){ return LANE_W + PAD + i * (CARD_W + GAP); }
    function laneOf(st){ return flow.teams.map(function(t){ return t.toLowerCase(); }).indexOf(st.team.toLowerCase()); }
    function top(st){ return laneOf(st) * LANE_H + (LANE_H - 10 - CARD_H) / 2; }

    var laneEls = [];
    flow.teams.forEach(function(t, i){
      var lane = el('div', 'flane c' + (i % 4)); lane.style.top = i * LANE_H + 'px'; lane.style.height = LANE_H - 10 + 'px';
      lane.appendChild(laneLabel(flow, t, i));
      host.appendChild(lane); laneEls.push(lane);
    });

    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'fwires'); svg.setAttribute('width', width); svg.setAttribute('height', height);
    svg.innerHTML = '<defs>' +
      '<marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="ma"/></marker>' +
      '<marker id="fb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="mb"/></marker>' +
      '<marker id="fw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="mw"/></marker></defs>';
    host.appendChild(svg);

    flow.edges.forEach(function(e){
      var a = flow.steps[e.from], b = flow.steps[e.to];
      var ax = x(e.from) + CARD_W, ay = top(a) + CARD_H / 2, bx = x(e.to), by = top(b) + CARD_H / 2, mx = bx - GAP / 2;
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', ay === by ? 'M' + ax + ' ' + ay + ' H' + bx : 'M' + ax + ' ' + ay + ' H' + mx + ' V' + by + ' H' + bx);
      var pick = { kind: 'in', to: e.to, tIdx: e.tIdx }, on = sameArrow(selArrow, pick);
      path.setAttribute('class', (e.msg ? 'fe msg' : 'fe') + (on ? ' sel' : ''));
      path.setAttribute('marker-end', 'url(#' + (e.msg ? 'fa' : 'fw') + ')');
      svg.appendChild(path);
      svg.appendChild(hitPath(path.getAttribute('d'), pick));
      if (e.msg) {
        var pill = el('div', 'fmsg click' + (on ? ' sel' : ''), '✉ ' + e.msg); pill.title = a.team + ' tells ' + b.team + ': ' + e.msg + ' (click to edit this arrow)';
        pill.style.left = (ay === by ? (ax + bx) / 2 : mx) + 'px'; pill.style.top = (ay === by ? ay - 16 : (ay + by) / 2) + 'px';
        pill.addEventListener('click', function(){ pickArrow(pick); });
        host.appendChild(pill);
      }
    });

    /* a step that sends work back to an earlier one: a dashed loop under the lanes, from the bottom of one box to the bottom of the other */
    flow.steps.forEach(function(st, i){
      st.backs.forEach(function(b, bi){
        var k = flow.steps.indexOf(b.ref); if (k < 0) return;
        var sx = x(i) + CARD_W / 2, tx = x(k) + CARD_W / 2, sy = top(st) + CARD_H, ty = top(b.ref) + CARD_H;
        var yl = Math.max(laneOf(st), laneOf(b.ref)) * LANE_H + LANE_H - 17;
        var path = document.createElementNS(SVGNS, 'path'), pick = { kind: 'back', step: i, bIdx: bi }, on = sameArrow(selArrow, pick);
        path.setAttribute('d', 'M' + sx + ' ' + sy + ' V' + yl + ' H' + tx + ' V' + ty);
        path.setAttribute('class', 'fe back' + (on ? ' sel' : '')); path.setAttribute('marker-end', 'url(#fb)');
        svg.appendChild(path);
        svg.appendChild(hitPath(path.getAttribute('d'), pick));
        var pill = el('div', 'fmsg back click' + (on ? ' sel' : ''), '↩ ' + (b.msg || 'Sent back to step ' + (k + 1)));
        pill.title = st.team + ' sends back to step ' + (k + 1) + (b.msg ? ': ' + b.msg : '') + ' (click to edit this arrow)';
        pill.style.left = (sx + tx) / 2 + 'px'; pill.style.top = yl + 'px';
        pill.addEventListener('click', function(){ pickArrow(pick); });
        host.appendChild(pill);
      });
    });

    /* a wide invisible copy of an arrow, so a thin line is easy to click */
    function hitPath(d, pick){
      var h = document.createElementNS(SVGNS, 'path');
      h.setAttribute('d', d); h.setAttribute('class', 'fhit');
      h.addEventListener('click', function(){ pickArrow(pick); });
      return h;
    }
    /* drag from the dot on a card's right edge to another card: onto a later step it adds an arrow, onto an earlier one a "sent back" arrow */
    function startConnect(ev, from){
      ev.stopPropagation(); ev.preventDefault();
      var line = document.createElementNS(SVGNS, 'path'), a = flow.steps[from], sx = x(from) + CARD_W, sy = top(a) + CARD_H / 2, over = null;
      line.setAttribute('class', 'fe pend'); svg.appendChild(line);
      function cardAt(e){ var c = document.elementFromPoint(e.clientX, e.clientY); c = c && c.closest && c.closest('.fcard'); return c && +c.getAttribute('data-i') !== from ? c : null; }
      function move(e){
        var r = host.getBoundingClientRect();
        line.setAttribute('d', 'M' + sx + ' ' + sy + ' L' + (e.clientX - r.left) + ' ' + (e.clientY - r.top));
        var c = cardAt(e); if (over && over !== c) over.classList.remove('target'); if (c) c.classList.add('target'); over = c;
      }
      function up(e){
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        line.remove(); if (over) over.classList.remove('target');
        suppressClick = true; setTimeout(function(){ suppressClick = false; }, 0);
        var c = e.type === 'pointercancel' ? null : cardAt(e);
        if (c) connect(from, +c.getAttribute('data-i'));
      }
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    }

    /* where a dragged card would land: the lane under the pointer, and its place in the step order (the others keep their order) */
    function dropTarget(ev, from){
      var r = host.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
      var lane = Math.max(0, Math.min(flow.teams.length - 1, Math.floor(py / LANE_H)));
      var others = flow.steps.map(function(st, j){ return j; }).filter(function(j){ return j !== from; });
      var pos = others.filter(function(j){ return x(j) + CARD_W / 2 < px; }).length;
      var lineX = !others.length ? null : pos < others.length ? x(others[pos]) - GAP / 2 : x(others[others.length - 1]) + CARD_W + GAP / 2;
      return { lane: lane, pos: pos, lineX: lineX };
    }
    function startDrag(ev, card, from){
      var sx = ev.clientX, sy = ev.clientY, moved = false, mark = el('div', 'fdrop');
      function move(e){
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved) {
          if (Math.abs(dx) + Math.abs(dy) < 6) return;
          moved = true; card.classList.add('drag'); host.classList.add('dragging'); host.appendChild(mark);
        }
        card.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        var t = dropTarget(e, from);
        laneEls.forEach(function(l, k){ l.classList.toggle('over', k === t.lane); });
        mark.style.display = t.lineX == null ? 'none' : 'block'; mark.style.left = t.lineX + 'px'; mark.style.height = height + 'px';
      }
      function up(e){
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        if (!moved) return;
        suppressClick = true; setTimeout(function(){ suppressClick = false; }, 0);
        if (e.type === 'pointercancel') { renderFlows(true); return; }
        var t = dropTarget(e, from);
        if (flow.teams[t.lane].toLowerCase() === flow.steps[from].team.toLowerCase() && t.pos === from) { renderFlows(true); return; }
        dropStep(from, t.lane, t.pos);
      }
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    }

    flow.steps.forEach(function(st, i){
      var card = el('div', 'fcard c' + (laneOf(st) % 4) + (i === selStep ? ' sel' : '')); card.tabIndex = 0; card.setAttribute('role', 'button');
      card.addEventListener('click', function(ev){ if (!suppressClick && !ev.target.closest('a')) pickStep(i); });
      card.addEventListener('pointerdown', function(ev){ if (ev.button === 0 && !ev.target.closest('a')) startDrag(ev, card, i); });
      card.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pickStep(i); } }); card.style.left = x(i) + 'px'; card.style.top = top(st) + 'px';
      card.style.width = CARD_W + 'px'; card.style.height = CARD_H + 'px'; card.setAttribute('data-i', i);
      var dot = el('span', 'fconn'); dot.title = 'Drag to another step to draw an arrow';
      dot.addEventListener('pointerdown', function(ev){ if (ev.button === 0) startConnect(ev, i); });
      dot.addEventListener('click', function(ev){ ev.stopPropagation(); });
      card.appendChild(dot);
      card.appendChild(el('div', 'fmeta', (i + 1) + (st.day ? ' · ' + st.day : '')));
      var title = el('div', 'ftitle', st.title); if (st.note) title.title = st.note;
      card.appendChild(title);
      if (st.note) card.appendChild(el('span', 'finfo', 'i'));
      card.appendChild(cardChips(st, warn));
      host.appendChild(card);
    });
    $('fwarn').textContent = warn.join('\n');
    $('fsum').textContent = [flow.every && 'Runs: ' + flow.every, flow.teams.length + ' teams', n + ' steps'].filter(Boolean).join(' · ');
  }

  function renderFlows(keepForm){
    var sel = $('fPick');
    flows = App.parseFlows(S.flowsMd);
    if (S.flowIdx >= flows.length) S.flowIdx = 0;
    sel.textContent = '';
    flows.forEach(function(f, i){ var o = el('option', null, f.title); o.value = i; sel.appendChild(o); });
    sel.value = S.flowIdx; sel.hidden = !flows.length;
    if (!flows.length) { $('fcanvas').textContent = ''; $('fcanvas').style.height = '0'; $('fsum').textContent = 'No flows yet. Press New flow.'; $('fwarn').textContent = ''; }
    else drawFlow(flows[S.flowIdx]);
    $('fDelFlow').hidden = !flows.length;
    if (keepForm !== true) fillForm();
  }
  App.renderFlows = renderFlows;
  App.flowStats = function(){ var n = App.parseFlows(S.flowsMd).length; return n + (n === 1 ? ' flow' : ' flows'); };

  function saveFlows(){
    var text = S.flowsMd.replace(/\s+$/, '') + '\n', btn = $('fSave');
    btn.disabled = true; setStatus('Saving…');
    fetch('maps/' + flowsFile(), { method: 'PUT', headers: { 'X-Map-Save': '1', 'Content-Type': 'text/markdown' }, body: text })
      .then(function(r){ if (!r.ok) throw new Error(r.status); S.flowsSaved = text.replace(/^\n+|\n+$/g, ''); S.flowsDemo = false; setStatus('Saved to maps/' + flowsFile() + '. The previous version is kept as ' + flowsFile() + '.bak.'); })
      .catch(function(){ setStatus('Could not save here. Start the page with start.command (it runs server.py).'); })
      .then(function(){ btn.disabled = false; });
  }

  function loadFlows(){
    fetch('maps/' + flowsFile(), { cache: 'no-store' })
      .then(function(r){ if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(t){
        if (t == null) { S.flowsDemo = true; setStatus('No maps/' + flowsFile() + ' yet. Showing the example; Save creates the file.'); return; }
        S.flowsSaved = S.flowsMd = t.replace(/^\n+|\n+$/g, ''); $('fEd').value = S.flowsMd;
      })
      .catch(function(){ setStatus('Could not read maps/' + flowsFile() + ' (open through the local server, see README). Showing the built-in example.'); })
      .then(renderFlows);
  }
  App.loadFlows = loadFlows;

  /* ---- form editor: edits the parsed flow, then writes it back to the text and redraws ---- */
  function flow(){ return flows[S.flowIdx]; }
  function step(){ var f = flow(); return f && f.steps[selStep]; }
  function clean(v){ return String(v).replace(/[|\n]/g, ' ').trim(); }
  function cleanTeam(v){ return clean(String(v).replace(/[,:]/g, ' ')); }
  function showEditor(open){
    $('fEditor').hidden = !open; $('fEditBtn').textContent = open ? 'Close editor' : 'Edit';
    $('flayout').classList.toggle('editing', open);
  }
  /* keepForm: the user is typing in the form, so redraw the diagram but leave the inputs alone */
  function commit(keepForm){
    S.flowsMd = App.stringifyFlows(flows).replace(/^\n+|\n+$/g, '');
    $('fEd').value = S.flowsMd;
    setStatus(S.flowsMd === S.flowsSaved ? '' : 'Unsaved changes. Press Save to keep them.');
    renderFlows(keepForm);
  }
  function pickStep(i){ selStep = i; selArrow = null; showEditor(true); renderFlows(); }
  function pickArrow(a){ selArrow = a; selStep = -1; showEditor(true); renderFlows(); }

  /* the trigger behind the open arrow; the automatic arrow from the step before is turned into a real one first so it can be changed */
  function arrowTrigger(){
    var f = flow(), st = f && f.steps[selArrow.to];
    if (!st) return null;
    if (selArrow.tIdx < 0) {
      if (selArrow.to < 1) return null;
      st.triggers.push({ ref: f.steps[selArrow.to - 1], team: null, msg: '' }); selArrow.tIdx = st.triggers.length - 1;
    }
    return st.triggers[selArrow.tIdx] || null;
  }
  /* draws an arrow between two steps: to a later step it is a normal arrow, to an earlier one a "sent back" arrow */
  function connect(from, to){
    var f = flow(), a = f.steps[from], b = f.steps[to];
    if (!a || !b || from === to) return;
    if (to < from) {
      a.backs.push({ ref: b, msg: '' }); selArrow = { kind: 'back', step: from, bIdx: a.backs.length - 1 }; selStep = -1; commitArrow(); return;
    }
    /* a step with no explicit arrows is fed by the step before it; keep that arrow when adding another */
    if (!b.triggers.length && !b.standalone && to > 0) b.triggers.push({ ref: f.steps[to - 1], team: null, msg: '' });
    b.standalone = false;
    var have = b.triggers.findIndex(function(t){ return t.ref === a; });
    if (have < 0) { b.triggers.push({ ref: a, team: null, msg: '' }); have = b.triggers.length - 1; }
    selArrow = { kind: 'in', to: to, tIdx: have }; selStep = -1; commitArrow();
  }
  function commitArrow(){ showEditor(true); commit(false); }
  function validArrow(f){
    var a = selArrow; if (!a || !f) return null;
    if (a.kind === 'in') {
      var st = f.steps[a.to]; if (!st) return null;
      if (a.tIdx < 0) return a.to > 0 && !st.triggers.length && !st.standalone ? a : null;
      return st.triggers[a.tIdx] ? a : null;
    }
    var s = f.steps[a.step]; return s && s.backs[a.bIdx] ? a : null;
  }
  function fillArrow(){
    var f = flow(), a = validArrow(f), box = $('fArrow');
    if (!a) selArrow = null;
    box.hidden = !a;
    if (!a) return;
    var from = $('aFrom'), items, cur, st, label;
    if (a.kind === 'in') {
      st = f.steps[a.to];
      var t = a.tIdx < 0 ? { ref: f.steps[a.to - 1], msg: '' } : st.triggers[a.tIdx];
      items = f.teams.map(function(n){ return ['t:' + n, 'Team: ' + n]; });
      f.steps.forEach(function(o, j){ if (j < a.to) items.push(['s:' + j, 'Step ' + (j + 1) + ' · ' + o.title]); });
      cur = t.ref ? 's:' + f.steps.indexOf(t.ref) : 't:' + t.team;
      $('aHead').textContent = 'Arrow into step ' + (a.to + 1);
      $('aFromLbl').textContent = 'Comes from';
      $('aMsg').value = t.msg || '';
    } else {
      st = f.steps[a.step];
      var b = st.backs[a.bIdx];
      items = []; f.steps.forEach(function(o, j){ if (o !== st) items.push(['s:' + j, 'Step ' + (j + 1) + ' · ' + o.title]); });
      cur = 's:' + f.steps.indexOf(b.ref);
      $('aHead').textContent = 'Sent back from step ' + (a.step + 1);
      $('aFromLbl').textContent = 'Goes back to';
      $('aMsg').value = b.msg || '';
    }
    fillOptions(from, items, cur);
  }
  $('aFrom').addEventListener('change', function(){
    var a = validArrow(flow()), v = this.value; if (!a) return;
    if (a.kind === 'back') flow().steps[a.step].backs[a.bIdx].ref = flow().steps[+v.slice(2)];
    else {
      var t = arrowTrigger(); if (!t) return;
      if (v.charAt(0) === 's') { t.ref = flow().steps[+v.slice(2)]; t.team = null; } else { t.team = v.slice(2); t.ref = null; }
      t.num = null;
    }
    commit(true);
  });
  $('aMsg').addEventListener('input', function(){
    var a = validArrow(flow()), v = clean(this.value); if (!a) return;
    if (a.kind === 'back') flow().steps[a.step].backs[a.bIdx].msg = v;
    else { var t = arrowTrigger(); if (!t) return; t.msg = v; }
    commit(true);
  });
  $('aDel').addEventListener('click', function(){
    var a = validArrow(flow()); if (!a) return;
    var f = flow();
    if (a.kind === 'back') f.steps[a.step].backs.splice(a.bIdx, 1);
    else {
      var st = f.steps[a.to];
      if (a.tIdx >= 0) st.triggers.splice(a.tIdx, 1);
      /* with no arrow left the step must say it starts on its own, or it would fall back to following the step before it */
      if (!st.triggers.length) st.standalone = true;
    }
    selArrow = null; commit(false);
  });

  /* a team's name is used by its steps and by the steps that wait on it; renaming to an existing lane merges the two */
  function renameLane(i, value){
    var f = flow(), old = f.teams[i], now = cleanTeam(value);
    if (!now || now === old) { renderFlows(true); return; }
    f.steps.forEach(function(st){
      if (st.team.toLowerCase() === old.toLowerCase()) st.team = now;
      st.triggers.forEach(function(t){ if (t.team && t.team.toLowerCase() === old.toLowerCase()) t.team = now; });
    });
    f.teams[i] = now;
    f.teams = f.teams.filter(function(t, k){ return f.teams.findIndex(function(u){ return u.toLowerCase() === t.toLowerCase(); }) === k; });
    commit(false);
  }
  function moveLane(i, d){
    var f = flow(), j = i + d; if (j < 0 || j >= f.teams.length) return;
    var t = f.teams[i]; f.teams[i] = f.teams[j]; f.teams[j] = t; commit(false);
  }
  function dropStep(from, lane, pos){
    var f = flow(), st = f.steps.splice(from, 1)[0];
    st.team = f.teams[lane]; f.steps.splice(pos, 0, st); selStep = pos; selArrow = null; commit(false);
  }
  function addLane(){
    var f = flow(), name = cleanTeam($('fLaneName').value);
    if (!f || !name) return;
    if (!f.teams.some(function(t){ return t.toLowerCase() === name.toLowerCase(); })) f.teams.push(name);
    $('fLaneName').value = ''; commit(false);
  }

  function fillOptions(sel, items, value){
    sel.textContent = '';
    items.forEach(function(it){ var o = el('option', null, it[1]); o.value = it[0]; sel.appendChild(o); });
    if (!items.some(function(it){ return it[0] === value; })) { var o = el('option', null, value); o.value = value; sel.appendChild(o); }
    sel.value = value;
  }
  /* sheets grouped by department, then connected apps, as they are on the map */
  function fillSheets(value){
    var sel = $('sSheet'), found = !value;
    sel.textContent = '';
    var none = el('option', null, 'None'); none.value = ''; sel.appendChild(none);
    function group(label, nodes){
      if (!nodes.length) return;
      var g = el('optgroup'); g.label = label;
      nodes.forEach(function(n){ var o = el('option', null, n.name); o.value = n.name; g.appendChild(o); if (n.name.toLowerCase() === value.toLowerCase()) { found = true; value = n.name; } });
      sel.appendChild(g);
    }
    if (S.model) {
      S.model.depts.forEach(function(d){ group(d.name, App.deptNodes(d)); });
      group('Connected apps', S.model.apps);
    }
    if (!found) { var o = el('option', null, value + ' (not on the map)'); o.value = value; sel.appendChild(o); }
    sel.value = value;
  }
  function fillTrig(){
    var st = step(), box = $('sTrig'), f = flow();
    box.textContent = '';
    st.triggers.forEach(function(t, k){
      var row = el('div', 'ftrig'), team = el('select'), msg = el('input'), x = el('button', 'btn', '×');
      /* wait on a team (its latest earlier step) or on one exact earlier step; add several rows to wait on several steps */
      var me = f.steps.indexOf(st), items = f.teams.map(function(n){ return ['t:' + n, 'Team: ' + n]; });
      f.steps.forEach(function(o, j){ if (j < me) items.push(['s:' + j, 'Step ' + (j + 1) + ' · ' + o.title]); });
      fillOptions(team, items, t.ref ? 's:' + f.steps.indexOf(t.ref) : 't:' + t.team);
      msg.maxLength = 120; msg.placeholder = 'Message, e.g. Top up done'; msg.value = t.msg; msg.setAttribute('aria-label', 'Message');
      x.type = 'button'; x.title = 'Remove'; x.setAttribute('aria-label', 'Remove');
      team.addEventListener('change', function(){
        var tr = step().triggers[k], v = team.value;
        if (v.charAt(0) === 's') { tr.ref = flow().steps[+v.slice(2)]; tr.team = null; } else { tr.team = v.slice(2); tr.ref = null; }
        tr.num = null; commit(true);
      });
      msg.addEventListener('input', function(){ step().triggers[k].msg = clean(msg.value); commit(true); });
      x.addEventListener('click', function(){ step().triggers.splice(k, 1); commit(false); });
      row.appendChild(team); row.appendChild(msg); row.appendChild(x); box.appendChild(row);
    });
    $('sFollows').hidden = st.triggers.length > 0 || selStep === 0;
    fillBacks();
  }
  function fillBacks(){
    var st = step(), f = flow(), box = $('sBack');
    box.textContent = '';
    st.backs.forEach(function(b, k){
      var row = el('div', 'ftrig'), sel = el('select'), msg = el('input'), x = el('button', 'btn', '×');
      var items = f.steps.map(function(o, j){ return [String(j), (j + 1) + ' · ' + o.title]; }).filter(function(it){ return f.steps[+it[0]] !== st; });
      fillOptions(sel, items, String(f.steps.indexOf(b.ref)));
      msg.maxLength = 120; msg.placeholder = 'Message, e.g. Needs changes'; msg.value = b.msg; msg.setAttribute('aria-label', 'Message');
      x.type = 'button'; x.title = 'Remove'; x.setAttribute('aria-label', 'Remove');
      sel.addEventListener('change', function(){ step().backs[k].ref = flow().steps[+sel.value]; commit(true); });
      msg.addEventListener('input', function(){ step().backs[k].msg = clean(msg.value); commit(true); });
      x.addEventListener('click', function(){ step().backs.splice(k, 1); commit(false); });
      row.appendChild(sel); row.appendChild(msg); row.appendChild(x); box.appendChild(row);
    });
    $('sAddBack').disabled = f.steps.length < 2;
  }
  function fillForm(){
    var f = flow(), st = step();
    $('fName').disabled = $('fEvery').disabled = !f;
    if (f) { $('fName').value = f.title; $('fEvery').value = f.every; }
    fillArrow();
    $('fStepForm').hidden = !st; $('fHint').hidden = !!st || !!selArrow;
    $('fHint').textContent = f ? 'Click a step or an arrow in the diagram to edit it. Drag from the dot on a step to another step to draw a new arrow.' : 'Press New flow to start.';
    if (!st) return;
    $('sHead').textContent = 'Step ' + (selStep + 1);
    $('sTeam').value = st.team; $('sTitle').value = st.title; $('sNote').value = st.note;
    var teamNames = f.teams.slice();
    if (S.model) S.model.depts.forEach(function(d){ if (teamNames.indexOf(d.name) < 0) teamNames.push(d.name); });
    $('sTeams').textContent = ''; teamNames.forEach(function(t){ var o = el('option'); o.value = t; $('sTeams').appendChild(o); });
    fillSheets(st.sheet || '');
    fillOptions($('sDay'), [['', 'No day']].concat(App.FLOW_DAYS.map(function(d){ return [d, d]; })), st.day || '');
    fillOptions($('sTicket'), [['', 'None']].concat(S.tdata.tickets.map(function(t){ return [t.id, t.id + ' · ' + t.title]; })), st.ticket || '');
    $('sUp').disabled = selStep === 0; $('sDown').disabled = selStep === f.steps.length - 1;
    fillTrig();
  }
  function bind(id, ev, fn){ $(id).addEventListener(ev, function(){ if (flow()) { fn(this.value); commit(true); } }); }
  function bindStep(id, ev, fn){ $(id).addEventListener(ev, function(){ var st = step(); if (st) { fn(st, this.value); commit(true); } }); }

  bind('fName', 'input', function(v){ flow().title = clean(v) || 'Untitled flow'; });
  bind('fEvery', 'input', function(v){ flow().every = clean(v); });
  /* renaming the only user of a team also renames it where other steps wait on it */
  bindStep('sTeam', 'change', function(st, v){
    var old = st.team.toLowerCase(), now = cleanTeam(v) || '(no team)';
    st.team = now;
    var f = flow(), stillUsed = f.steps.some(function(o){ return o.team.toLowerCase() === old; });
    if (!stillUsed) {
      f.steps.forEach(function(o){ o.triggers.forEach(function(t){ if (t.team && t.team.toLowerCase() === old) t.team = now; }); });
      f.teams = f.teams.filter(function(t){ return t.toLowerCase() !== old; });
    }
  });
  bindStep('sTitle', 'input', function(st, v){ st.title = clean(v) || '(untitled)'; });
  bindStep('sDay', 'change', function(st, v){ st.day = v || null; });
  bindStep('sSheet', 'change', function(st, v){ st.sheet = v || null; });
  bindStep('sTicket', 'change', function(st, v){ st.ticket = v || null; });
  bindStep('sNote', 'input', function(st, v){ st.note = v.replace(/\s+$/, ''); });
  $('sTeam').addEventListener('change', function(){ fillTrig(); });
  $('sAddBack').addEventListener('click', function(){
    var st = step(), f = flow(); if (!st) return;
    var i = f.steps.indexOf(st), target = f.steps[i > 0 ? i - 1 : 1];
    if (target) { st.backs.push({ ref: target, msg: '' }); commit(false); }
  });
  $('sAddTrig').addEventListener('click', function(){
    var st = step(), f = flow(); if (!st) return;
    var other = f.teams.filter(function(t){ return t.toLowerCase() !== st.team.toLowerCase(); })[0] || f.teams[0];
    st.triggers.push({ team: other, msg: '' }); commit(false);
  });
  function move(d){
    var f = flow(), j = selStep + d; if (!f || j < 0 || j >= f.steps.length) return;
    var t = f.steps[selStep]; f.steps[selStep] = f.steps[j]; f.steps[j] = t; selStep = j; selArrow = null; commit(false);
  }
  $('sUp').addEventListener('click', function(){ move(-1); });
  $('sDown').addEventListener('click', function(){ move(1); });
  $('sDel').addEventListener('click', function(){ var f = flow(); if (!f || !step()) return; f.steps.splice(selStep, 1); selStep = -1; selArrow = null; commit(false); });
  $('fAddStep').addEventListener('click', function(){
    if (!flows.length) flows.push({ title: 'New flow', every: '', teams: [], steps: [] });
    var f = flow(), last = f.steps[f.steps.length - 1];
    f.steps.push({ team: last ? last.team : f.teams[0] || 'Team', title: 'New step', day: null, sheet: null, ticket: null, triggers: [], backs: [], note: '' });
    selStep = f.steps.length - 1; showEditor(true); commit(false);
  });
  $('fNew').addEventListener('click', function(){
    flows.push({ title: 'New flow', every: '', teams: [], steps: [] });
    S.flowIdx = flows.length - 1; selStep = -1; selArrow = null; showEditor(true); commit(false);
    $('fName').focus(); $('fName').select();
  });
  $('fDelFlow').addEventListener('click', function(){
    var f = flow(); if (!f || !confirm('Delete the flow "' + f.title + '"?')) return;
    flows.splice(S.flowIdx, 1); S.flowIdx = 0; selStep = -1; selArrow = null; commit(false);
  });

  $('fPick').addEventListener('change', function(){ S.flowIdx = +this.value; selStep = -1; selArrow = null; renderFlows(); });
  $('fEditBtn').addEventListener('click', function(){ showEditor($('fEditor').hidden); });
  $('fEd').addEventListener('input', function(){
    var v = this.value;
    setStatus(v.trim() === S.flowsSaved ? '' : 'Unsaved changes. Press Save to keep them.');
    clearTimeout(timer); timer = setTimeout(function(){ S.flowsMd = v; selStep = -1; selArrow = null; renderFlows(); }, 150);
  });
  $('fEd').addEventListener('keydown', function(ev){
    if (ev.key === 'Tab') { ev.preventDefault(); var s = this.selectionStart; this.value = this.value.slice(0, s) + '  ' + this.value.slice(this.selectionEnd); this.selectionStart = this.selectionEnd = s + 2; }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveFlows(); }
  });
  $('fAddLane').addEventListener('click', addLane);
  $('fLaneName').addEventListener('keydown', function(ev){ if (ev.key === 'Enter') { ev.preventDefault(); addLane(); } });
  $('fSave').addEventListener('click', saveFlows);
})(App);
