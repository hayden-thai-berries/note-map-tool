/* Turn what the AI answered (checked on the server by ai_flow.py) into edits of the Data file. Pure: no DOM, no network.
 * Everything happens inside one apply(), so one Undo takes the whole generated flow back. */
import * as o from './ops.js';

const NOTE_AT = { x: 20, y: 86 };   // a note pinned to a step starts just below it (the same offset a hand-added note gets)
const LANE_H = 144, NOTE_W = 200;   // lane height with its gap, and the room one free note takes: free notes go in a row under the lanes

/* Fill an empty flow with the generated steps, arrows and notes. Returns the new step ids. */
export function applyGenerated(d, flowId, gen) {
  const f = d.flows.find((x) => x.id === flowId);
  if (!f) throw new Error('That flow no longer exists.');
  if (f.steps.length) throw new Error('Generate only fills an empty flow.');
  if (!gen?.steps?.length) throw new Error('The AI made no steps.');
  const sheetId = (name) => d.sheets.find((s) => s.name.toLowerCase() === String(name || '').toLowerCase())?.id;
  gen.teams.forEach((t) => { if (!f.teams.some((x) => x.toLowerCase() === t.toLowerCase())) f.teams.push(t); });
  const ids = gen.steps.map((st) => {
    const rest = { note: st.note || '' };
    if (st.kind) rest.kind = st.kind;
    if (st.day) rest.day = st.day;
    const sid = st.sheet && sheetId(st.sheet);
    if (sid) rest.sheetId = sid; else if (st.sheetName || st.sheet) rest.sheetName = st.sheetName || st.sheet;
    return o.addStep(d, flowId, { team: st.team, title: st.title, ...rest });
  });
  gen.steps.forEach((st, i) => {
    const s = f.steps.find((x) => x.id === ids[i]);
    s.triggers = st.waits.filter((w) => w.on < i).map((w) => ({ stepId: ids[w.on], msg: w.msg || '' }));
    /* no "waits on" arrow means "follows the step before" - except for a second start, which begins on its own */
    if (!s.triggers.length && st.kind === 'start' && i > 0) s.standalone = true;
  });
  let free = 0;
  gen.notes.forEach((n) => {
    if (n.step != null && ids[n.step]) o.addNote(d, flowId, { text: n.text, x: NOTE_AT.x, y: NOTE_AT.y, stepId: ids[n.step] });
    else o.addNote(d, flowId, { text: n.text, x: 20 + (free++) * NOTE_W, y: f.teams.length * LANE_H + 20 });
  });
  return ids;
}

/* ---------- Ask AI: change a flow that already has steps ---------- */

/* the arrows into a step as the diagram draws them: a "waits on" arrow to a step, an arrow from the nearest earlier step of a named team,
 * or (when the step has no arrow of its own) the one automatic arrow from the step before. Same rules as lib/flows-parser.js. */
function effectiveWaits(f, i) {
  const s = f.steps[i], out = [];
  s.triggers.forEach((t) => {
    if (t.stepId) { const k = f.steps.findIndex((x) => x.id === t.stepId); if (k >= 0 && k < i) out.push({ on: k, msg: t.msg || '' }); return; }
    for (let j = i - 1; j >= 0; j--) if (f.steps[j].team.toLowerCase() === String(t.team || '').toLowerCase()) { out.push({ on: j, msg: t.msg || '' }); return; }
  });
  return out.length || s.triggers.length || s.standalone || i === 0 ? out : [{ on: i - 1, msg: '' }];
}

/* The flow as the AI is told about it: only the words on it (never ticket ids), with the arrows spelled out. */
export function flowForAi(flow, sheets = []) {
  const sheet = (s) => (s.sheetId ? sheets.find((x) => x.id === s.sheetId)?.name : s.sheetName) || null;
  return { steps: flow.steps.map((s, i) => ({ team: s.team, title: s.title, kind: s.kind || 'step', day: s.day || null, sheet: sheet(s), note: s.note || '', waits: effectiveWaits(flow, i) })) };
}

/* The server strips emails and ticket ids before the AI sees a text, and the AI may hand that stripped text back. A text that is just the stripped
 * copy of the real one is "not changed", so the real words (and the real email) are never overwritten by "[email removed]". */
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, TICKET = /\b[A-Z]{1,2}\d{8}\.\d{2,4}\b/g;
const stripped = (t) => String(t ?? '').replace(EMAIL, '[email removed]').replace(TICKET, '[ticket]');
const same = (want, was) => want === was || (typeof was === 'string' && want === stripped(was));

const key = (ws) => ws.map((w) => `${w.on ?? w.stepId}|${w.msg || ''}`).sort().join(',');
const sheetLabel = (d, s) => (s.sheetId ? d.sheets.find((x) => x.id === s.sheetId)?.name : s.sheetName) || '';

/* Make the changes the AI described. Steps it keeps (by `was`) keep their id, arrows and position, and only the words it changed are touched; steps it
 * leaves out go to Removed (so they can be restored); new steps are added where the AI put them. With { keepRemoved: true } (for the preview) the
 * steps it would delete stay in place so they can be drawn struck through. Returns what changed: { ids, added, changed: [{ id, changes: [{ field, from, to }] }], removed, arrowsAdded, arrowsRemoved }. */
