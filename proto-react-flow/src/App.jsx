import { useEffect, useMemo, useState } from 'react';
import { nodeTypes } from './nodes.jsx';
import { buildMap, buildFlow } from './graph.js';
import { model, flows, tickets, allNodes } from './data.js';
import Inspector from './Inspector.jsx';
import Work from './Work.jsx';
import { Canvas, Select } from './ui.jsx';
import Catalog from './Catalog.jsx';
import Journey from './Journey.jsx';
import Spotlight from './Spotlight.jsx';

/* PROTOTYPE (throwaway, branch proto/react-flow): React Flow + Tailwind options for the sheets-map UX.
 * ?variant=C  Catalog table, D  Data journey (layers by link depth), E  Spotlight (one sheet + neighbours): new non-canvas concepts.
 * ?variant=A  Rail app: sidebar with Docs map / Work / Flows, canvas + inspector.
 * ?variant=B  One canvas: the map with layers (flow overlay, ticket chips), no sidebar.
 * Read-only, in-memory, runs the app's real parsers on maps/demo.*. */
const VARIANTS = { G: 'Rail app: overview + journey + work', F: 'Combined: List · Journey · Detail', C: 'Catalog', D: 'Data journey', E: 'Spotlight', A: 'Rail + canvas', B: 'Canvas + layers' };

function MapView({ flowIdx, showTix, sel, setSel }) {
  const graph = useMemo(() => buildMap({ flow: flowIdx >= 0 ? flows[flowIdx] : null, showTix }), [flowIdx, showTix]);
  return <Canvas graph={graph} fitKey="map" onNode={(n) => setSel(n && (n.type === 'sheet') ? n.id : null)} />;
}

function FlowView({ idx, setIdx }) {
  const graph = useMemo(() => buildFlow(flows[idx]), [idx]);
  const f = flows[idx];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Select value={idx} onChange={(v) => setIdx(+v)}>{flows.map((x, i) => <option key={i} value={i}>{x.title}</option>)}</Select>
        <span className="text-sm text-slate-500">{[f.every && 'Runs: ' + f.every, f.teams.length + ' teams', f.steps.length + ' steps'].filter(Boolean).join(' · ')}</span>
        <span className="ml-auto text-xs text-slate-500"><i className="mr-1 inline-block h-0.5 w-5 bg-blue-600 align-middle" />hand-off <i className="mx-1 ml-3 inline-block h-0.5 w-5 border-t-2 border-dashed border-red-600 align-middle" />sent back</span>
      </div>
      <div className="min-h-0 flex-1"><Canvas graph={graph} fitKey={'flow' + idx} /></div>
    </div>
  );
}

function Side({ sel, setSel }) {
  return (
    <aside className="w-[340px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4"><Inspector id={sel} onPick={setSel} onClose={() => setSel(null)} /></aside>
  );
}

