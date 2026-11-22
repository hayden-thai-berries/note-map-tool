/* Data file -> the old three file contents. Used for the "Export as legacy files" button and to prove the import lost nothing. */
import { stringify } from './serialize.js';
import { stringifyFlows } from './flows-parser.js';

export function exportLegacy(data) {
  /* a sheet in Removed keeps its name for anything still pointing at it */
  const nameOf = (id) => data.sheets.find((s) => s.id === id)?.name ?? data.removed.find((r) => r.kind !== 'ticket' && r.entry.id === id)?.entry.name;
  const node = (s) => ({ name: s.name, parts: [s.owner, ...(s.details || [])].filter((p) => p), crit: s.crit, url: s.url, note: s.note });
  const model = {
    title: data.title,
    depts: data.departments.map((d) => ({ name: d.name, text: d.text.slice(), sections: d.sections.map((sc) => ({ title: sc.title, note: sc.note, nodes: data.sheets.filter((s) => s.sectionId === sc.id).map(node) })) })),
    apps: data.sheets.filter((s) => s.kind === 'app').map(node),
    links: data.links.map((l) => ({ from: l.fromId ? nameOf(l.fromId) : l.fromName, to: l.toId ? nameOf(l.toId) : l.toName, label: l.label || '' })),
  };
  const flows = data.flows.map((f) => {
    const steps = f.steps.map((s) => ({ team: s.team, title: s.title, day: s.day, sheet: s.sheetId ? nameOf(s.sheetId) : s.sheetName || null, ticket: s.ticket, note: s.note, standalone: !!s.standalone, triggers: [], backs: [] }));
    const at = (stepId) => steps[f.steps.findIndex((x) => x.id === stepId)];
    f.steps.forEach((s, i) => {
      steps[i].triggers = s.triggers.map((t) => (t.stepId ? { ref: at(t.stepId), msg: t.msg } : { team: t.team, msg: t.msg }));
      steps[i].backs = s.backs.map((b) => ({ ref: at(b.stepId), msg: b.msg }));
    });
    return { title: f.title, every: f.every, teams: f.teams, steps };
  });
  const target = (t) => {
    const name = nameOf(t), dept = data.departments.find((d) => d.id === t);
    return name ? name.toLowerCase() : dept ? 'dept:' + dept.name : '';
  };
  const items = data.tickets.items.map((t) => {
    const o = {};
    for (const [k, v] of Object.entries(t)) { if (k === 'sort') continue; else if (k === 'targetId') o.target = target(v); else if (k === 'targetRaw') o.target = v; else o[k] = v; }
    return o;
  });
  return { mapMd: stringify(model), flowsMd: flows.length ? stringifyFlows(flows) : '', ticketsJson: { nextId: data.tickets.nextId, ...data.tickets.extra, tickets: items } };
}
