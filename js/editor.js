/* Edit-as-Markdown panel: live preview, copy/open/download, and saving maps/<map>.md through server.py. */
(function(App){
  var S = App.S, $ = App.$;
  var ed = $('ed'), status = $('status'), fsb = $('fileSaveBtn'), timer = null;

  function setStatus(t){ status.textContent = t || ''; }
  function toggleEdit(){
    var open = $('editor').hidden;
    $('editor').hidden = !open;
    $('page').classList.toggle('editing', open);
    $('editBtn').textContent = open ? 'Close editor' : 'Edit';
    if (open) { ed.value = ed.value || S.savedMd; }
    setTimeout(App.drawWires, 50);
  }
  function saveToFile(){
    var text = ed.value.replace(/\s+$/, '') + '\n';
    fsb.disabled = true; setStatus('Saving…');
    fetch('maps/' + S.param, { method: 'PUT', headers: { 'X-Map-Save': '1', 'Content-Type': 'text/markdown' }, body: text })
      .then(function(r){ if (!r.ok) throw new Error(r.status); S.savedMd = text.replace(/^\n+|\n+$/g, ''); setStatus('Saved to maps/' + S.param + '. The previous version is kept as ' + S.param + '.bak.'); })
      .catch(function(){ setStatus('Could not save here. Start the page with start.command (it runs server.py), or use Download .md.'); })
      .then(function(){ fsb.disabled = false; });
  }

  $('editBtn').addEventListener('click', toggleEdit);
  ed.value = S.savedMd;
  ed.addEventListener('input', function(){
    setStatus(ed.value.trim() === S.savedMd ? '' : 'Unsaved changes. Press Save to keep them.');
    clearTimeout(timer); timer = setTimeout(function(){ App.render(ed.value); }, 150);
  });
  ed.addEventListener('keydown', function(ev){
    if (ev.key === 'Tab') { ev.preventDefault(); var s = ed.selectionStart; ed.value = ed.value.slice(0, s) + '  ' + ed.value.slice(ed.selectionEnd); ed.selectionStart = ed.selectionEnd = s + 2; }
  });
  $('copyBtn').addEventListener('click', function(){
    function fallback(){ ed.select(); try { document.execCommand('copy'); setStatus('Copied.'); } catch (e) { setStatus('Select the text and copy it by hand.'); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ed.value).then(function(){ setStatus('Copied.'); }, fallback);
    else fallback();
  });
  $('openBtn').addEventListener('click', function(){ $('file').click(); });
  $('file').addEventListener('change', function(ev){
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(){ ed.value = String(r.result); App.render(ed.value); setStatus('Loaded ' + f.name + '. Press Save to keep it.'); };
    r.readAsText(f);
    ev.target.value = '';
  });
  $('saveBtn').addEventListener('click', function(){
    var blob = new Blob([ed.value.replace(/\s+$/, '') + '\n'], { type: 'text/markdown' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = S.param;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    setStatus('Downloaded ' + S.param + '. Replace maps/' + S.param + ' with it to keep your changes.');
  });
  fsb.textContent = 'Save to ' + S.param;
  fsb.addEventListener('click', saveToFile);
  ed.addEventListener('keydown', function(ev){ if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveToFile(); } });

  /* the .md file in maps/ is the source of truth; the demo inside index.html is the fallback */
  App.loadMap = function(){
    fetch('maps/' + S.param, { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('missing'); return r.text(); })
      .then(function(t){ S.savedMd = t.replace(/^\n+|\n+$/g, ''); ed.value = S.savedMd; App.render(S.savedMd); })
      .catch(function(){ setStatus('Could not load maps/' + S.param + ' (open through the local server, see README). Showing the built-in demo.'); });
  };
})(App);
