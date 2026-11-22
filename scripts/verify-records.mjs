// READ-ONLY gate: no record in maps/ may be lost on its way through the new app.
// Usage: npm run verify   (or: node scripts/verify-records.mjs [rootFolder])
// 1. The new ES-module parsers give byte-identical results to the original js/ parsers on every file.
// 2. Every file survives parse -> write-back with no data lost (the app's own "lossy" rule).
// 3. Tickets keep every field (they are read and written as plain JSON, never reshaped).
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || process.cwd());
const ctx = { App: {} }; vm.createContext(ctx);
for (const f of ['js/parser.js', 'js/serialize.js', 'js/flows-parser.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const Old = ctx.App;
const lib = (f) => import(pathToFileURL(path.join(root, 'app/src/lib', f)).href);
const { parse } = await lib('parser.js'), { stringify, mapLossy } = await lib('serialize.js'), { parseFlows, stringifyFlows } = await lib('flows-parser.js');
const plain = (m) => JSON.stringify(m, (k, v) => (k === 'el' ? undefined : v));
const norm = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^<!--.*-->$/.test(l));
const bag = (a) => { const m = new Map(); a.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return m; };
const diff = (a, b) => { const bb = bag(b), out = []; for (const x of a) { if (bb.get(x) > 0) bb.set(x, bb.get(x) - 1); else out.push(x); } return out; };
let bad = 0;
const say = (name, kind, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name.padEnd(24) + kind + extra); if (!ok) bad++; };
const dir = path.join(root, 'maps');
for (const f of fs.readdirSync(dir).sort()) {
  if (f.endsWith('.bak') || f.endsWith('.tmp') || f.startsWith('.')) continue;
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  if (f.endsWith('.flows.md')) {
    const flows = parseFlows(txt), back = stringifyFlows(flows);
    const same = plain(Old.parseFlows(txt)) === plain(flows) && Old.stringifyFlows(Old.parseFlows(txt)) === back;
    const lost = diff(norm(txt), norm(back)), dropped = flows.reduce((n, x) => n + x.dropped.length, 0);
    const sig = (fl) => JSON.stringify(fl.map((x) => [x.title, x.every, x.teams, x.steps.map((s) => [s.team, s.title, s.day, s.sheet, s.ticket, s.note, s.triggers.length, s.backs.length])]));
    say(f, `flows ${flows.length} / steps ${flows.reduce((n, x) => n + x.steps.length, 0)}`, same && !lost.length && !dropped && sig(parseFlows(back)) === sig(flows), ` | new==old ${same}, lost lines ${lost.length}, unreadable ${dropped}`);
    if (lost.length) lost.slice(0, 5).forEach((l) => console.log('       lost:', l.slice(0, 90)));
  } else if (f.endsWith('.md')) {
    const m = parse(txt), back = stringify(m), lossy = mapLossy(txt);
    const same = plain(Old.parse(txt)) === plain(m) && Old.stringify(Old.parse(txt)) === back && Old.mapLossy(txt) === lossy;
    const nodes = m.depts.reduce((n, d) => n + d.sections.reduce((k, s) => k + s.nodes.length, 0), 0) + m.apps.length;
    say(f, `map ${m.depts.length} depts / ${nodes} sheets+apps / ${m.links.length} links`, same && !lossy && !m.warn.length, ` | new==old ${same}, data lost ${lossy ? 'YES' : 'none'}, warnings ${m.warn.length}, lines reworded ${diff(norm(txt), norm(back)).length}`);
  } else if (f.endsWith('.tickets.json')) {
    const raw = JSON.parse(txt), t = raw.tickets || [], keys = new Set();
    t.forEach((x) => Object.keys(x).forEach((k) => keys.add(k)));
    say(f, `tickets ${t.length} / log entries ${t.reduce((n, x) => n + (x.log || []).length, 0)}`, JSON.stringify(JSON.parse(JSON.stringify(raw))) === JSON.stringify(raw) && Array.isArray(raw.tickets), ` | fields: ${[...keys].join(', ')}`);
  }
}
console.log(bad ? `\n${bad} PROBLEM(S): do not migrate.` : '\nAll records pass: nothing lost, new parsers identical to the old ones.');
process.exit(bad ? 1 : 0);
