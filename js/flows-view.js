/* Flows tab: swimlane diagram, flow picker, Markdown editor, and loading/saving maps/<map>.flows.md. */
(function(App){
  var S = App.S, $ = App.$, el = App.el;

  var LANE_W = 110, LANE_H = 150, CARD_W = 190, CARD_H = 100, GAP = 140, PAD = 20, SVGNS = 'http://www.w3.org/2000/svg';
  var timer = null;

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

  function drawFlow(flow){
    var host = $('fcanvas'), warn = flow.warn.slice(), n = flow.steps.length;
    host.textContent = '';
    var width = Math.max(600, LANE_W + PAD * 2 + n * CARD_W + Math.max(0, n - 1) * GAP), height = flow.teams.length * LANE_H;
    host.style.width = width + 'px'; host.style.height = height + 'px';
    function x(i){ return LANE_W + PAD + i * (CARD_W + GAP); }
    function laneOf(st){ return flow.teams.map(function(t){ return t.toLowerCase(); }).indexOf(st.team.toLowerCase()); }
    function top(st){ return laneOf(st) * LANE_H + (LANE_H - 10 - CARD_H) / 2; }

    flow.teams.forEach(function(t, i){
      var lane = el('div', 'flane c' + (i % 4)); lane.style.top = i * LANE_H + 'px'; lane.style.height = LANE_H - 10 + 'px';
      lane.appendChild(el('div', 'flabel', t));
      host.appendChild(lane);
    });

    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'fwires'); svg.setAttribute('width', width); svg.setAttribute('height', height);
    svg.innerHTML = '<defs>' +
      '<marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="ma"/></marker>' +
      '<marker id="fw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="mw"/></marker></defs>';
    host.appendChild(svg);

    flow.edges.forEach(function(e){
      var a = flow.steps[e.from], b = flow.steps[e.to];
      var ax = x(e.from) + CARD_W, ay = top(a) + CARD_H / 2, bx = x(e.to), by = top(b) + CARD_H / 2, mx = bx - GAP / 2;
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', ay === by ? 'M' + ax + ' ' + ay + ' H' + bx : 'M' + ax + ' ' + ay + ' H' + mx + ' V' + by + ' H' + bx);
      path.setAttribute('class', e.msg ? 'fe msg' : 'fe');
      path.setAttribute('marker-end', 'url(#' + (e.msg ? 'fa' : 'fw') + ')');
      svg.appendChild(path);
      if (e.msg) {
        var pill = el('div', 'fmsg', '✉ ' + e.msg); pill.title = a.team + ' tells ' + b.team + ': ' + e.msg;
        pill.style.left = (ay === by ? (ax + bx) / 2 : mx) + 'px'; pill.style.top = (ay === by ? ay - 16 : (ay + by) / 2) + 'px';
        host.appendChild(pill);
      }
    });

    flow.steps.forEach(function(st, i){
      var card = el('div', 'fcard c' + (laneOf(st) % 4)); card.style.left = x(i) + 'px'; card.style.top = top(st) + 'px';
      card.style.width = CARD_W + 'px'; card.style.height = CARD_H + 'px';
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

  function renderFlows(){
    var flows = App.parseFlows(S.flowsMd), sel = $('fPick');
    if (S.flowIdx >= flows.length) S.flowIdx = 0;
    sel.textContent = '';
    flows.forEach(function(f, i){ var o = el('option', null, f.title); o.value = i; sel.appendChild(o); });
    sel.value = S.flowIdx; sel.hidden = !flows.length;
    if (!flows.length) { $('fcanvas').textContent = ''; $('fsum').textContent = 'No flows yet. Edit and add a "# Flow name" line.'; $('fwarn').textContent = ''; return; }
    drawFlow(flows[S.flowIdx]);
  }
  App.renderFlows = renderFlows;
  App.flowStats = function(){ var n = App.parseFlows(S.flowsMd).length; return n + (n === 1 ? ' flow' : ' flows'); };

  function saveFlows(){
    var text = $('fEd').value.replace(/\s+$/, '') + '\n', btn = $('fSave');
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

  $('fPick').addEventListener('change', function(){ S.flowIdx = +this.value; renderFlows(); });
  $('fEditBtn').addEventListener('click', function(){
    var open = $('fEditor').hidden;
    $('fEditor').hidden = !open; $('fEditBtn').textContent = open ? 'Close editor' : 'Edit';
    $('flayout').classList.toggle('editing', open);
    if (open) $('fEd').value = S.flowsMd;
  });
  $('fEd').addEventListener('input', function(){
    var v = this.value;
    setStatus(v.trim() === S.flowsSaved ? '' : 'Unsaved changes. Press Save to keep them.');
    clearTimeout(timer); timer = setTimeout(function(){ S.flowsMd = v; renderFlows(); }, 150);
  });
  $('fEd').addEventListener('keydown', function(ev){
    if (ev.key === 'Tab') { ev.preventDefault(); var s = this.selectionStart; this.value = this.value.slice(0, s) + '  ' + this.value.slice(this.selectionEnd); this.selectionStart = this.selectionEnd = s + 2; }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveFlows(); }
  });
  $('fSave').addEventListener('click', saveFlows);
})(App);
