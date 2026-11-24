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

// ---- Ask AI: changing a flow that already has steps ----
const { applyEdit, flowForAi } = await lib('ai-flow.js'), { restore } = o;
const step = (was, team, title, waits = [], x = {}) => ({ was, team, title, kind: null, day: null, sheet: null, sheetName: null, note: '', waits, ...x });
function base() { // Draft -> Check -> Send (Send has no arrow of its own: it follows Check automatically)
  const d = emptyData('T'), f = o.addFlow(d, { title: 'Quotes' });
  const a = o.addStep(d, f, { team: 'Sales', title: 'Draft' }), b = o.addStep(d, f, { team: 'Finance', title: 'Check', note: 'margin' }), c = o.addStep(d, f, { team: 'Sales', title: 'Send' });
  d.flows[0].steps[1].triggers = [{ stepId: a, msg: 'draft' }]; d.flows[0].steps[2].ticket = 'T20261112.001'; return { d, f, a, b, c };
}
const titles = (d) => d.flows[0].steps.map((s) => s.title);
const EDIT = { teams: ['Sales', 'Finance', 'QA'], notes: [{ text: 'Who does QA?', step: 2 }], steps: [step(0, 'Sales', 'Draft'), step(1, 'Finance', 'Check', [{ on: 0, msg: 'draft' }], { note: 'margin' }), step(null, 'QA', 'QA check', [{ on: 1, msg: 'ok' }]), step(2, 'Sales', 'Send', [{ on: 2, msg: '' }])] };

test('the AI is told only the words on a flow, with the automatic arrow spelled out and no ticket ids', () => {
  const { d } = base(), t = flowForAi(d.flows[0], d.sheets); assert.deepEqual(t.steps.map((s) => s.waits), [[], [{ on: 0, msg: 'draft' }], [{ on: 1, msg: '' }]]);
  assert.ok(!JSON.stringify(t).includes('T2026'));
});
test('a step the AI adds goes where it put it, kept steps keep their ids, and the file stays valid', () => {
  const { d, a, b, c } = base(); const r = applyEdit(d, d.flows[0].id, EDIT);
  assert.deepEqual(titles(d), ['Draft', 'Check', 'QA check', 'Send']); assert.deepEqual(d.flows[0].steps.map((s) => s.id).filter((x) => [a, b, c].includes(x)), [a, b, c]);
  assert.equal(r.added.length, 1); assert.deepEqual(r.changed, []); assert.deepEqual(r.removed, []); assert.equal(d.flows[0].steps[3].ticket, 'T20261112.001');
  assert.deepEqual(d.flows[0].steps[3].triggers, [{ stepId: r.ids[2], msg: '' }]); assert.equal(d.flows[0].notes[0].stepId, r.ids[2]); assert.ok(d.flows[0].teams.includes('QA')); assert.deepEqual(validate(d), []);
});
test('an arrow the AI did not change is left alone, including the automatic one', () => {
  const { d } = base(); const same = { steps: [step(0, 'Sales', 'Draft'), step(1, 'Finance', 'Check', [{ on: 0, msg: 'draft' }], { note: 'margin' }), step(2, 'Sales', 'Send', [{ on: 1, msg: '' }])], notes: [] };
  const r = applyEdit(d, d.flows[0].id, same); assert.deepEqual(d.flows[0].steps[2].triggers, []); assert.equal(d.flows[0].steps[2].standalone, undefined); assert.deepEqual([r.added, r.changed, r.removed, r.arrowsAdded, r.arrowsRemoved], [[], [], [], 0, 0]);
});
test('changed words are reported and applied; unchanged fields are not touched', () => {
  const { d, b } = base(); const e = { notes: [], steps: [step(0, 'Sales', 'Draft'), step(1, 'QA', 'Quality check', [{ on: 0, msg: 'draft' }], { note: 'margin' }), step(2, 'Sales', 'Send', [{ on: 1, msg: '' }])] };
  const r = applyEdit(d, d.flows[0].id, e); const s = d.flows[0].steps[1];
  assert.deepEqual([s.id, s.title, s.team, s.note], [b, 'Quality check', 'QA', 'margin']); assert.deepEqual(r.changed[0].changes.map((c) => [c.field, c.from, c.to]), [['team', 'Finance', 'QA'], ['title', 'Check', 'Quality check']]); assert.deepEqual(validate(d), []);
});
test('a step the AI leaves out goes to Removed and comes back exactly; the arrows that pointed at it are re-pointed', () => {
  const { d, b } = base(); const e = { notes: [], steps: [step(0, 'Sales', 'Draft'), step(2, 'Sales', 'Send', [{ on: 0, msg: 'direct' }])] }; const copy = structuredClone(d);
  const r = applyEdit(d, d.flows[0].id, e); assert.deepEqual(titles(d), ['Draft', 'Send']); assert.deepEqual(r.removed, [b]); assert.equal(d.removed.at(-1).kind, 'step'); assert.deepEqual(d.flows[0].steps[1].triggers, [{ stepId: d.flows[0].steps[0].id, msg: 'direct' }]);
  assert.equal(r.arrowsAdded, 1); assert.equal(r.arrowsRemoved, 1); assert.deepEqual(validate(d), []);
  restore(d, d.removed.at(-1).id); assert.deepEqual(titles(d), ['Draft', 'Check', 'Send']); assert.equal(d.flows[0].steps[1].note, 'margin');
  assert.deepEqual(d.flows[0].steps.map((s) => s.sort), copy.flows[0].steps.map((s) => s.sort));
});
test('for the preview the steps to be removed stay in place and nothing goes to Removed', () => {
  const { d } = base(); const e = { notes: [], steps: [step(0, 'Sales', 'Draft'), step(2, 'Sales', 'Send', [{ on: 0, msg: '' }])] };
  const r = applyEdit(d, d.flows[0].id, e, { keepRemoved: true }); assert.deepEqual(titles(d), ['Draft', 'Check', 'Send']); assert.equal(d.removed.length, 0); assert.equal(r.removed.length, 1);
});
test('a new first step goes to the front, and a bad "was" or an empty answer changes nothing', () => {
  const { d } = base(); applyEdit(d, d.flows[0].id, { notes: [], steps: [step(null, 'Sales', 'Intake', [], { kind: 'start' }), step(0, 'Sales', 'Draft', [{ on: 0, msg: '' }]), step(1, 'Finance', 'Check', [{ on: 1, msg: 'draft' }], { note: 'margin' }), step(2, 'Sales', 'Send', [{ on: 2, msg: '' }])] });
  assert.deepEqual(titles(d), ['Intake', 'Draft', 'Check', 'Send']); assert.deepEqual(validate(d), []);
  const e = base(); const before = JSON.stringify(e.d); assert.throws(() => applyEdit(e.d, e.d.flows[0].id, { steps: [] }), /no steps/); assert.equal(JSON.stringify(e.d), before);
  const g = emptyData('T'); const f = o.addFlow(g, { title: 'Empty' }); assert.throws(() => applyEdit(g, f, EDIT), /nothing to change/);
});

