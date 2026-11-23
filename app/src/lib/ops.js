/* Edits on a Data file. Each function changes the draft it is given and nothing else (no DOM, no saving),
 * so they are easy to test and the app can undo them by keeping the previous copy. A function that cannot do what was
 * asked throws an Error with a plain-words reason; the app shows it and changes nothing.
 *
 * Deleting never destroys: a sheet, app, ticket, link, flow or flow step goes to data.removed with everything needed to put it
 * back exactly. Every one of those carries a permanent `sort` number that never changes when something is removed, so an Entry
 * restored later goes back exactly where it was. Tickets and flow steps keep pointing at a removed sheet's id, and arrows keep pointing at a removed step's id
 * (the file stays valid while it is in Removed), so restoring needs no re-linking. Departments and sections can only be deleted when empty,
 * so nothing is lost with them. */
import { newId, STEP, FILE_TYPES } from './schema.js';

export { STEP };
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const need = (cond, why) => { if (!cond) throw new Error(why); };
const pick = (list, id, what) => { const x = list.find((y) => y.id === id); need(x, `That ${what} no longer exists.`); return x; };

function place(list, item) {
  const i = list.findIndex((x) => x.sort > item.sort);
  list.splice(i < 0 ? list.length : i, 0, item);
}
/* the sort number for a new Entry after everything in `list`, counting what is in Removed too so a restore can never collide */
function sortAfter(d, what, list, flowId) {
  const gone = d.removed.flatMap((r) => {
    if (what === 'sheets') return r.kind === 'sheet' || r.kind === 'app' ? [r.entry] : [];
    if (what === 'links') return [...(r.links || []).map((x) => x.link), ...(r.kind === 'link' ? [r.entry] : [])];
    if (what === 'tickets') return r.kind === 'ticket' ? [r.entry] : [];
    if (what === 'flows') return r.kind === 'flow' ? [r.entry] : [];
    return r.kind === 'step' && r.flowId === flowId ? [r.entry] : [];
  });
  return Math.max(0, ...list.map((x) => x.sort || 0), ...gone.map((x) => x.sort || 0)) + STEP;
}
/* swap two neighbours' places: both their sort numbers and their positions */
function shift(list, id, dir, same = () => true) {
  const mine = list.findIndex((x) => x.id === id);
  let j = mine + dir; while (list[j] && !same(list[j])) j += dir;
  if (!list[j]) return;
  [list[mine].sort, list[j].sort] = [list[j].sort, list[mine].sort];
  [list[mine], list[j]] = [list[j], list[mine]];
}

/* ---- departments and sections ---- */
export function addDepartment(d, name) { need(name.trim(), 'A department needs a name.'); const dep = { id: newId('d'), name: name.trim(), text: [], sections: [] }; d.departments.push(dep); return dep.id; }
export function updateDepartment(d, id, patch) { Object.assign(pick(d.departments, id, 'department'), patch); }
export function removeDepartment(d, id) {
  const dep = pick(d.departments, id, 'department');
  need(!d.sheets.some((s) => s.departmentId === id), `"${dep.name}" still has sheets. Move or delete them first.`);
  need(!d.tickets.items.some((t) => t.targetId === id), `"${dep.name}" still has tickets about it.`);
  need(!(dep.members || []).length, `"${dep.name}" still has members. Remove them first.`);
  d.departments = d.departments.filter((x) => x.id !== id);
}
/* members of a department: who is in it and what they do. Sheet owners stay plain names; members are what the owner pick-list offers. */
const findMember = (d, depId, id) => pick(pick(d.departments, depId, 'department').members || [], id, 'member');
export function addMember(d, depId, { name, role = '', email = '' }) {
  need(String(name || '').trim(), 'A member needs a name.');
  const m = { id: newId('m'), name: name.trim(), role: role.trim() }; if (email.trim()) m.email = email.trim();
  (pick(d.departments, depId, 'department').members ||= []).push(m); return m.id;
}
export function updateMember(d, depId, id, patch) {
  if ('name' in patch) need(String(patch.name).trim(), 'A member needs a name.');
  const m = findMember(d, depId, id); Object.assign(m, patch); if (!m.email) delete m.email;
}
export function removeMember(d, depId, id) {
  const dep = pick(d.departments, depId, 'department'); findMember(d, depId, id);
  dep.members = dep.members.filter((m) => m.id !== id); if (!dep.members.length) delete dep.members;
}
/* replace the whole members list (a modal edits it as a draft). Rows without a name are dropped; new rows get an id; none left removes the field. */
export function setMembers(d, depId, list) {
  const dep = pick(d.departments, depId, 'department'), out = [];
  for (const m of list) {
    if (!String(m.name || '').trim()) continue;
    const x = { id: m.id || newId('m'), name: m.name.trim(), role: String(m.role || '').trim() }; if (String(m.email || '').trim()) x.email = m.email.trim();
    out.push(x);
  }
  if (out.length) dep.members = out; else delete dep.members;
}
export function shiftDepartment(d, id, dir) { const i = d.departments.findIndex((x) => x.id === id), j = i + dir; if (d.departments[j]) [d.departments[i], d.departments[j]] = [d.departments[j], d.departments[i]]; }
export function addSection(d, departmentId, title) { const sec = { id: newId('c'), title: title.trim() || null, note: '' }; pick(d.departments, departmentId, 'department').sections.push(sec); return sec.id; }
const findSection = (d, id) => { for (const dep of d.departments) { const s = dep.sections.find((x) => x.id === id); if (s) return { dep, s }; } throw new Error('That function no longer exists.'); };
export function updateSection(d, id, patch) { Object.assign(findSection(d, id).s, patch); }
export function removeSection(d, id) {
  const { dep, s } = findSection(d, id);
  need(!d.sheets.some((x) => x.sectionId === id), `"${s.title || 'This function'}" still has sheets. Move or delete them first.`);
  dep.sections = dep.sections.filter((x) => x.id !== id);
}
export function shiftSection(d, id, dir) { const { dep } = findSection(d, id), i = dep.sections.findIndex((x) => x.id === id), j = i + dir; if (dep.sections[j]) [dep.sections[i], dep.sections[j]] = [dep.sections[j], dep.sections[i]]; }

