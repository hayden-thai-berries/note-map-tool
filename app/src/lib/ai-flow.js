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
