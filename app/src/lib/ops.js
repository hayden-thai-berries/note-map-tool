/* Edits on a Data file. Each function changes the draft it is given and nothing else (no DOM, no saving),
 * so they are easy to test and the app can undo them by keeping the previous copy.
 * Deleting never destroys: the Entry goes to data.removed with everything needed to put it back exactly.
 * Tickets and flow steps keep pointing at a removed sheet's id (the file stays valid while it is in Removed), so restoring needs no re-linking. */
import { newId } from './schema.js';

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

/* Every sheet, link and ticket carries a permanent `sort` number. It never changes when something is removed, so an Entry
 * restored later goes back exactly where it was, whatever else happened in between. The lists are kept in `sort` order. */
export const STEP = 1024;
function place(list, item) {
  const i = list.findIndex((x) => x.sort > item.sort);
  list.splice(i < 0 ? list.length : i, 0, item);
}
/* the next free `sort` for a new Entry: after everything, including what is in Removed */
export function nextSort(d, list) {
  const mine = list === d.sheets ? 'sheet' : list === d.links ? 'link' : 'ticket';
  const gone = d.removed.flatMap((r) => (mine === 'link' ? r.links?.map((x) => x.link) ?? [] : mine === 'ticket' ? (r.kind === 'ticket' ? [r.entry] : []) : r.kind === 'ticket' ? [] : [r.entry]));
  return Math.max(0, ...list.map((x) => x.sort || 0), ...gone.map((x) => x.sort || 0)) + STEP;
}

export function updateSheet(d, id, patch) { Object.assign(d.sheets.find((s) => s.id === id), patch); }

export function updateTicket(d, id, patch) {
  const t = d.tickets.items.find((x) => x.id === id);
  Object.assign(t, patch, { updated: today() });
  for (const [k, v] of Object.entries(t)) if (v === undefined) delete t[k];
}

export function removeSheet(d, id) {
  const i = d.sheets.findIndex((s) => s.id === id), sheet = d.sheets[i];
  const links = [];
  d.links.forEach((l) => { if (l.fromId === id || l.toId === id) links.push({ link: l }); });
  d.links = d.links.filter((l) => l.fromId !== id && l.toId !== id);
  d.sheets.splice(i, 1);
  d.removed.push({ id: newId('x'), kind: sheet.kind, label: sheet.name, removedAt: now(), entry: sheet, links });
}

export function removeTicket(d, id) {
  const i = d.tickets.items.findIndex((t) => t.id === id), t = d.tickets.items[i];
  d.tickets.items.splice(i, 1);
  d.removed.push({ id: newId('x'), kind: 'ticket', label: t.title || t.id, removedAt: now(), entry: t });
}

export function restore(d, removedId) {
  const i = d.removed.findIndex((r) => r.id === removedId), r = d.removed[i];
  if (r.kind === 'ticket') {
    place(d.tickets.items, r.entry);
  } else {
    place(d.sheets, r.entry);
    const known = new Set(d.sheets.map((s) => s.id));
    r.links.forEach(({ link }) => {
      /* the other end may itself be in Removed: hand the link to that bundle so it comes back with it, never dropped */
      const gone = [link.fromId, link.toId].find((x) => x && !known.has(x)), wait = gone && d.removed.find((o) => o !== r && o.kind !== 'ticket' && o.entry.id === gone);
      if (wait) wait.links.push({ link });
      else if (!gone) place(d.links, link);
    });
  }
  d.removed.splice(i, 1);
}

export function purge(d, removedId) { d.removed = d.removed.filter((r) => r.id !== removedId); }
