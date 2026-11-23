import { useEffect, useMemo, useState } from 'react';
import { buildFlow, LANE } from '../graph.js';
import { flows } from '../data.js';
import { Canvas, Select, Btn } from '../components/ui.jsx';
import { FlowUi } from '../components/nodes.jsx';
import { useRecords, apply } from '../lib/records.js';
import * as o from '../lib/ops.js';
import { connect, removeArrow } from '../lib/flow-edit.js';
import FlowEdit from '../components/FlowEdit.jsx';

/* Business flows as swimlanes (one lane per team; blue arrows are hand-offs, dashed red arrows send work back). The diagram is the editor:
 * double-click a step to retype it, drag it into another lane to hand it to that team, drag from its right edge to another step to draw an arrow,
 * double-click an empty lane to add a step (Enter adds the next), Delete removes what is selected. Every change goes through apply(), so it undoes. */
export default function Flows({ idx, setIdx }) {
  const { data, rev } = useRecords(), [editing, setEditing] = useState(true), [name, setName] = useState(''), [laneName, setLaneName] = useState('');
  const [typing, setTyping] = useState(null), [draft, setDraft] = useState(null), [hot, setHot] = useState(null), [tick, setTick] = useState(0), [selIdx, setSelIdx] = useState(null);
  const f = flows[idx], meta = data.flows[idx], graph = useMemo(() => (f ? buildFlow(f, { draft: draft && { team: draft.team, key: draft.key, from: draft.fromId ? meta.steps.findIndex((x) => x.id === draft.fromId) : null } }) : null), [f, rev, tick, draft]);
  useEffect(() => { setTyping(null); setDraft(null); setSelIdx(null); setHot(null); }, [idx]);
  const create = () => { if (!name.trim()) return; const n = data.flows.length; if (apply((d) => o.addFlow(d, { title: name }))) { setName(''); setIdx(n); setEditing(true); } };

  const FID = meta?.id, sid = (i) => meta?.steps[i]?.id;
  const laneOf = (n) => { const li = graph.nodes.find((x) => x.id === n.parentId)?.data.i ?? 0, step = LANE.H + LANE.GAP; return Math.max(0, Math.min(f.teams.length - 1, Math.floor((li * step + n.position.y + LANE.STEP_H / 2) / step))); };
  const ui = useMemo(() => !meta ? {} : ({
    editing: typing, hot,
    edit: setTyping, stopEdit: () => setTyping(null),
    commitTitle: (i, v) => { setTyping(null); const t = v.trim(); if (t && t !== meta.steps[i]?.title) apply((d) => o.updateStep(d, FID, sid(i), { title: t })); },
    next: (i) => setDraft({ team: meta.steps[i].team, fromId: sid(i), key: Date.now() }),
    del: (i) => { const id = sid(i); setSelIdx(null); apply((d) => o.removeStep(d, FID, id)); },
    draftCancel: () => setDraft(null),
    /* Enter on one line adds it and opens the next after it; several pasted lines add one step each, linked in a row */
    draftCommit: (text, chain) => {
      const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').trim()).filter(Boolean), team = draft.team;
      if (!lines.length) return setDraft(null);
      let lastId = null;
      const ok = apply((d) => {
        let prev = draft.fromId || null;
        for (const title of lines) prev = o.addStep(d, FID, { team, title, afterStepId: prev, ...(prev ? { triggers: [{ stepId: prev, msg: '' }] } : { standalone: true }) });
        lastId = prev;
      });
      if (!ok) return setDraft(null);
      setDraft(chain && lines.length === 1 && lastId ? { team, fromId: lastId, key: Date.now() } : null);
    },
    renameLane: (from, to) => apply((d) => o.renameTeam(d, FID, from, to)),
    moveLane: (team, dir) => apply((d) => o.moveTeam(d, FID, team, dir)),
    removeLane: (team) => apply((d) => o.removeTeam(d, FID, team)),
  }), [meta, rev, typing, hot, draft]);

  const rf = f && {
    zoomOnDoubleClick: false, deleteKeyCode: ['Backspace', 'Delete'],
    onNodeDoubleClick: (_, n) => { if (n.type === 'step') setTyping(n.data.idx); else if (n.type === 'lane') setDraft({ team: n.data.team, fromId: null, key: Date.now() }); },
    onNodeDrag: (_, n) => { if (n.type === 'step') { const li = laneOf(n); if (li !== hot) setHot(li); } },
    onNodeDragStop: (_, n) => {
      if (n.type !== 'step') return;
      const team = f.teams[laneOf(n)]; setHot(null);
      if (team && team.toLowerCase() !== f.steps[n.data.idx].team.toLowerCase()) apply((d) => o.updateStep(d, FID, sid(n.data.idx), { team }));
      setTick((t) => t + 1); /* snap back into place (a move to another lane redraws anyway) */
    },
    /* Delete: the steps and arrows that are selected. Arrows of a deleted step go with it, the others are taken out one by one, last first so places stay right. */
    onDelete: ({ nodes, edges }) => {
      const gone = nodes.filter((n) => n.type === 'step').map((n) => n.data.idx), ids = gone.map((i) => sid(i));
      const arrows = edges.filter((e) => e.data && !gone.includes(e.data.from) && !gone.includes(e.data.to)).map((e) => e.data).sort((a, b) => (b.tIdx ?? b.k) - (a.tIdx ?? a.k));
      if (!ids.length && !arrows.length) return;
      setSelIdx(null);
      apply((d) => { arrows.forEach((a) => removeArrow(d, FID, a)); ids.forEach((id) => o.removeStep(d, FID, id)); });
    },
  };
  const onConnect = (c) => {
    if (!/^s\d+$/.test(c.source || '') || !/^s\d+$/.test(c.target || '')) return;
    const a = +c.source.slice(1), b = +c.target.slice(1); if (a === b) return;
    apply((d) => connect(d, FID, a, b, c.sourceHandle === 'bs' || b < a));
  };
  const addLane = () => { if (laneName.trim() && apply((d) => o.addTeam(d, FID, laneName))) setLaneName(''); };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        {f && <Select value={idx} onChange={(v) => setIdx(+v)}>{flows.map((x, i) => <option key={i} value={i}>{x.title}</option>)}</Select>}
        {f && <span className="text-sm text-slate-500">{[f.every && 'Runs: ' + f.every, f.teams.length + ' lanes', f.steps.length + ' steps'].filter(Boolean).join(' · ')}</span>}
        {f && <span className="flex items-center gap-1.5"><input aria-label="New lane name" className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm" placeholder="New lane" value={laneName} onChange={(e) => setLaneName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLane()} /><Btn onClick={addLane} disabled={!laneName.trim()}>Add lane</Btn></span>}
        <span className="ml-auto flex items-center gap-2"><input aria-label="New flow name" className="w-44 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm" placeholder="New flow name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} /><Btn onClick={create} disabled={!name.trim()}>New flow</Btn>{f && <Btn onClick={() => setEditing(!editing)}>{editing ? 'Hide details' : 'Show details'}</Btn>}</span>
      </div>
      {!f && <p className="p-8 text-slate-500">No business flows yet for this map. Name one above to start.</p>}
      {f && (
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            {graph.nodes.length
              ? <FlowUi.Provider value={ui}><Canvas graph={graph} fitKey={'flow' + idx} rf={rf} onConnect={onConnect} onNode={(n) => setSelIdx(n?.type === 'step' ? n.data.idx : null)} /></FlowUi.Provider>
              : <p className="p-8 text-slate-500">This flow has no lanes yet. Add a lane above (a team, like Finance), then double-click it to add the first step.</p>}
          </div>
          {editing && meta && <aside className="w-[360px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4"><FlowEdit key={meta.id} flowId={meta.id} stepId={selIdx != null ? sid(selIdx) : null} onDeleted={() => setIdx(0)} /></aside>}
        </div>
      )}
    </div>
  );
}
