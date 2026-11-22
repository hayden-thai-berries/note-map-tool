import { useMemo } from 'react';
import { buildFlow } from '../graph.js';
import { flows } from '../data.js';
import { Canvas, Select } from '../components/ui.jsx';

/* Business flows as swimlanes: one lane per team, blue arrows are hand-offs, dashed red arrows send work back. */
export default function Flows({ idx, setIdx }) {
  const f = flows[idx], graph = useMemo(() => (f ? buildFlow(f) : null), [f]);
  if (!f) return <p className="p-8 text-slate-500">No business flows yet for this map.</p>;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Select value={idx} onChange={(v) => setIdx(+v)}>{flows.map((x, i) => <option key={i} value={i}>{x.title}</option>)}</Select>
        <span className="text-sm text-slate-500">{[f.every && 'Runs: ' + f.every, f.teams.length + ' teams', f.steps.length + ' steps'].filter(Boolean).join(' · ')}</span>
        <span className="ml-auto text-xs text-slate-500"><i className="mr-1 inline-block h-0.5 w-5 bg-blue-600 align-middle" />hand-off<i className="ml-3 mr-1 inline-block w-5 border-t-2 border-dashed border-red-600 align-middle" />sent back</span>
      </div>
      <div className="min-h-0 flex-1"><Canvas graph={graph} fitKey={'flow' + idx} /></div>
    </div>
  );
}
