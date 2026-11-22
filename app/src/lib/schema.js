/* The Data file format (docs/adr/0001-one-json-data-file-per-map.md). Pure: no DOM, runs in the browser and in Node.
 *
 * {
 *   schemaVersion: 1, title,
 *   departments: [{ id, name, text: [], sections: [{ id, title|null, note }] }],
 *   sheets:      [{ id, kind: 'sheet'|'app', name, departmentId|null, sectionId|null, owner, details: [], crit|null, url|null, note }],
 *   links:       [{ id, fromId|fromName, toId|toName, label }],
 *   flows:       [{ id, title, every, teams: [], unreadable: [], steps: [{ id, team, title, day, sheetId|sheetName, ticket, note, standalone?,
 *                   triggers: [{ stepId, msg } | { team, msg }], backs: [{ stepId, msg }] }] }],
 *   tickets:     { nextId, extra: {}, items: [ticket as before, with target replaced by targetId (or targetRaw if it points at nothing)] },
 *   removed:     [{ id, kind, label, removedAt, entry, ... where it sat, so it can be put back }],
 *   meta:        { importedFrom?, legacy?: { mapMd?, flowsMd? } }
 * }
 * Sheets, links and tickets carry a permanent `sort` number (ascending in their list); see ops.js. Order of the arrays is the order on screen. Entries point at each other by id; names are only labels. */
export const SCHEMA_VERSION = 1;

function cyrb53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/* Same seed in, same id out: lets the import be re-run and give an identical file. */
export function idFactory() {
  const used = new Set();
  return (prefix, seed) => {
    for (let n = 0; ; n++) {
      const id = prefix + '_' + cyrb53(prefix + '|' + seed + (n ? '#' + n : '')).toString(36).padStart(8, '0').slice(0, 8);
      if (!used.has(id)) { used.add(id); return id; }
    }
  };
}

/* New entries made in the app get a random id. */
export function newId(prefix) {
  const b = new Uint8Array(6); crypto.getRandomValues(b);
  return prefix + '_' + [...b].map((x) => (x % 36).toString(36)).join('') + (Date.now() % 36).toString(36) + ((Date.now() >> 3) % 36).toString(36);
}

export function emptyData(title = 'Sheets map') {
  return { schemaVersion: SCHEMA_VERSION, title, departments: [], sheets: [], links: [], flows: [], tickets: { nextId: 1, extra: {}, items: [] }, removed: [], meta: {} };
}

/* Returns a list of problems; an empty list means the file is safe to open. */
export function validate(d) {
  const bad = [];
  if (!d || typeof d !== 'object') return ['not an object'];
  if (!Number.isInteger(d.schemaVersion)) bad.push('schemaVersion missing');
  else if (d.schemaVersion > SCHEMA_VERSION) bad.push(`schemaVersion ${d.schemaVersion} is newer than this app understands (${SCHEMA_VERSION})`);
  for (const k of ['departments', 'sheets', 'links', 'flows', 'removed']) if (!Array.isArray(d[k])) bad.push(`${k} must be a list`);
  if (!d.tickets || !Array.isArray(d.tickets.items)) bad.push('tickets.items must be a list');
  if (bad.length) return bad;
  const ids = new Set(), dup = (id, what) => { if (!id) bad.push(`${what} has no id`); else if (ids.has(id)) bad.push(`duplicate id ${id}`); else ids.add(id); };
  const secs = new Map();
  d.departments.forEach((x) => { dup(x.id, 'department'); (x.sections || []).forEach((s) => { dup(s.id, 'section'); secs.set(s.id, x.id); }); });
  const deptIds = new Set(d.departments.map((x) => x.id)), sheetIds = new Set(d.sheets.map((x) => x.id));
  /* a sheet in Removed can still be pointed at by tickets and flow steps */
  const known = new Set([...sheetIds, ...d.removed.filter((r) => r.entry && r.kind !== 'ticket').map((r) => r.entry.id)]);
  d.sheets.forEach((s) => {
    dup(s.id, 'sheet');
    if (s.departmentId && !deptIds.has(s.departmentId)) bad.push(`sheet ${s.id} points at a missing department`);
    if (s.sectionId && secs.get(s.sectionId) !== s.departmentId) bad.push(`sheet ${s.id} points at a section that is not in its department`);
  });
  d.links.forEach((l) => {
    dup(l.id, 'link');
    if (l.fromId ? !sheetIds.has(l.fromId) : !l.fromName) bad.push(`link ${l.id} has no valid start`);
    if (l.toId ? !sheetIds.has(l.toId) : !l.toName) bad.push(`link ${l.id} has no valid end`);
  });
  d.flows.forEach((f) => {
    dup(f.id, 'flow');
    const steps = new Set((f.steps || []).map((s) => s.id));
    (f.steps || []).forEach((s) => {
      dup(s.id, 'step');
      if (s.sheetId && !known.has(s.sheetId)) bad.push(`step ${s.id} points at a missing sheet`);
      [...(s.triggers || []), ...(s.backs || [])].forEach((t) => { if (t.stepId && !steps.has(t.stepId)) bad.push(`step ${s.id} points at a missing step`); });
    });
  });
  d.tickets.items.forEach((t) => { if (t.targetId && !known.has(t.targetId) && !deptIds.has(t.targetId)) bad.push(`ticket ${t.id} points at a missing target`); });
  const sorted = (list, what) => list.forEach((x, i) => { if (typeof x.sort !== 'number' || (i && x.sort <= list[i - 1].sort)) bad.push(`${what} ${x.id ?? i} is out of order or has no sort number`); });
  sorted(d.sheets, 'sheet'); sorted(d.links, 'link'); sorted(d.tickets.items, 'ticket');
  return bad;
}