/* ---- sheets and apps ---- */
export function addSheet(d, { kind = 'sheet', name, departmentId = null, sectionId = null }) {
  need(name.trim(), 'A sheet needs a name.');
  if (kind === 'sheet') { need(departmentId && sectionId, 'A sheet belongs to a department and a function.'); need(findSection(d, sectionId).dep.id === departmentId, 'That function is not in that department.'); }
  const s = { id: newId('s'), kind, name: name.trim(), departmentId: kind === 'app' ? null : departmentId, sectionId: kind === 'app' ? null : sectionId, owner: '', details: [], crit: null, url: null, note: '', sort: sortAfter(d, 'sheets', d.sheets) };
  d.sheets.push(s); return s.id;
}
export function updateSheet(d, id, patch) {
  const s = pick(d.sheets, id, 'sheet');
  if ('type' in patch) need(!patch.type || FILE_TYPES.includes(patch.type), 'Unknown file type.');
  Object.assign(s, patch);
  if (!s.type || s.type === 'sheet') delete s.type; /* a Google Sheet is the default, so it is not written */
}
/* replace all documentation links (a modal edits them as a draft); rows without an address are dropped */
export function setDocs(d, sheetId, list) {
  const s = pick(d.sheets, sheetId, 'sheet'), docs = list.filter((x) => String(x.url || '').trim()).map((x) => ({ label: String(x.label || '').trim(), url: x.url.trim() }));
  if (docs.length) s.docs = docs; else delete s.docs;
}
/* documentation links of a file */
export function addDoc(d, sheetId, { label = '', url }) {
  need(String(url || '').trim(), 'A documentation link needs an address.');
  (pick(d.sheets, sheetId, 'sheet').docs ||= []).push({ label: label.trim(), url: url.trim() });
}
export function updateDoc(d, sheetId, index, patch) {
  const doc = (pick(d.sheets, sheetId, 'sheet').docs || [])[index]; need(doc, 'That documentation link no longer exists.');
  if ('url' in patch) need(String(patch.url).trim(), 'A documentation link needs an address.');
  Object.assign(doc, patch);
}
export function removeDoc(d, sheetId, index) {
  const s = pick(d.sheets, sheetId, 'sheet'); need((s.docs || [])[index], 'That documentation link no longer exists.');
  s.docs.splice(index, 1); if (!s.docs.length) delete s.docs;
}
export function moveSheet(d, id, sectionId) {
  const s = pick(d.sheets, id, 'sheet'); need(s.kind === 'sheet', 'Apps do not belong to a department.');
  const { dep } = findSection(d, sectionId);
  d.sheets = d.sheets.filter((x) => x !== s); s.departmentId = dep.id; s.sectionId = sectionId; s.sort = sortAfter(d, 'sheets', d.sheets); d.sheets.push(s);
}
export function shiftSheet(d, id, dir) { const s = pick(d.sheets, id, 'sheet'); shift(d.sheets, id, dir, (x) => x.sectionId === s.sectionId && x.kind === s.kind); }
export function removeSheet(d, id) {
  const i = d.sheets.findIndex((s) => s.id === id), sheet = d.sheets[i];
  need(sheet, 'That sheet no longer exists.');
  const links = d.links.filter((l) => l.fromId === id || l.toId === id).map((link) => ({ link }));
  d.links = d.links.filter((l) => l.fromId !== id && l.toId !== id);
  d.sheets.splice(i, 1);
  d.removed.push({ id: newId('x'), kind: sheet.kind, label: sheet.name, removedAt: now(), entry: sheet, links });
}

