/* The open map: its Data file, what has been saved, and the undo history. Every change goes through apply(), so there is
 * one place that checks the file is still valid, tracks "unsaved", and keeps the previous copy for undo.
 * Views read the old-style model (data.js), which is re-derived from the Data file after every change. */
import { useSyncExternalStore } from 'react';
import { exportLegacy } from './export-legacy.js';
import { importLegacy } from './import-legacy.js';
import { roundTrip } from './roundtrip.js';
import { validate } from './schema.js';
import { loadData, loadRecords, saveFile } from './store.js';
import { setRecords } from '../data.js';

const COALESCE_MS = 2000, MAX_UNDO = 100;
let s = { name: null, data: null, baseHash: null, savedText: '', undo: [], redo: [], status: 'idle', savedAt: null, conflict: false, error: null, rev: 0 };
const listeners = new Set();
export const subscribe = (f) => (listeners.add(f), () => listeners.delete(f));
export const getState = () => s;
export const useRecords = () => useSyncExternalStore(subscribe, getState);
const set = (patch) => { s = { ...s, ...patch, rev: s.rev + 1 }; listeners.forEach((f) => f()); };
const text = (d) => JSON.stringify(d, null, 2) + '\n';

function derive(d) { const x = exportLegacy(d); setRecords({ mapMd: x.mapMd, flowsMd: x.flowsMd, ticketsJson: x.ticketsJson }); }
export const isDirty = (st = s) => !!st.data && JSON.stringify(st.data) !== st.savedText;
export const sheetByKey = (key) => s.data?.sheets.find((x) => x.name.toLowerCase() === key);

export function openData(name, data, hash) {
  const bad = validate(data);
  if (bad.length) throw new Error('This data file is not valid: ' + bad.slice(0, 3).join('; '));
  derive(data);
  set({ name, data, baseHash: hash, savedText: JSON.stringify(data), undo: [], redo: [], status: 'idle', conflict: false, error: null });
}

/* fn changes a copy of the data; the copy replaces it only if it is still a valid file */
export function apply(fn, { key = null } = {}) {
  const next = structuredClone(s.data); fn(next);
  const bad = validate(next);
  if (bad.length) { console.error('edit refused:', bad); set({ error: 'That change would break the data file, so it was not made: ' + bad[0] }); return false; }
  const last = s.undo[s.undo.length - 1], t = Date.now(), merge = key && last && last.key === key && t - last.t < COALESCE_MS;
  const undo = merge ? s.undo.map((u, i) => (i === s.undo.length - 1 ? { ...u, t } : u)) : [...s.undo, { data: s.data, key, t }].slice(-MAX_UNDO);
  derive(next);
  set({ data: next, undo, redo: [], error: null });
  return true;
}
export function undo() { if (!s.undo.length) return; const u = s.undo[s.undo.length - 1]; derive(u.data); set({ data: u.data, undo: s.undo.slice(0, -1), redo: [...s.redo, { data: s.data }] }); }
export function redo() { if (!s.redo.length) return; const r = s.redo[s.redo.length - 1]; derive(r.data); set({ data: r.data, redo: s.redo.slice(0, -1), undo: [...s.undo, { data: s.data, key: null, t: 0 }] }); }

export async function save({ force = false } = {}) {
  if (!s.data || s.status === 'saving') return;
  const snap = JSON.stringify(s.data), body = text(s.data);
  set({ status: 'saving', error: null });
  try {
    const r = await saveFile(`/data/${s.name}.json`, body, s.baseHash, { force });
    if (r.conflict) set({ status: 'idle', conflict: true });
    else set({ status: 'saved', savedAt: new Date(), baseHash: r.hash, savedText: snap, conflict: false });
  } catch (e) { set({ status: 'error', error: e.message }); }
}
/* the file changed on disk since it was opened: keep my edits (overwrite) or take the file as it is now (reload) */
export async function resolveConflict(choice) {
  if (choice === 'overwrite') return save({ force: true });
  if (choice === 'reload') { const got = await loadData(s.name); if (got) openData(s.name, got.data, got.hash); }
  set({ conflict: false });
}

/* Maps that only exist as old files: preview the import, then create the Data file (refuses if it already exists). */
export async function previewImport(name) {
  const old = await loadRecords(name + '.md'), src = { mapMd: old.mapMd, flowsMd: old.flowsMd, ticketsJson: old.ticketsJson };
  const { data, report } = importLegacy({ ...src, source: { map: name + '.md' } });
  return { data, report, problems: roundTrip(src, data) };
}
export async function createFromLegacy(name, data) {
  const r = await saveFile(`/data/${name}.json`, text(data), null);
  if (r.conflict) throw new Error(`data/${name}.json already exists`);
  const got = await loadData(name); openData(name, got.data, got.hash);
}