export function applyEdit(d, flowId, edit, { keepRemoved = false } = {}) {
  const f = d.flows.find((x) => x.id === flowId);
  if (!f) throw new Error('That flow no longer exists.');
  if (!f.steps.length) throw new Error('There is nothing to change yet; use Generate flow on an empty flow.');
  if (!edit?.steps?.length) throw new Error('The AI made no steps.');
  const cur = [...f.steps], before = cur.map((_, i) => effectiveWaits(f, i)), sheetId = (n) => d.sheets.find((s) => s.name.toLowerCase() === String(n || '').toLowerCase())?.id;
  const kept = new Set(), ids = [], out = { ids, added: [], changed: [], removed: [], arrowsAdded: 0, arrowsRemoved: 0 };
  /* 1. the steps: keep, retype or add */
  edit.steps.forEach((st, i) => {
    const s = st.was != null ? cur[st.was] : null;
    if (s && !kept.has(s)) {
      kept.add(s); ids[i] = s.id;
      /* a field the AI left out (it is absent from `st`) stays as it is */
      const want = { team: st.team, title: st.title }, was = { team: s.team, title: s.title, kind: s.kind, day: s.day || null, note: s.note || '' };
      if ('kind' in st) want.kind = !st.kind || st.kind === 'step' ? undefined : st.kind;
      if ('day' in st) want.day = st.day || null;
      if ('note' in st) want.note = st.note || '';
      const sid = st.sheet && sheetId(st.sheet), nameWanted = sid ? sheetLabel(d, { sheetId: sid }) : (st.sheetName || st.sheet || '');
      const patch = {}, changes = [];
      for (const k of Object.keys(want)) if (!same(want[k], was[k]) && !(k === 'team' && want.team.toLowerCase() === was.team.toLowerCase())) { patch[k] = want[k]; changes.push({ field: k, from: was[k] ?? '', to: want[k] ?? '' }); }
      if (('sheet' in st || 'sheetName' in st) && !same(nameWanted, sheetLabel(d, s))) { patch.sheetId = sid || undefined; patch.sheetName = sid ? undefined : (nameWanted || undefined); changes.push({ field: 'sheet', from: sheetLabel(d, s), to: nameWanted }); }
      if (changes.length) { o.updateStep(d, flowId, s.id, patch); out.changed.push({ id: s.id, changes }); }
    } else {
      const rest = { note: st.note || '' }; if (st.kind && st.kind !== 'step') rest.kind = st.kind; if (st.day) rest.day = st.day;
      const sid = st.sheet && sheetId(st.sheet); if (sid) rest.sheetId = sid; else if (st.sheetName || st.sheet) rest.sheetName = st.sheetName || st.sheet;
      const prev = i > 0 ? ids[i - 1] : null;
      ids[i] = o.addStep(d, flowId, { team: st.team, title: st.title, ...rest, ...(prev ? { afterStepId: prev } : {}) });
      if (!prev) { const n = f.steps.pop(); n.sort = f.steps[0].sort - 1024; f.steps.unshift(n); }
      out.added.push(ids[i]);
    }
  });
  /* 2. the arrows: a kept step whose arrows the AI did not change is left exactly as it was (the automatic arrow stays automatic) */
  edit.steps.forEach((st, i) => {
    const s = f.steps.find((x) => x.id === ids[i]), waits = (st.waits || []).filter((w) => w.on < i && ids[w.on]).map((w) => ({ stepId: ids[w.on], msg: w.msg || '' }));
    const was = st.was != null && cur[st.was] === s ? before[st.was].map((w) => ({ stepId: cur[w.on].id, msg: w.msg })) : null;
    if (was) {
      if (key(was.map((w) => ({ on: w.stepId, msg: w.msg }))) === key(waits.map((w) => ({ on: w.stepId, msg: w.msg })))) return;
      const have = new Set(was.map((w) => `${w.stepId}|${w.msg}`)), want = new Set(waits.map((w) => `${w.stepId}|${w.msg}`));
      out.arrowsAdded += [...want].filter((x) => !have.has(x)).length; out.arrowsRemoved += [...have].filter((x) => !want.has(x)).length;
    } else out.arrowsAdded += waits.length;
    s.triggers = waits;
    if (!s.triggers.length && (was || st.kind === 'start') && f.steps.indexOf(s) > 0) s.standalone = true; else delete s.standalone;
  });
  /* 3. the steps the AI left out */
  cur.filter((s) => !kept.has(s)).forEach((s) => { out.removed.push(s.id); if (!keepRemoved) o.removeStep(d, flowId, s.id); });
  /* 4. new notes */
  let free = 0;
  (edit.notes || []).forEach((n) => {
    if (n.step != null && ids[n.step]) o.addNote(d, flowId, { text: n.text, x: NOTE_AT.x, y: NOTE_AT.y, stepId: ids[n.step] });
    else o.addNote(d, flowId, { text: n.text, x: 20 + (free++) * NOTE_W, y: f.teams.length * LANE_H + 20 });
  });
  return out;
}