/* ---- links ---- */
export function addLink(d, { fromId, toId, label = '' }) {
  pick(d.sheets, fromId, 'sheet'); pick(d.sheets, toId, 'sheet'); need(fromId !== toId, 'A link needs two different sheets.');
  const l = { id: newId('l'), fromId, toId, label, sort: sortAfter(d, 'links', d.links) }; d.links.push(l); return l.id;
}
export function updateLink(d, id, patch) { Object.assign(pick(d.links, id, 'link'), patch); }
export function removeLink(d, id) {
  const i = d.links.findIndex((l) => l.id === id), l = d.links[i]; need(l, 'That link no longer exists.');
  const name = (x) => d.sheets.find((s) => s.id === x)?.name ?? '?';
  d.links.splice(i, 1);
  d.removed.push({ id: newId('x'), kind: 'link', label: `${l.fromId ? name(l.fromId) : l.fromName} → ${l.toId ? name(l.toId) : l.toName}`, removedAt: now(), entry: l });
}

/* ---- tickets ---- */
const PREFIX = { ticket: 'T', project: 'P', change: 'C', feature: 'F' };
export function newTicketId(d, type) {
  const base = (PREFIX[type] || 'T') + today().replace(/-/g, '') + '.';
  const all = [...d.tickets.items, ...d.removed.filter((r) => r.kind === 'ticket').map((r) => r.entry)];
  return base + String(1 + Math.max(0, ...all.filter((t) => String(t.id).startsWith(base)).map((t) => parseInt(String(t.id).slice(base.length), 10) || 0))).padStart(3, '0');
}
export function addTicket(d, fields) {
  const type = fields.type || 'ticket'; need((fields.title || '').trim(), 'A ticket needs a title.');
  const t = { id: newTicketId(d, type), title: fields.title.trim(), type, status: 'todo', owner: '', ...fields, updated: today(), sort: sortAfter(d, 'tickets', d.tickets.items) };
  t.title = t.title.trim(); for (const [k, v] of Object.entries(t)) if (v === undefined) delete t[k];
  d.tickets.items.push(t); return t.id;
}
export function updateTicket(d, id, patch) {
  const t = pick(d.tickets.items, id, 'ticket');
  if ('title' in patch) need(String(patch.title).trim(), 'A ticket needs a title.');
  Object.assign(t, patch, { updated: today() });
  for (const [k, v] of Object.entries(t)) if (v === undefined) delete t[k];
}
/* drag and drop / quick status change: Blocked may carry a reason, any other status clears it */
export const STATUSES = ['todo', 'doing', 'blocked', 'done'];
export function moveTicket(d, id, status, reason = '') {
  need(STATUSES.includes(status), 'Unknown status.');
  updateTicket(d, id, { status, blocked: status === 'blocked' ? String(reason).trim() : undefined });
}
export function addLog(d, id, { date, hours, note = '' }) {
  need(+hours > 0 && +hours <= 24, 'Hours must be between 0 and 24.');
  const t = pick(d.tickets.items, id, 'ticket'); (t.log ||= []).push({ date: date || today(), hours: +hours, note }); t.updated = today();
}
export function removeLog(d, id, index) { const t = pick(d.tickets.items, id, 'ticket'); t.log.splice(index, 1); if (!t.log.length) delete t.log; t.updated = today(); }
export function removeTicket(d, id) {
  const i = d.tickets.items.findIndex((t) => t.id === id), t = d.tickets.items[i]; need(t, 'That ticket no longer exists.');
  d.tickets.items.splice(i, 1);
  d.removed.push({ id: newId('x'), kind: 'ticket', label: t.title || t.id, removedAt: now(), entry: t });
}

