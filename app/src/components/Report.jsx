import { useMemo, useState } from 'react';
import { STATUS } from '../data.js';
import { fmtH, priorityOf } from '../lib/board.js';
import { PRESETS, rangeFor, buildReport, periodLabel } from '../lib/report.js';

const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm';
const h = (v) => (v ? fmtH(v) : '–');
const Tile = ({ label, value, tone }) => <div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className={`text-2xl font-semibold ${tone || ''}`}>{value}</div><div className="text-xs uppercase tracking-wider text-slate-500">{label}</div></div>;
const Block = ({ title, note, children }) => <section className="mt-5 break-inside-avoid"><h3 className="mb-1.5 text-sm font-semibold">{title}{note && <span className="ml-2 font-normal text-slate-500">{note}</span>}</h3>{children}</section>;
const Empty = ({ children }) => <p className="text-sm text-slate-400">{children}</p>;
const Id = ({ t, onOpen }) => <button type="button" aria-label={`Open ${t.id}`} className="font-mono text-xs text-slate-500 hover:text-blue-700" onClick={() => onOpen(t.id)}>{t.id}</button>;

/* Report over the tickets the tab's filters leave in scope, for a chosen period. Print or save as PDF from the browser. */
export default function Report({ d, list, onOpen }) {
  const [preset, setPreset] = useState('30d'), [custom, setCustom] = useState(() => rangeFor('30d'));
  const [from, to] = preset === 'custom' ? custom : rangeFor(preset), bad = from > to;
  const r = useMemo(() => (bad ? null : buildReport(d, list, from, to)), [d, list, from, to, bad]);
  const setDate = (i) => (e) => setCustom(i ? [custom[0], e.target.value] : [e.target.value, custom[1]]);
  return (
    <div id="report" className="max-w-5xl">
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Period" className={sel} value={preset} onChange={(e) => { if (e.target.value === 'custom') setCustom([from, to]); setPreset(e.target.value); }}>{PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {preset === 'custom' && <><input type="date" aria-label="From" className={sel} value={custom[0]} onChange={setDate(0)} /><span className="text-sm text-slate-500">to</span><input type="date" aria-label="To" className={sel} value={custom[1]} onChange={setDate(1)} /></>}
        <button type="button" className="ml-auto rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100" onClick={() => window.print()}>Print / save as PDF</button>
      </div>
      <h2 className="text-lg font-semibold">Tickets report <span className="font-normal text-slate-500">· {periodLabel(from, to)}</span></h2>
      {bad ? <p className="mt-3 text-sm text-red-700">The start date is after the end date.</p> : (
        <>
          <p className="mb-3 text-xs text-slate-500">Covers {r.scope} tickets (the filters above apply). A done ticket counts as finished on its last-updated date; opened comes from the date in its id.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile label="Opened" value={r.totals.opened} /><Tile label="Finished" value={r.totals.finished} tone="text-emerald-700" /><Tile label="Open now" value={r.totals.open} />
            <Tile label="Blocked now" value={r.totals.blocked} tone={r.totals.blocked ? 'text-red-700' : ''} /><Tile label="Hours logged" value={h(r.totals.hours)} />
          </div>

          <Block title="Finished" note={`${r.finished.length}`}>
            {r.finished.length ? <table className="w-full text-sm"><tbody>{r.finished.map((t) => <tr key={t.id} className="border-t border-slate-100"><td className="py-1 pr-2"><Id t={t} onOpen={onOpen} /></td><td>{t.title}</td><td className="text-xs text-slate-500">{r.about(t)}</td><td className="pl-2 text-right text-xs text-slate-500">{t.updated}</td></tr>)}</tbody></table> : <Empty>Nothing finished in this period.</Empty>}
          </Block>

          <Block title="Blocked now" note={`${r.blocked.length}`}>
            {r.blocked.length ? <ul className="space-y-1 text-sm">{r.blocked.map((t) => <li key={t.id} className="rounded border border-red-200 bg-red-50 px-2 py-1"><Id t={t} onOpen={onOpen} /> {t.title}<div className="text-xs text-red-800">{t.blocked || 'No reason recorded'}{t.owner ? ` · ${t.owner}` : ''}{priorityOf(t) !== 'normal' ? ` · ${priorityOf(t)}` : ''}</div></li>)}</ul> : <Empty>Nothing is blocked.</Empty>}
          </Block>

          <Block title="Projects">
            {r.projects.length ? <table className="w-full text-sm"><thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th>Project</th><th>Status</th><th>Items done</th><th>Hours in period</th><th>Hours total</th></tr></thead><tbody>{r.projects.map(({ p, total, done, hoursTotal, hoursPeriod }) => <tr key={p.id} className="border-t border-slate-100"><td className="py-1"><Id t={p} onOpen={onOpen} /> {p.title}</td><td>{STATUS[p.status]}</td><td>{total ? `${done} of ${total}` : '–'}</td><td>{h(hoursPeriod)}</td><td>{h(hoursTotal)}</td></tr>)}</tbody></table> : <Empty>No projects in scope.</Empty>}
          </Block>

          <Block title="Hours logged" note={h(r.totals.hours)}>
            {r.perTicket.length ? <table className="w-full text-sm"><tbody>{r.perTicket.map(({ t, h: x }) => <tr key={t.id} className="border-t border-slate-100"><td className="py-1 pr-2"><Id t={t} onOpen={onOpen} /></td><td>{t.title}</td><td className="text-right text-xs text-slate-500">{fmtH(x)}</td></tr>)}</tbody></table> : <Empty>No hours logged in this period.</Empty>}
          </Block>

          <Block title="By department">
            <table className="w-full text-sm"><thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th>Department</th><th>Opened</th><th>Finished</th><th>Open now</th><th>Blocked</th><th>Hours</th></tr></thead><tbody>{r.departments.map((g) => <tr key={g.id} className="border-t border-slate-100"><td className="py-1">{g.name}</td><td>{g.opened}</td><td>{g.finished}</td><td>{g.open}</td><td>{g.blocked || '–'}</td><td>{h(g.hours)}</td></tr>)}</tbody></table>
          </Block>
        </>
      )}
    </div>
  );
}
