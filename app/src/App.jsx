import { useEffect, useState } from 'react';
import { listMaps, loadRecords } from './lib/store.js';
import { setRecords, model, flows, tickets, allNodes } from './data.js';
import Overview from './views/Overview.jsx';
import Journey from './views/Journey.jsx';
import Catalog from './views/Catalog.jsx';
import Detail from './views/Detail.jsx';
import Work from './views/Work.jsx';
import Flows from './views/Flows.jsx';

const hashWs = () => location.hash.replace('#', '') || 'overview';

function Message({ title, children }) {
  return <div className="grid h-full place-items-center p-8"><div className="max-w-md text-center"><h1 className="mb-2 text-lg font-semibold">{title}</h1><p className="text-sm text-slate-600">{children}</p></div></div>;
}

export default function App() {
  const [maps, setMaps] = useState(null), [file, setFile] = useState(null), [state, setState] = useState({ status: 'loading' });
  const [ws, setWsState] = useState(hashWs), [sel, setSel] = useState(null), [fIdx, setFIdx] = useState(0);
  const setWs = (k) => { setWsState(k); history.replaceState(null, '', '#' + k); };

  useEffect(() => {
    listMaps().then((list) => {
      const want = new URLSearchParams(location.search).get('map');
      setMaps(list); setFile(list.includes(want) ? want : list.includes('work.md') ? 'work.md' : list[0] || null);
      if (!list.length) setState({ status: 'empty' });
    }).catch((e) => setState({ status: 'error', message: e.message }));
  }, []);
  useEffect(() => {
    if (!file) return;
    setState({ status: 'loading' }); setSel(null); setFIdx(0);
    loadRecords(file).then((rec) => { setRecords(rec); setState({ status: 'ready', file }); })
      .catch((e) => setState({ status: 'error', message: e.message }));
    const u = new URL(location.href); u.searchParams.set('map', file); history.replaceState(null, '', u);
  }, [file]);

  if (state.status === 'error') return <Message title="Cannot load your records">{state.message}. Start the app with <code>./start.command</code> so <code>server.py</code> is running. Nothing has been changed.</Message>;
  if (state.status === 'empty') return <Message title="No maps yet">Add a <code>maps/&lt;name&gt;.md</code> file, or create one in the current app.</Message>;
  if (state.status === 'loading' || !maps) return <Message title="Loading…" />;

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
        <div className="mb-1 px-2 text-base font-semibold tracking-tight">{model.title}</div>
        {maps.length > 1 && <select aria-label="Map" value={file} onChange={(e) => setFile(e.target.value)} className="mb-3 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">{maps.map((m) => <option key={m} value={m}>{m.replace(/\.md$/, '')}</option>)}</select>}
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
        {ws === 'overview' && <Overview key={file} sel={sel} setSel={setSel} />}
        {ws === 'journey' && <Journey key={file} sel={sel} setSel={setSel} onDetail={toDetail} />}
        {ws === 'catalog' && <Catalog key={file} sel={sel} setSel={setSel} onDetail={toDetail} />}
        {ws === 'detail' && <Detail key={file} sel={sel} setSel={setSel} />}
        {ws === 'work' && <div className="h-full overflow-auto"><Work key={file} /></div>}
        {ws === 'flows' && <Flows key={file} idx={fIdx} setIdx={setFIdx} />}
      </main>
    </div>
  );
}
