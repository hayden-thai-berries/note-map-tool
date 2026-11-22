import { useRecords } from '../lib/records.js';
import { openTicketsForDepartment, openTicketsForSection } from '../lib/rollup.js';

/* One department seen from the map: what it does, who is in it, and its functions with their open work. Read-only; edit it on Edit map. */
export default function DeptPanel({ name, onClose }) {
  const { data: d } = useRecords(), dep = d.departments.find((x) => x.name === name);
  if (!dep) return null;
  const open = openTicketsForDepartment(d, dep.id), members = dep.members || [];
  return (
    <div role="region" aria-label={`Department ${dep.name}`}>
      <div className="flex items-start justify-between"><h3 className="text-xl font-semibold leading-tight">{dep.name}</h3>{onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">×</button>}</div>
      <p className="mb-2 text-sm text-slate-500">Department · {open.length} open {open.length === 1 ? 'ticket' : 'tickets'}</p>
      <div className="border-t border-slate-200 py-2"><div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What they do</div><div className="whitespace-pre-wrap text-sm">{dep.text.length ? dep.text.join('\n') : <span className="text-slate-400">No description yet.</span>}</div></div>
      <div className="border-t border-slate-200 py-2"><div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Members ({members.length})</div>
        {members.length ? members.map((m) => <div key={m.id} className="text-sm"><b>{m.name}</b>{m.role && <span className="text-slate-500"> · {m.role}</span>}{m.email && <> · <a className="text-blue-600 underline" href={`mailto:${m.email}`}>{m.email}</a></>}</div>) : <span className="text-sm text-slate-400">None recorded</span>}
      </div>
      <div className="border-t border-slate-200 py-2"><div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Functions ({dep.sections.length})</div>
        {dep.sections.map((sec) => { const n = d.sheets.filter((s) => s.sectionId === sec.id).length, t = openTicketsForSection(d, sec.id).length; return (
          <div key={sec.id} className="mb-1 rounded border border-slate-200 px-2 py-1 text-sm"><div className="flex justify-between gap-2"><b>{sec.title || '(untitled)'}</b><span className="shrink-0 text-xs text-slate-500">{n} {n === 1 ? 'file' : 'files'}{t ? ` · ${t} open` : ''}</span></div>{sec.note && <div className="whitespace-pre-wrap text-xs text-slate-600">{sec.note}</div>}</div>
        ); })}
      </div>
    </div>
  );
}
