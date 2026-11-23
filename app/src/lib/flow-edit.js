/* Drawing on the flow canvas, as plain edits of the Data file (called from inside apply()). Pure: no DOM.
 * The canvas shows a copy of each flow built from the file, so an arrow it draws is found again by its place in the step's list.
 * That copy leaves out arrows to steps that are in Removed, so a place in it is turned back into a place in the file here. */

const live = (f, id) => f.steps.some((x) => x.id === id);
/* the n-th arrow the canvas shows for a list of triggers or backs, as its place in the file's list (-1 if it is not there) */
export function placeInFile(f, list, n) {
  let seen = -1;
  for (let k = 0; k < list.length; k++) if (!list[k].stepId || live(f, list[k].stepId)) { seen++; if (seen === n) return k; }
  return -1;
}

/* A new arrow between two steps, by their place in the flow. Into a later step it is a "waits on" arrow; to an earlier step (or from
 * the bottom handle) it is a dashed "sent back" arrow. Returns false when there was nothing to add. */
export function connect(d, flowId, a, b, back) {
  const f = d.flows.find((x) => x.id === flowId), A = f?.steps[a], B = f?.steps[b];
  if (!A || !B || A === B) return false;
  if (back) { if (A.backs.some((x) => x.stepId === B.id)) return false; A.backs.push({ stepId: B.id, msg: '' }); return true; }
  if (B.triggers.some((x) => x.stepId === A.id)) return false;
  /* a step with no arrow in follows the step before it; keep that arrow, so drawing a new one adds to it instead of replacing it */
  const before = f.steps[b - 1];
  if (!B.triggers.length && !B.standalone && before && before !== A) B.triggers.push({ stepId: before.id, msg: '' });
  B.triggers.push({ stepId: A.id, msg: '' }); delete B.standalone; return true;
}

/* Take away one arrow the canvas drew. `e` is the data the canvas keeps on it: { kind: 'trigger', to, tIdx } or { kind: 'back', from, k }.
 * A step left with no arrow in is marked "starts on its own", so it does not quietly start following the step before it. */
export function removeArrow(d, flowId, e) {
  const f = d.flows.find((x) => x.id === flowId); if (!f) return;
  if (e.kind === 'trigger') {
    const s = f.steps[e.to]; if (!s) return;
    if (e.tIdx >= 0) { const k = placeInFile(f, s.triggers, e.tIdx); if (k < 0) return; s.triggers.splice(k, 1); }
    if (!s.triggers.some((t) => !t.stepId || live(f, t.stepId))) s.standalone = true;
  } else {
    const s = f.steps[e.from]; if (!s) return;
    const k = placeInFile(f, s.backs, e.k); if (k >= 0) s.backs.splice(k, 1);
  }
}