test('a field the AI leaves out stays as it was, and a stripped copy of a text is not a change', () => {
  const { d, b } = base(); d.flows[0].steps[1].note = 'ask boss@example.com about T20261112.001';
  const e = { notes: [], steps: [step(0, 'Sales', 'Draft'), { was: 1, team: 'Finance', title: 'Check', note: 'ask [email removed] about [ticket]', waits: [{ on: 0, msg: 'draft' }] }, { was: 2, team: 'Sales', title: 'Send', waits: [{ on: 1, msg: '' }] }] };
  delete e.steps[0].note; const r = applyEdit(d, d.flows[0].id, e);
  assert.equal(d.flows[0].steps[1].note, 'ask boss@example.com about T20261112.001'); assert.deepEqual(r.changed, []); assert.equal(d.flows[0].steps[1].id, b);
  const e2 = { notes: [], steps: [{ was: 0, team: 'Sales', title: 'Draft' }, { was: 1, team: 'Finance', title: 'Check', note: 'a real change', waits: [{ on: 0, msg: 'draft' }] }, { was: 2, team: 'Sales', title: 'Send', waits: [{ on: 1, msg: '' }] }] };
  applyEdit(d, d.flows[0].id, e2); assert.equal(d.flows[0].steps[1].note, 'a real change');
});
test('a step that already has a real sheet is told to the AI by name, so keeping it is not a change', () => {
  const { d, a } = base(); d.sheets.push({ id: 'h1', kind: 'sheet', name: 'Orders', departmentId: null, sectionId: null, owner: '', details: [], crit: null, url: null, note: '', sort: 1 }); d.flows[0].steps[0].sheetId = 'h1';
  assert.equal(flowForAi(d.flows[0], d.sheets).steps[0].sheet, 'Orders');
  const r = applyEdit(d, d.flows[0].id, { notes: [], steps: [{ was: 0, team: 'Sales', title: 'Draft', sheet: 'orders' }, step(1, 'Finance', 'Check', [{ on: 0, msg: 'draft' }], { note: 'margin' }), step(2, 'Sales', 'Send', [{ on: 1, msg: '' }])] });
  assert.deepEqual(r.changed, []); assert.equal(d.flows[0].steps[0].id, a); assert.equal(d.flows[0].steps[0].sheetId, 'h1');
  const r2 = applyEdit(d, d.flows[0].id, { notes: [], steps: [{ was: 0, team: 'Sales', title: 'Draft', sheet: null, sheetName: null }, step(1, 'Finance', 'Check', [{ on: 0, msg: 'draft' }], { note: 'margin' }), step(2, 'Sales', 'Send', [{ on: 1, msg: '' }])] });
  assert.equal(r2.changed[0].changes[0].field, 'sheet'); assert.equal(d.flows[0].steps[0].sheetId, undefined);
});

test('an arrow drawn from "the nearest earlier step of a team" is told to the AI like any other, and replaced when the AI changes it', () => {
  const { d, a, c } = base(); d.flows[0].steps[2].triggers = [{ team: 'Finance', msg: 'Approved' }];     // Send waits on a message from Finance = step 1
  assert.deepEqual(flowForAi(d.flows[0], d.sheets).steps[2].waits, [{ on: 1, msg: 'Approved' }]);
  const same = { notes: [], steps: [step(0, 'Sales', 'Draft'), step(1, 'Finance', 'Check', [{ on: 0, msg: 'draft' }], { note: 'margin' }), step(2, 'Sales', 'Send', [{ on: 1, msg: 'Approved' }])] };
  const r = applyEdit(d, d.flows[0].id, same); assert.deepEqual([r.arrowsAdded, r.arrowsRemoved], [0, 0]); assert.deepEqual(d.flows[0].steps[2].triggers, [{ team: 'Finance', msg: 'Approved' }]);
  const moved = { notes: [], steps: [step(0, 'Sales', 'Draft'), step(1, 'Finance', 'Check', [{ on: 0, msg: 'draft' }], { note: 'margin' }), step(2, 'Sales', 'Send', [{ on: 0, msg: 'direct' }])] };
  const r2 = applyEdit(d, d.flows[0].id, moved); assert.deepEqual([r2.arrowsAdded, r2.arrowsRemoved], [1, 1]); assert.deepEqual(d.flows[0].steps[2].triggers, [{ stepId: a, msg: 'direct' }]); assert.equal(d.flows[0].steps[2].id, c); assert.deepEqual(validate(d), []);
});
