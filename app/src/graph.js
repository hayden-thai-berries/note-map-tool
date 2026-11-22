import { MarkerType } from '@xyflow/react';
import { low } from './data.js';
import { openTicketsForSheet } from './lib/rollup.js';

const W = 230, H = 62, GAP = 10, PAD = 14;
const arrow = (color) => ({ type: MarkerType.ArrowClosed, color });

/* sheets map, drawn straight from the Data file so every node knows its real id:
 * departments are parent nodes, a header per function, then its files; apps sit in a band below. */
export function buildMap(d, { flow, showTix } = {}) {
  const nodes = [], edges = [], onMap = new Set(), idOf = new Map();
  d.sheets.forEach((s) => { const k = low(s.name); if (!idOf.has(k)) idOf.set(k, s.id); });
  const flowSheets = flow ? new Set(flow.steps.filter((s) => s.sheet).map((s) => idOf.get(low(s.sheet))).filter(Boolean)) : null;
  const sheetNode = (s, parentId, x, y) => ({
    id: s.id, type: 'sheet', parentId, extent: 'parent', position: { x, y }, draggable: false,
    data: { sheetId: s.id, n: { key: low(s.name), name: s.name, kind: s.kind, crit: s.crit, details: [s.owner, ...(s.details || [])].filter(Boolean).join(' · ') }, open: openTicketsForSheet(d, s.id), showTix, dim: !!flowSheets && !flowSheets.has(s.id) },
  });
  let maxH = 0;
  d.departments.forEach((dep, di) => {
    const id = 'dept:' + dep.id, box = { id, type: 'dept', position: { x: di * (W + PAD * 2 + 50), y: 0 }, data: { name: dep.name, depId: dep.id }, draggable: false, selectable: true, style: { width: W + PAD * 2 } };
    nodes.push(box);
    let y = 44;
    dep.sections.forEach((sc) => {
      nodes.push({ id: 'sec:' + sc.id, type: 'section', parentId: id, extent: 'parent', position: { x: PAD, y }, data: { title: sc.title, note: sc.note, secId: sc.id, depId: dep.id }, draggable: false, selectable: true });
      y += 44;
      d.sheets.filter((s) => s.sectionId === sc.id).forEach((s) => { onMap.add(s.id); nodes.push(sheetNode(s, id, PAD, y)); y += H + GAP; });
      y += 6;
    });
    box.style.height = y + 8; maxH = Math.max(maxH, y + 8);
  });
  const apps = d.sheets.filter((s) => s.kind === 'app'), appsY = maxH + 90;
  nodes.push({ id: 'apps', type: 'dept', position: { x: 0, y: appsY }, data: { name: 'Connected apps' }, draggable: false, selectable: false, style: { width: Math.max(1, apps.length) * (W + PAD) + PAD, height: 44 + H + 16 } });
  apps.forEach((s, i) => { onMap.add(s.id); nodes.push(sheetNode(s, 'apps', PAD + i * (W + PAD), 44)); });

  d.links.forEach((l) => {
    if (!onMap.has(l.fromId) || !onMap.has(l.toId)) return;
    const manual = /manual/i.test(l.label || '');
    edges.push({ id: 'l:' + l.id, source: l.fromId, target: l.toId, label: l.label, data: { linkId: l.id }, type: 'default', markerEnd: arrow('#7a8798'), style: { stroke: '#7a8798', strokeDasharray: manual ? '6 4' : undefined, cursor: 'pointer' }, labelStyle: { fontSize: 10 }, animated: !manual, interactionWidth: 24 });
  });
  /* flow overlay: the chosen business flow drawn on top of the files it touches */
  if (flow) {
    flow.edges.forEach((e, i) => {
      const a = flow.steps[e.from], b = flow.steps[e.to], from = a.sheet && idOf.get(low(a.sheet)), to = b.sheet && idOf.get(low(b.sheet));
      if (!from || !to || from === to || !onMap.has(from) || !onMap.has(to)) return;
      edges.push({ id: 'f' + i, source: from, target: to, label: `${a.team} → ${b.team}: ${b.title}`, markerEnd: arrow('#0b6bcb'), style: { stroke: '#0b6bcb', strokeWidth: 3 }, labelStyle: { fontSize: 11, fontWeight: 600 }, zIndex: 10 });
    });
  }
  return { nodes, edges };
}

/* swimlane flow: lanes are parent nodes, steps are children placed by dependency depth */
export function buildFlow(flow) {
  const LH = 130, LX = 126, CW = 220;
  const lane = Object.fromEntries(flow.teams.map((t, i) => [low(t), i]));
  const col = flow.steps.map(() => 0), used = new Set(), inc = flow.steps.map(() => []);
  flow.edges.forEach((e) => inc[e.to].push(e.from));
  flow.steps.forEach((s, i) => {
    let c = inc[i].length ? Math.max(...inc[i].map((f) => col[f] + 1)) : 0;
    while (used.has(lane[low(s.team)] + ':' + c)) c++;
    used.add(lane[low(s.team)] + ':' + c); col[i] = c;
  });
  const width = LX + (Math.max(...col) + 1) * CW + 20, nodes = [], edges = [];
  flow.teams.forEach((t, i) => nodes.push({ id: 'lane' + i, type: 'lane', position: { x: 0, y: i * (LH + 14) }, data: { team: t }, draggable: false, selectable: false, zIndex: -1, style: { width, height: LH } }));
  flow.steps.forEach((st, i) => nodes.push({ id: 's' + i, type: 'step', parentId: 'lane' + lane[low(st.team)], extent: 'parent', position: { x: LX + col[i] * CW, y: 28 }, data: { st, idx: i }, draggable: false }));
  flow.edges.forEach((e, k) => {
    const hand = low(flow.steps[e.from].team) !== low(flow.steps[e.to].team);
    edges.push({ id: 'e' + k, source: 's' + e.from, target: 's' + e.to, type: 'smoothstep', label: e.msg, markerEnd: arrow(hand ? '#0b6bcb' : '#7a8798'), style: { stroke: hand ? '#0b6bcb' : '#7a8798', strokeWidth: hand ? 2 : 1.5 }, labelStyle: { fontSize: 10 } });
  });
  flow.steps.forEach((st, i) => st.backs.forEach((b, k) => {
    const j = flow.steps.indexOf(b.ref);
    if (j >= 0) edges.push({ id: `b${i}_${k}`, source: 's' + i, sourceHandle: 'bs', target: 's' + j, targetHandle: 'bt', type: 'smoothstep', label: b.msg || 'sent back', markerEnd: arrow('#b3261e'), style: { stroke: '#b3261e', strokeDasharray: '6 4' }, labelStyle: { fontSize: 10, fill: '#b3261e' } });
  }));
  return { nodes, edges };
}
