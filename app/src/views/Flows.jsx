import { useMemo, useState } from 'react';
import { buildFlow } from '../graph.js';
import { flows } from '../data.js';
import { Canvas, Select, Btn } from '../components/ui.jsx';
import { useRecords, apply } from '../lib/records.js';
import { addFlow } from '../lib/ops.js';
import FlowEdit from '../components/FlowEdit.jsx';

/* Business flows as swimlanes (one lane per team; blue arrows are hand-offs, dashed red arrows send work back), with an editor beside it. */
export default function Flows({ idx, setIdx }) {
  const { data, rev } = useRecords(), [editing, setEditing] = useState(true), [name, setName] = useState('');
  const f = flows[idx], meta = data.flows[idx], graph = useMemo(() => (f ? buildFlow(f) : null), [f, rev]);
  const create = () => { if (!name.trim()) return; const n = data.flows.length; if (apply((d) => addFlow(d, { title: name }))) { setName(''); setIdx(n); setEditing(true); } };
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        {f && <Select value={idx} onChange={(v) => setIdx(+v)}>{flows.map((x, i) => <option key={i} value={i}>{x.title}</option>)}</Select>}
        {f && <span className="text-sm text-slate-500">{[f.every && 'Runs: ' + f.every, f.teams.length + ' teams', f.steps.length + ' steps'].filter(Boolean).join(' · ')}</span>}
        <span className="ml-auto flex items-center gap-2"><input aria-label="New flow name" className="w-44 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm" placeholder="New flow name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} /><Btn onClick={create} disabled={!name.trim()}>New flow</Btn>{f && <Btn onClick={() => setEditing(!editing)}>{editing ? 'Hide editor' : 'Edit flow'}</Btn>}</span>
      </div>
      {!f && <p className="p-8 text-slate-500">No business flows yet for this map. Name one above to start.</p>}
      {f && (
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">{f.steps.length ? <Canvas graph={graph} fitKey={'flow' + idx + ':' + f.steps.length} /> : <p className="p-8 text-slate-500">This flow has no steps yet. Add the first one in the editor.</p>}</div>
          {editing && meta && <aside className="w-[400px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4"><FlowEdit key={meta.id} flowId={meta.id} onDeleted={() => setIdx(0)} /></aside>}
        </div>
      )}
    </div>
  );
}
