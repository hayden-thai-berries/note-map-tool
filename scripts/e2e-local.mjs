// End-to-end check of the app in a real Chrome, on a THROWAWAY COPY of the demo files (never on maps/ or data/).
// Needs: Google Chrome (macOS path below), python3, node. Run: node scripts/e2e-local.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..'), sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sheets-map-e2e-'));
fs.mkdirSync(path.join(sandbox, 'maps'));
for (const f of fs.readdirSync(path.join(root, 'maps')).filter((x) => x.startsWith('demo.') && !x.endsWith('.bak'))) fs.copyFileSync(path.join(root, 'maps', f), path.join(sandbox, 'maps', f));
const SERVER = 8021, VITE = 5181, CDP = 9333, CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const procs = [], sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, opts) => { const p = spawn(cmd, args, { stdio: 'ignore', ...opts }); procs.push(p); return p; };
let failed = 0; const check = (name, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? ' | ' + extra : '')); if (!ok) failed++; };
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(sandbox, f), 'utf8'));
try {
  run('python3', ['server.py'], { cwd: root, env: { ...process.env, SHEETS_MAP_ROOT: sandbox, PORT: String(SERVER) } });
  run('node', [path.join(root, 'app/node_modules/vite/bin/vite.js'), '--port', String(VITE), '--strictPort'], { cwd: path.join(root, 'app'), env: { ...process.env, SHEETS_MAP_SERVER: `http://127.0.0.1:${SERVER}` } });
  run(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CDP}`, `--user-data-dir=${path.join(sandbox, 'chrome')}`, '--window-size=1440,900', 'about:blank']);
  for (let i = 0; i < 60; i++) { try { await fetch(`http://localhost:${VITE}/`); await fetch(`http://127.0.0.1:${CDP}/json/version`); break; } catch { await sleep(300); } }
  const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const wait = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); wait.get(d.id)?.(d); };
  const send = (method, params = {}) => new Promise((res) => { const n = ++id; wait.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
  const errors = [];
  const js = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
  const until = async (expr, what, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await js(expr)) return true; } catch {} await sleep(150); } throw new Error('timed out waiting for ' + what + ' | page says: ' + JSON.stringify(await js('document.body.innerText.slice(0, 300)').catch(() => '?')) + ' | errors: ' + errors.slice(0, 2).join(' ; ')); };
  const shot = async (name) => fs.writeFileSync(path.join(sandbox, name + '.png'), Buffer.from((await send('Page.captureScreenshot')).result.data, 'base64'));
  const T = (s) => `[...document.querySelectorAll('button,[role=button],summary')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(s)}))`;
  const click = (s) => js(`(${T(s)})?.click(), true`);
  const typeInto = (labelText, value) => js(`(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(labelText)})); const i = l.querySelector('input,textarea,select'); const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i), 'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
  await send('Runtime.enable'); ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(d.params.exceptionDetails).slice(0, 200)); });
  const goto = async (url) => { await send('Page.navigate', { url }); await sleep(800); };
  const status = () => js(`document.querySelector('[role=status]')?.textContent || ''`);

  // 1. a map with only old files offers the import, and creates the data file
  await goto(`http://localhost:${VITE}/?map=demo#overview`);
  await until(`document.body.textContent.includes('Import “demo”')`, 'import panel');
  check('map without a data file offers the import', await js(`document.body.textContent.includes('Checked: nothing is lost')`));
  await click('Create the data file'); await until(`document.body.textContent.includes('Nothing to save')`, 'map opened after import');
  const d0 = readJson('data/demo.json');
  check('import created data/demo.json', d0.schemaVersion === 1 && d0.sheets.length === 16, `${d0.sheets.length} sheets`);
  check('the old files were not touched', fs.readFileSync(path.join(sandbox, 'maps/demo.md'), 'utf8') === fs.readFileSync(path.join(root, 'maps/demo.md'), 'utf8'));

  // 2. edit a sheet, see "unsaved", save, file changes
  await until(`[...document.querySelectorAll('.react-flow__node')].some((n) => n.textContent.startsWith('Orders'))`, 'canvas');
  await js(`[...document.querySelectorAll('.react-flow__node')].find((n) => n.textContent.startsWith('Orders')).click(), true`);
  await until(`document.body.textContent.includes('Edit this sheet')`, 'edit panel');
  await typeInto('Owner', 'Zed');
  await until(`document.querySelector('[role=status]').textContent.includes('Unsaved')`, 'unsaved marker');
  check('an edit shows the unsaved marker', true);
  await click('Save'); await until(`document.querySelector('[role=status]').textContent.includes('Saved')`, 'saved');
  check('Save writes the edit to the data file', readJson('data/demo.json').sheets.find((s) => s.name === 'Orders').owner === 'Zed');
  await shot('1-edited');

  // 3. undo and redo
  await js(`document.activeElement?.blur?.(), true`);
  await click('Undo'); await until(`document.querySelector('[role=status]').textContent.includes('Unsaved')`, 'unsaved after undo');
  await click('Redo'); await until(`document.querySelector('[role=status]').textContent.includes('Nothing') || document.querySelector('[role=status]').textContent.includes('Saved')`, 'back to saved after redo');
  check('undo then redo returns to the saved state', true);

  // 4. delete -> Removed -> restore, byte-for-byte the same data
  const before = JSON.stringify(readJson('data/demo.json').sheets);
  await click('Delete…'); await click('Move to Removed');
  await until(`document.body.textContent.includes('Unsaved')`, 'unsaved after delete');
  await click('Save'); await until(`document.querySelector('[role=status]').textContent.includes('Saved')`, 'saved delete');
  const removed = readJson('data/demo.json');
  check('delete moves the sheet to Removed (and takes its links)', removed.removed.length === 1 && !removed.sheets.some((s) => s.name === 'Orders') && removed.removed[0].links.length >= 1, `${removed.removed[0].links.length} link(s) went with it`);
  await click('Removed'); await until(`document.body.textContent.includes('removed ')`, 'removed list'); await shot('2-removed');
  await click('Restore'); await click('Save'); await until(`document.querySelector('[role=status]').textContent.includes('Saved')`, 'saved restore');
  const restored = readJson('data/demo.json');
  check('restore brings back exactly the same sheets, links and order', JSON.stringify(restored.sheets) === before && JSON.stringify(restored.links) === JSON.stringify(d0.links) && restored.removed.length === 0);

  // 5. ticket status change + remove
  await click('Tickets & projects'); await until(`!!document.querySelector('select[aria-label=Status]')`, 'work board');
  await js(`(() => { const s = document.querySelector('select[aria-label=Status]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'done'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await click('Save'); await until(`document.querySelector('[role=status]').textContent.includes('Saved')`, 'saved ticket');
  check('ticket status change is saved', readJson('data/demo.json').tickets.items.some((t, i) => t.status === 'done' && t.updated === new Date().toISOString().slice(0, 10)));

  // 6. conflict: the file changes on disk behind the app's back
  const disk = readJson('data/demo.json'); disk.title = 'Edited elsewhere'; fs.writeFileSync(path.join(sandbox, 'data/demo.json'), JSON.stringify(disk, null, 2) + '\n');
  await click('Overview'); await until(`[...document.querySelectorAll('.react-flow__node')].some((n) => n.textContent.startsWith('Orders'))`, 'canvas again');
  await js(`[...document.querySelectorAll('.react-flow__node')].find((n) => n.textContent.startsWith('Orders')).click(), true`);
  await until(`document.body.textContent.includes('Edit this sheet')`, 'edit panel 2'); await typeInto('Owner', 'Mine');
  await click('Save'); await until(`document.querySelector('[role=alert]')?.textContent.includes('changed on disk')`, 'conflict banner');
  check('a save after an outside change is refused and nothing is overwritten', readJson('data/demo.json').title === 'Edited elsewhere' && readJson('data/demo.json').sheets.find((s) => s.name === 'Orders').owner !== 'Mine');
  await shot('3-conflict');
  await click('Overwrite'); await until(`document.querySelector('[role=status]').textContent.includes('Saved')`, 'saved after overwrite');
  const hist = fs.readdirSync(path.join(sandbox, 'data/.history/demo.json'));
  check('Overwrite keeps my edit and snapshots the other version first', readJson('data/demo.json').sheets.find((s) => s.name === 'Orders').owner === 'Mine' && hist.some((h) => JSON.parse(fs.readFileSync(path.join(sandbox, 'data/.history/demo.json', h), 'utf8')).title === 'Edited elsewhere'), `${hist.length} snapshots`);
  check('no JavaScript errors in the page', errors.length === 0, errors[0] || '');
  console.log('\nsandbox (screenshots 1-edited, 2-removed, 3-conflict):', sandbox);
} catch (e) { console.log('FAIL ' + e.message); failed++; }
finally { procs.forEach((p) => p.kill()); }
process.exit(failed ? 1 : 0);