/* ---- flows and their steps ---- */
export function addFlow(d, { title, every = '', teams = [] }) {
  need(title.trim(), 'A flow needs a title.');
  const f = { id: newId('f'), sort: sortAfter(d, 'flows', d.flows), title: title.trim(), every, teams, unreadable: [], steps: [] }; d.flows.push(f); return f.id;
}
export function updateFlow(d, id, patch) { Object.assign(pick(d.flows, id, 'flow'), patch); }
export function removeFlow(d, id) {
  const i = d.flows.findIndex((f) => f.id === id), f = d.flows[i]; need(f, 'That flow no longer exists.');
  d.flows.splice(i, 1);
  d.removed.push({ id: newId('x'), kind: 'flow', label: f.title, removedAt: now(), entry: f });
}
export function addStep(d, flowId, { team, title, afterStepId = null, ...rest }) {
  const f = pick(d.flows, flowId, 'flow'); need(team.trim() && title.trim(), 'A step needs a team and a title.');
  let sort = sortAfter(d, 'steps', f.steps, flowId), at = f.steps.length;
  if (afterStepId) { const i = f.steps.findIndex((x) => x.id === afterStepId); need(i >= 0, 'That step no longer exists.'); const next = f.steps[i + 1]; at = i + 1; if (next) sort = (f.steps[i].sort + next.sort) / 2; else sort = f.steps[i].sort + STEP; }
  const st = { id: newId('p'), sort, team: team.trim(), title: title.trim(), day: null, ticket: null, note: '', triggers: [], backs: [], ...rest };
  f.steps.splice(at, 0, st);
  if (!f.teams.some((t) => t.toLowerCase() === st.team.toLowerCase())) f.teams.push(st.team);
  return st.id;
}
const findStep = (d, flowId, stepId) => { const f = pick(d.flows, flowId, 'flow'); return { f, s: pick(f.steps, stepId, 'step') }; };
export function updateStep(d, flowId, stepId, patch) {
  const { f, s } = findStep(d, flowId, stepId);
  if ('title' in patch) need(String(patch.title).trim(), 'A step needs a title.');
  Object.assign(s, patch); for (const [k, v] of Object.entries(s)) if (v === undefined) delete s[k];
  if (s.team && !f.teams.some((t) => t.toLowerCase() === s.team.toLowerCase())) f.teams.push(s.team);
}
export function shiftStep(d, flowId, stepId, dir) { findStep(d, flowId, stepId); shift(pick(d.flows, flowId, 'flow').steps, stepId, dir); }
export function removeStep(d, flowId, stepId) {
  const { f, s } = findStep(d, flowId, stepId);
  f.steps = f.steps.filter((x) => x !== s);
  d.removed.push({ id: newId('x'), kind: 'step', label: `${f.title}: ${s.title}`, removedAt: now(), flowId, entry: s });
}

/* ---- lanes: a flow's teams, in the order they are drawn ---- */
const sameTeam = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export function addTeam(d, flowId, name) {
  const f = pick(d.flows, flowId, 'flow'), t = String(name).trim(); need(t, 'A lane needs a name.'); need(!f.teams.some((x) => sameTeam(x, t)), 'That lane already exists.'); f.teams.push(t);
}
export function renameTeam(d, flowId, from, to) {
  const f = pick(d.flows, flowId, 'flow'), t = String(to).trim(); need(t, 'A lane needs a name.');
  need(!f.teams.some((x) => sameTeam(x, t) && !sameTeam(x, from)), 'Another lane already has that name.');
  f.teams = f.teams.map((x) => (sameTeam(x, from) ? t : x));
  f.steps.forEach((s) => { if (sameTeam(s.team, from)) s.team = t; s.triggers.forEach((x) => { if (x.team && sameTeam(x.team, from)) x.team = t; }); });
}
export function moveTeam(d, flowId, team, dir) {
  const f = pick(d.flows, flowId, 'flow'), i = f.teams.findIndex((x) => sameTeam(x, team)), j = i + dir;
  if (i >= 0 && f.teams[j]) [f.teams[i], f.teams[j]] = [f.teams[j], f.teams[i]];
}
export function removeTeam(d, flowId, team) {
  const f = pick(d.flows, flowId, 'flow'); need(!f.steps.some((s) => sameTeam(s.team, team)), 'Move or delete the steps in this lane first.');
  f.teams = f.teams.filter((x) => !sameTeam(x, team));
}

/* ---- Removed ---- */
export function restore(d, removedId) {
  const i = d.removed.findIndex((r) => r.id === removedId), r = d.removed[i];
  if (r.kind === 'ticket') place(d.tickets.items, r.entry);
  else if (r.kind === 'flow') place(d.flows, r.entry);
  else if (r.kind === 'step') {
    const f = d.flows.find((x) => x.id === r.flowId); need(f, 'Restore the flow first: this step belongs to it.');
    place(f.steps, r.entry);
  } else if (r.kind === 'link') {
    need([r.entry.fromId, r.entry.toId].every((x) => !x || d.sheets.some((s) => s.id === x)), 'Restore the sheets this link connects first.');
    place(d.links, r.entry);
  } else {
    place(d.sheets, r.entry);
    const known = new Set(d.sheets.map((s) => s.id));
    r.links.forEach(({ link }) => {
      /* the other end may itself be in Removed: hand the link to that bundle so it comes back with it, never dropped */
      const gone = [link.fromId, link.toId].find((x) => x && !known.has(x)), wait = gone && d.removed.find((o) => o !== r && o.kind !== 'ticket' && o.entry?.id === gone);
      if (wait) wait.links.push({ link });
      else if (!gone) place(d.links, link);
    });
  }
  d.removed.splice(i, 1);
}
export function purge(d, removedId) { d.removed = d.removed.filter((r) => r.id !== removedId); }