/* G: the chosen mix. Left rail = workspaces. Overview = canvas + layers (A/B), Journey = D, Work = A's kanban, plus C/E as secondary docs views. */
function VariantG() {
  const q = new URLSearchParams(location.search);
  const [ws, setWs] = useState(q.get('ws') || 'overview'), [sel, setSel] = useState(q.get('pick')), [flowIdx, setFlowIdx] = useState(-1), [showTix, setShowTix] = useState(true), [fIdx, setFIdx] = useState(0);
  const open = tickets.filter((t) => t.status !== 'done'), blocked = open.filter((t) => t.status === 'blocked').length;
  const groups = [
    ['Map', [['overview', 'Overview', 'canvas + layers'], ['journey', 'Journey', 'how data travels']]],
    ['Docs', [['catalog', 'Catalog', allNodes().length], ['detail', 'Detail', '']]],
    ['Work', [['work', 'Tickets & projects', open.length + (blocked ? ' · ' + blocked + '!' : '')]]],
    ['Workflows', [['flows', 'Business flows', flows.length]]],
  ];
  const toDetail = () => setWs('detail');
  return (
    <div className="flex h-full">
      <nav className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3">
        <div className="mb-3 px-2 text-base font-semibold tracking-tight">{model.title}</div>
        {groups.map(([g, items]) => (
          <div key={g} className="mb-3"><div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g}</div>
            {items.map(([k, label, hint]) => (
              <button key={k} onClick={() => setWs(k)} className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${ws === k ? 'bg-slate-100 font-semibold shadow-[inset_3px_0_0_#0b6bcb]' : 'text-slate-600 hover:bg-slate-50'}`}>
                {label}<small className={`text-xs font-normal ${String(hint).includes('!') ? 'text-red-600' : 'text-slate-400'}`}>{hint}</small>
              </button>
            ))}
          </div>
        ))}
        {sel && <div className="mt-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-500">Selected<div className="font-semibold text-slate-800">{allNodes().find((n) => n.key === sel)?.name}</div><button className="mt-1 text-blue-600" onClick={() => setSel(null)}>Clear</button></div>}
      </nav>
      <main className="min-w-0 flex-1">
        {ws === 'overview' && (
          <div className="flex h-full"><div className="relative min-w-0 flex-1">
            <MapView flowIdx={flowIdx} showTix={showTix} sel={sel} setSel={setSel} />
            <div className="absolute left-4 top-4 z-10 w-60 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Layers</div>
              <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={showTix} onChange={(e) => setShowTix(e.target.checked)} />Tickets on sheets</label>
              <label className="block text-sm">Workflow overlay<Select value={flowIdx} onChange={(v) => setFlowIdx(+v)}><option value={-1}>None</option>{flows.map((f, i) => <option key={i} value={i}>{f.title}</option>)}</Select></label>
            </div></div>{sel && <Side sel={sel} setSel={setSel} />}</div>
        )}
        {ws === 'journey' && <Journey sel={sel} setSel={setSel} onDetail={toDetail} />}
        {ws === 'catalog' && <Catalog sel={sel} setSel={setSel} onDetail={toDetail} />}
        {ws === 'detail' && <Spotlight sel={sel} setSel={setSel} />}
        {ws === 'work' && <div className="h-full overflow-auto"><Work /></div>}
        {ws === 'flows' && <FlowView idx={fIdx} setIdx={setFIdx} />}
      </main>
    </div>
  );
}

function VariantF() {
  const q = new URLSearchParams(location.search);
  const [view, setView] = useState(q.get('view') || 'list'), [sel, setSel] = useState(q.get('pick'));
  const tabs = [['list', 'List'], ['journey', 'Journey'], ['detail', 'Detail']];
  const pick = (k) => setSel(k);
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-5 py-2">
        <b className="tracking-tight">{model.title}</b>
        <div role="tablist" className="flex rounded-lg bg-slate-100 p-0.5">
          {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-4 py-1 text-sm ${view === k ? 'bg-white font-semibold shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
        </div>
        <span className="ml-auto text-sm text-slate-500">{sel ? <>Selected: <b className="text-slate-800">{allNodes().find((n) => n.key === sel)?.name}</b> <button className="ml-1 text-slate-400 hover:text-slate-700" onClick={() => setSel(null)} aria-label="Clear selection">×</button></> : 'Nothing selected'}</span>
      </header>
      <div className="min-h-0 flex-1">
        {view === 'list' && <Catalog sel={sel} setSel={pick} onDetail={() => setView('detail')} />}
        {view === 'journey' && <Journey sel={sel} setSel={pick} onDetail={() => setView('detail')} />}
        {view === 'detail' && <Spotlight sel={sel} setSel={pick} />}
      </div>
    </div>
  );
}

function VariantA() {
  const [ws, setWs] = useState(new URLSearchParams(location.search).get('ws') || 'map');
  const [sel, setSel] = useState(new URLSearchParams(location.search).get('pick'));
  const [flowIdx, setFlowIdx] = useState(0);
  const open = tickets.filter((t) => t.status !== 'done').length;
  const nav = [['map', 'Docs map', allNodes().length], ['work', 'Work', open], ['flows', 'Flows', flows.length]];
  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 border-r border-slate-200 bg-white p-3">
        <div className="mb-3 text-base font-semibold">{model.title}</div>
        {nav.map(([k, label, n]) => (
          <button key={k} onClick={() => setWs(k)} className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${ws === k ? 'bg-slate-100 font-semibold shadow-[inset_3px_0_0_#0b6bcb]' : 'text-slate-600 hover:bg-slate-50'}`}>{label}<small className="text-xs text-slate-400">{n}</small></button>
        ))}
        {ws === 'flows' && <div className="mt-4"><div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Flows</div>
          {flows.map((f, i) => <button key={i} onClick={() => setFlowIdx(i)} className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${i === flowIdx ? 'font-semibold' : 'text-slate-600'}`}>{f.title}</button>)}</div>}
      </nav>
      <main className="min-w-0 flex-1">
        {ws === 'map' && <div className="flex h-full"><div className="min-w-0 flex-1"><MapView flowIdx={-1} showTix={false} sel={sel} setSel={setSel} /></div><Side sel={sel} setSel={setSel} /></div>}
        {ws === 'work' && <div className="h-full overflow-auto"><Work /></div>}
        {ws === 'flows' && <FlowView idx={flowIdx} setIdx={setFlowIdx} />}
      </main>
    </div>
  );
}

function VariantB() {
  const [flowIdx, setFlowIdx] = useState(+(new URLSearchParams(location.search).get('flow') ?? -1));
  const [showTix, setShowTix] = useState(true);
  const [sel, setSel] = useState(new URLSearchParams(location.search).get('pick'));
  return (
    <div className="relative h-full">
      <MapView flowIdx={flowIdx} showTix={showTix} sel={sel} setSel={setSel} />
      <div className="absolute left-4 top-4 z-10 w-64 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg">
        <div className="mb-2 font-semibold">{model.title}</div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Layers</div>
        <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={showTix} onChange={(e) => setShowTix(e.target.checked)} />Tickets on sheets <span className="text-slate-400">({tickets.filter((t) => t.status !== 'done').length} open)</span></label>
        <label className="block text-sm">Business flow overlay
          <Select value={flowIdx} onChange={(v) => setFlowIdx(+v)}><option value={-1}>None</option>{flows.map((f, i) => <option key={i} value={i}>{f.title}</option>)}</Select>
        </label>
        {flowIdx >= 0 && <p className="mt-2 text-xs text-slate-500">Blue arrows are hand-offs between teams, drawn between the sheets each step uses. Other sheets are dimmed.</p>}
      </div>
      {sel && <div className="absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] w-[340px] overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg"><Inspector id={sel} onPick={setSel} onClose={() => setSel(null)} /></div>}
    </div>
  );
}

export default function App() {
  const [v, setV] = useState(() => { const q = new URLSearchParams(location.search).get('variant'); return q in VARIANTS ? q : 'G'; });
  const keys = Object.keys(VARIANTS);
  const go = (k) => { const u = new URL(location.href); u.searchParams.set('variant', k); history.replaceState(null, '', u); setV(k); };
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const i = keys.indexOf(v);
      if (e.key === 'ArrowLeft') go(keys[(i + keys.length - 1) % keys.length]);
      if (e.key === 'ArrowRight') go(keys[(i + 1) % keys.length]);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  return (
    <div className="h-full">
      {v === 'G' && <VariantG key="G" />}{v === 'F' && <VariantF key="F" />}{v === 'A' && <VariantA key="A" />}{v === 'B' && <VariantB key="B" />}{v === 'C' && <Catalog key="C" />}{v === 'D' && <Journey key="D" />}{v === 'E' && <Spotlight key="E" />}
      <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-2 py-1.5 text-sm text-white shadow-xl">
        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-slate-900">PROTOTYPE · REACT FLOW</span>
        <button aria-label="Previous variant" onClick={() => go(keys[(keys.indexOf(v) + keys.length - 1) % keys.length])} className="h-7 w-7 rounded-full bg-slate-700 hover:bg-blue-600">‹</button>
        <span className="min-w-36 text-center">{v} · {VARIANTS[v]}</span>
        <button aria-label="Next variant" onClick={() => go(keys[(keys.indexOf(v) + 1) % keys.length])} className="h-7 w-7 rounded-full bg-slate-700 hover:bg-blue-600">›</button>
      </div>
    </div>
  );
}
