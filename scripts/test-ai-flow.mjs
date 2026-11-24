// Turning an AI answer into flow edits (lib/ai-flow.js). Run: node --test scripts/test-ai-flow.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const lib = (f) => import(pathToFileURL(path.join(import.meta.dirname, '../app/src/lib', f)).href);
const o = await lib('ops.js'), { validate, emptyData } = await lib('schema.js'), { exportLegacy } = await lib('export-legacy.js'), { parseFlows } = await lib('flows-parser.js'), { applyGenerated } = await lib('ai-flow.js');

const GEN = {
  chart: 'swimlane', reason: 'x', teams: ['Sales', 'Finance'], unknownSheets: ['Mystery'],
  steps: [
    { team: 'Sales', title: 'Send quote', kind: 'start', day: null, sheet: 'crm', sheetName: null, note: '', waits: [] },
    { team: 'Finance', title: 'Price OK?', kind: 'decision', day: null, sheet: null, sheetName: null, note: 'Check margin', waits: [{ on: 0, msg: 'quote' }] },
    { team: 'Sales', title: 'Send order', kind: null, day: 'Fri', sheet: null, sheetName: 'Mystery', note: '', waits: [{ on: 1, msg: 'Yes' }] },
    { team: 'Sales', title: 'Rework quote', kind: null, day: null, sheet: null, sheetName: null, note: '', waits: [{ on: 1, msg: 'No' }] },
    { team: 'Finance', title: 'Close', kind: 'end', day: null, sheet: null, sheetName: null, note: '', waits: [] }],
  notes: [{ text: 'I assumed Finance approves', step: 1 }, { text: 'Who owns pricing?', step: null }, { text: 'Second free note', step: null }],
};
function build() { const d = emptyData('T'); d.sheets.push({ id: 'h_crm', kind: 'app', name: 'CRM', departmentId: null, sectionId: null, owner: '', details: [], crit: null, url: null, note: '', sort: 1024 }); const f = o.addFlow(d, { title: 'Quotes' }); return { d, f }; }

test('a generated flow fills an empty flow with steps, teams, shapes, sheets, arrows and notes, and the file stays valid', () => {
  const { d, f } = build(); const ids = applyGenerated(d, f, GEN), fl = d.flows[0];
  assert.equal(ids.length, 5); assert.deepEqual(fl.teams, ['Sales', 'Finance']); assert.deepEqual(fl.steps.map((s) => s.title), ['Send quote', 'Price OK?', 'Send order', 'Rework quote', 'Close']);
  assert.deepEqual(fl.steps.map((s) => s.kind), ['start', 'decision', undefined, undefined, 'end']);
  assert.equal(fl.steps[0].sheetId, 'h_crm'); assert.equal(fl.steps[2].sheetName, 'Mystery'); assert.equal(fl.steps[2].sheetId, undefined); assert.equal(fl.steps[2].day, 'Fri'); assert.equal(fl.steps[1].note, 'Check margin');
  assert.deepEqual(fl.steps[2].triggers, [{ stepId: ids[1], msg: 'Yes' }]); assert.deepEqual(fl.steps[3].triggers, [{ stepId: ids[1], msg: 'No' }]);
  assert.deepEqual(validate(d), []);
});
test('notes are pinned to their step or placed in a row under the lanes, without overlapping', () => {
  const { d, f } = build(); const ids = applyGenerated(d, f, GEN), n = d.flows[0].notes;
  assert.equal(n.length, 3); assert.equal(n[0].stepId, ids[1]); assert.equal(n[1].stepId, undefined);
  assert.ok(n[1].y > 2 * 100 && n[2].x - n[1].x >= 180 && n[1].y === n[2].y);
});
test('the old Markdown view sees the same flow: steps, branch labels and a start that does not follow anything', () => {
  const { d, f } = build(); applyGenerated(d, f, GEN); const flow = parseFlows(exportLegacy(d).flowsMd)[0];
  assert.equal(flow.steps.length, 5); assert.equal(flow.teams.join(), 'Sales,Finance');
  const labelled = flow.edges.filter((e) => e.from === 1).map((e) => e.msg || e.label).sort(); assert.deepEqual(labelled, ['No', 'Yes']);
});
test('a second start begins on its own instead of following the step before it', () => {
  const { d, f } = build(); const g = structuredClone(GEN); g.steps[4] = { ...g.steps[4], kind: 'start' }; applyGenerated(d, f, g);
  assert.equal(d.flows[0].steps[4].standalone, true); assert.equal(d.flows[0].steps[0].standalone, undefined); assert.deepEqual(validate(d), []);
});
test('it refuses a flow that already has steps, and an answer with no steps, changing nothing', () => {
  const { d, f } = build(); o.addStep(d, f, { team: 'A', title: 'x' }); const before = JSON.stringify(d);
  assert.throws(() => applyGenerated(d, f, GEN), /empty flow/); assert.equal(JSON.stringify(d), before);
  const e = build(); assert.throws(() => applyGenerated(e.d, e.f, { ...GEN, steps: [] }), /no steps/); assert.equal(e.d.flows[0].steps.length, 0);
});
test('a note pointing at a step that is not there becomes a free note instead of breaking the file', () => {
  const { d, f } = build(); applyGenerated(d, f, { ...GEN, notes: [{ text: 'odd', step: 99 }] }); assert.equal(d.flows[0].notes[0].stepId, undefined); assert.deepEqual(validate(d), []);
});
