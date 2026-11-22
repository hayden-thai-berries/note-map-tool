// End-to-end proof that the new app works WITHOUT any legacy file or the old app: start from an empty folder, build a map with
// departments, sections, sheets, an app, a link, a ticket project and a flow through the UI, save, reload, and check the file.
// Runs on a throwaway sandbox only. Run: node scripts/e2e-from-scratch.mjs
import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { harness, reporter } from './lib/e2e-harness.mjs';
const lib = (f) => import(pathToFileURL(path.resolve(import.meta.dirname, '../app/src/lib', f)).href);
const { exportLegacy } = await lib('export-legacy.js'), { importLegacy } = await lib('import-legacy.js'), { roundTrip } = await lib('roundtrip.js'), { validate } = await lib('schema.js');
const r = reporter(), H = await harness({ files: [] }), { until, click, type, choose, typeLabel, js } = H;
const saved = () => until(`document.querySelector('[role=status]').textContent.includes('Saved')`, 'saved');
try {
  await H.goto(`${H.url}/#structure`);
  await until(`document.body.textContent.includes('Start your first map')`, 'first-map screen');
  r.check('an empty install offers to start a map (no legacy needed)', true);
  await typeLabel('Title', 'Test Organisation'); await click('Create map'); await until(`document.body.textContent.includes('Nothing to save')`, 'map opened');
  r.check('creating a map writes a valid empty data file', H.readJson('data/test-organisation.json').schemaVersion === 1 && validate(H.readJson('data/test-organisation.json')).length === 0);

  await click('Edit map'); await until(`document.body.textContent.includes('Add department')`, 'structure view');
  await type('Add department', 'Operations'); await click('Add department');
  await until(`!!document.querySelector('[aria-label="Add sheet"]') || !!document.querySelector('[aria-label="Add function"]')`, 'department added');
  await type('New member name', 'Kim Tran'); await type('New member role', 'Lead'); await click('Add member');
  await until(`!!document.querySelector('[aria-label="Member name"]')`, 'member added');
  await type('Add function', 'Weekly stock count'); await click('Add function');
  await until(`!!document.querySelector('[aria-label="Add sheet"]')`, 'function added');
  await type('Add sheet', 'Orders'); await click('Add sheet'); await until(`document.body.textContent.includes('Edit this sheet')`, 'sheet edit panel');
  await typeLabel('Owner', 'Kim'); await typeLabel('Criticality', 'high');
  r.check('the Owner field offers the department members', await js(`[...document.querySelectorAll('datalist option')].some((o) => o.value === 'Kim Tran')`));
  await typeLabel('File type', 'pdf'); await type('New documentation label', 'How-to'); await type('New documentation address', 'https://doc.test/how'); await js(`[...document.querySelectorAll('[aria-label="Documentation links"] button')].find((b) => b.textContent.trim() === 'Add').click(), true`);
  await until(`!!document.querySelector('[aria-label="Documentation address"]')`, 'doc link added');
  await H.blur(); await type('Add app', 'CRM'); await click('Add app'); await until(`document.querySelectorAll('[aria-label="From"]').length === 0`, 'settled');
  await choose('New link from', 'Orders'); await choose('New link to', 'CRM'); await type('New link method', 'IMPORTRANGE'); await click('Add link');
  await until(`document.querySelectorAll('[aria-label="From"]').length === 1`, 'link added');
  r.check('structure built in the UI', true);

  await click('Tickets & projects'); await until(`document.body.textContent.includes('New ticket')`, 'work'); await click('New ticket');
  await until(`!!document.querySelector('form[aria-label=Ticket]')`, 'ticket form');
  await typeLabel('Title', 'Rebuild Orders import'); await typeLabel('Type', 'project'); await typeLabel('About', await js(`[...document.querySelectorAll('select option')].find((o) => o.text === 'Orders').value`));
  await click('Create'); await until(`document.body.textContent.includes('Rebuild Orders import')`, 'ticket on board');
  r.check('ticket created from the form', true);
  await js(`document.querySelector('[aria-label^="Open P"]').click(), true`); await until(`!!document.querySelector('[aria-label="Hours worked"]')`, 'ticket opened again');
  await type('Hours worked', '2.5'); await type('What did you do', 'First test'); await click('Log'); await until(`document.body.textContent.includes('2.5 h')`, 'time logged');
  await click('Save'); await H.sleep(300);

  await click('Business flows'); await until(`!!document.querySelector('[aria-label="New flow name"]')`, 'flows view');
  await type('New flow name', 'Weekly stock'); await click('New flow'); await until(`!!document.querySelector('[aria-label="New step team"]')`, 'flow editor');
  await type('New step team', 'Operations'); await type('New step title', 'Count the stock'); await click('Add step');
  await until(`!!document.querySelector('[role=group][aria-label="Step 1"]')`, 'step 1');
  await type('New step team', 'Sales'); await type('New step title', 'Use the numbers'); await click('Add step');
  await until(`!!document.querySelector('[role=group][aria-label="Step 2"]')`, 'step 2');
  await choose('Add waits on', '1.', 'Step 2'); await choose('Step sheet', 'Orders', 'Step 1');
  await until(`document.querySelectorAll('.react-flow__node').length >= 4`, 'flow drawn', 8000);
  r.check('flow with two steps, an arrow and a sheet built in the UI', true);
  await click('Save'); await saved(); await H.shot('4-from-scratch');

  const f = H.readJson('data/test-organisation.json');
  r.check('data file is valid', validate(f).length === 0, validate(f).join('; '));
  r.check('everything was saved', f.departments.length === 1 && f.departments[0].sections.length === 1 && f.sheets.length === 2 && f.sheets.some((s) => s.kind === 'app') && f.links.length === 1 && f.tickets.items.length === 1 && f.flows[0].steps.length === 2 && f.flows[0].steps[1].triggers.length === 1 && !!f.flows[0].steps[0].sheetId, JSON.stringify({ d: f.departments.length, s: f.sheets.length, l: f.links.length, t: f.tickets.items.length, steps: f.flows[0]?.steps.length }));
  r.check('the ticket keeps its time log and link to the sheet', f.tickets.items[0].type === 'project' && f.tickets.items[0].log?.[0].hours === 2.5 && f.tickets.items[0].targetId === f.sheets.find((s) => s.name === 'Orders').id && /^P\d{8}\.001$/.test(f.tickets.items[0].id));
  const org = f.departments[0], orders = f.sheets.find((s) => s.name === 'Orders');
  r.check('members, file type and documentation link were saved', org.members?.length === 1 && org.members[0].name === 'Kim Tran' && org.members[0].role === 'Lead' && orders.type === 'pdf' && orders.docs?.[0].url === 'https://doc.test/how' && orders.docs[0].label === 'How-to', JSON.stringify({ m: org.members, t: orders.type, d: orders.docs }));
  const legacy = exportLegacy(f), back = importLegacy(legacy);
  r.check('it exports to the legacy formats and round-trips with nothing lost', roundTrip(legacy, back.data).length === 0 && /- Orders \| Kim \| high/.test(legacy.mapMd) && /Orders -> CRM \| IMPORTRANGE/.test(legacy.mapMd), legacy.mapMd.replace(/\n/g, ' / ').slice(0, 120));

  await H.goto(`${H.url}/?map=test-organisation#overview`); await until(`document.body.textContent.includes('Test Organisation') && [...document.querySelectorAll('.react-flow__node')].some((n) => n.textContent.startsWith('Orders'))`, 'reloaded');
  r.check('after a reload the map is still there', true);
  await js(`[...document.querySelectorAll('.react-flow__node')].find((n) => n.textContent.startsWith('Operations')).click(), true`);
  await until(`!!document.querySelector('[aria-label="Department Operations"]')`, 'department panel');
  r.check('clicking a department on the map shows its members, functions and open tickets', await js(`(() => { const t = document.querySelector('[aria-label="Department Operations"]').textContent; return t.includes('Kim Tran') && t.includes('Weekly stock count') && t.includes('1 open ticket'); })()`));
  r.check('no JavaScript errors in the page', H.errors.length === 0, H.errors[0] || '');
  console.log('\nsandbox (screenshot 4-from-scratch):', H.sandbox);
} catch (e) { console.log('FAIL ' + e.message); r.fail(); }
finally { H.finish(); }
process.exit(r.failed ? 1 : 0);
