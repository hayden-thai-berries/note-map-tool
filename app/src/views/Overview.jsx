import { useRecords } from '../lib/records.js';
import { useMemo, useState } from 'react';
import { buildMap } from '../graph.js';
import { flows } from '../data.js';
import { Canvas, Select } from '../components/ui.jsx';
import Inspector from '../components/Inspector.jsx';
import DeptPanel from '../components/DeptPanel.jsx';

/* Map canvas: departments as boxes, links as arrows. Layers: tickets on sheets, a business flow drawn over the sheets it uses. */
export default function Overview({ sel, setSel }) {
  const { rev } = useRecords(), [flowIdx, setFlowIdx] = useState(-1), [showTix, setShowTix] = useState(true), [dept, setDept] = useState(null);
  const graph = useMemo(() => buildMap({ flow: flowIdx >= 0 ? flows[flowIdx] : null, showTix }), [flowIdx, showTix, rev]);
  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        <Canvas graph={graph} fitKey="map" onNode={(n) => { setSel(n?.type === 'sheet' ? n.id : null); setDept(n?.type === 'dept' && n.id.startsWith('dept:') ? n.data.name : null); }} />
        <div className="absolute left-4 top-4 z-10 w-60 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Layers</div>
          <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={showTix} onChange={(e) => setShowTix(e.target.checked)} />Tickets on sheets</label>
          <label className="block text-sm">Workflow overlay
            <Select value={flowIdx} onChange={(v) => setFlowIdx(+v)}><option value={-1}>None</option>{flows.map((f, i) => <option key={i} value={i}>{f.title}</option>)}</Select>
          </label>
        </div>
      </div>
      {!sel && dept && <aside className="w-[340px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4"><DeptPanel name={dept} onClose={() => setDept(null)} /></aside>}
      {sel && <aside className="w-[340px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4"><Inspector id={sel} onPick={setSel} onClose={() => setSel(null)} /></aside>}
    </div>
  );
}
