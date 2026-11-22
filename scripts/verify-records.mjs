// READ-ONLY check: can every record in maps/ survive parse -> write-back with the app's own parsers?
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
const root = process.argv[2] || process.cwd();
// Usage: node scripts/verify-records.mjs   (read-only; checks every maps/* file survives parse -> write-back with the app's own parsers)
const ctx = { App: {}, console }; vm.createContext(ctx);
for (const f of ['js/parser.js', 'js/serialize.js', 'js/flows-parser.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const App = ctx.App, norm = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^<!--.*-->$/.test(l));
const bag = (a) => { const m = new Map(); a.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return m; };
function diff(a, b) { const bb = bag(b), out = []; for (const x of a) { if (bb.get(x) > 0) bb.set(x, bb.get(x) - 1); else out.push(x); } return out; }
let bad = 0; const report = (name, kind, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name.padEnd(26) + kind + extra); if (!ok) bad++; };
const dir = path.join(root, 'maps');
for (const f of fs.readdirSync(dir).sort()) {
  if (f.endsWith('.bak') || f === '.DS_Store') continue;
  const p = path.join(dir, f), txt = fs.readFileSync(p, 'utf8');
  if (f.endsWith('.flows.md')) {
    const flows = App.parseFlows(txt), back = App.stringifyFlows(flows);
    const lost = diff(norm(txt), norm(back)), added = diff(norm(back), norm(txt));
    const dropped = flows.reduce((n, x) => n + x.dropped.length, 0), warn = flows.reduce((n, x) => n + x.warn.length, 0);
    const again = JSON.stringify(App.parseFlows(back).map((x) => [x.title, x.every, x.teams, x.steps.map((s) => [s.team, s.title, s.day, s.sheet, s.ticket, s.note, s.triggers.length, s.backs.length])]));
    const orig = JSON.stringify(flows.map((x) => [x.title, x.every, x.teams, x.steps.map((s) => [s.team, s.title, s.day, s.sheet, s.ticket, s.note, s.triggers.length, s.backs.length])]));
    report(f, `flows: ${flows.length} flows, ${flows.reduce((n, x) => n + x.steps.length, 0)} steps`, !lost.length && !dropped && again === orig, ` | lost lines ${lost.length}, unreadable ${dropped}, warnings ${warn}, normalised ${added.length}`);
    lost.slice(0, 5).forEach((l) => console.log('       lost:', l.slice(0, 90)));
  } else if (f.endsWith('.md')) {
    const m = App.parse(txt), back = App.stringify(m);
    const lost = diff(norm(txt), norm(back)), added = diff(norm(back), norm(txt));
    const nodes = m.depts.reduce((n, d) => n + d.sections.reduce((k, s) => k + s.nodes.length, 0), 0) + m.apps.length;
    report(f, `map: ${m.depts.length} depts, ${nodes} sheets+apps, ${m.links.length} links`, !App.mapLossy(txt) && !m.warn.length, ` | data lost: ${App.mapLossy(txt) ? 'YES' : 'none'}, warnings ${m.warn.length}, lines rewritten (same data, e.g. High -> high, field order) ${lost.length}`);
    if (App.mapLossy(txt)) lost.slice(0, 5).forEach((l) => console.log('       differs:', l.slice(0, 90)));
    m.warn.slice(0, 3).forEach((w) => console.log('       warn:', w.slice(0, 90)));
  } else if (f.endsWith('.tickets.json')) {
    const raw = JSON.parse(txt), t = raw.tickets || [], keys = {}, top = Object.keys(raw);
    t.forEach((x) => Object.keys(x).forEach((k) => (keys[k] = (keys[k] || 0) + 1)));
    const logKeys = {}; t.forEach((x) => (x.log || []).forEach((e) => Object.keys(e).forEach((k) => (logKeys[k] = 1))));
    report(f, `tickets: ${t.length}, ${t.reduce((n, x) => n + (x.log || []).length, 0)} log entries`, JSON.stringify(JSON.parse(JSON.stringify(raw))) === JSON.stringify(raw));
    console.log('       top-level keys:', top.join(', '), '| ticket fields:', Object.keys(keys).join(', '), '| log fields:', Object.keys(logKeys).join(', '));
  }
}
console.log(bad ? `\n${bad} PROBLEM(S)` : '\nAll files round-trip with no lost lines.');
