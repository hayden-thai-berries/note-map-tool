import { useState } from 'react';
import { tickets, STATUS, allNodes } from '../data.js';
import { apply } from '../lib/records.js';
import { updateTicket, removeTicket } from '../lib/ops.js';

const hours = (t) => (t.log || []).reduce((a, e) => a + (+e.hours || 0), 0);
const nameOf = (k) => (k?.startsWith('dept:') ? k.slice(5) : allNodes().find((n) => n.key === k)?.name || k);
const field = 'rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs';

/* Tickets and projects as a board. Change the status or owner on a card; Remove sends it to Removed. */
export default function Work() {
  const [type, setType] = useState('');
  const list = tickets.filter((t) => !type || t.type === type);
  const edit = (t, patch, f) => apply((d) => updateTicket(d, t.id, patch), { key: `ticket:${t.id}:${f}` });
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">Work</h2>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">
          <option value="">All types</option><option value="ticket">Tickets</option><option value="project">Projects</option><option value="change">Change requests</option><option value="feature">Features</option>
        </select>
        <span className="text-sm text-slate-500">{list.length} items</span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATUS).map(([k, label]) => (
          <section key={k} className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span><span>{list.filter((t) => t.status === k).length}</span></h3>
            <div className="space-y-2">
              {list.filter((t) => t.status === k).map((t) => (
                <article key={t.id} className={`rounded-lg border p-2.5 text-sm ${k === 'blocked' ? 'border-red-400' : 'border-slate-200'}`}>
                  <div className="flex justify-between text-xs text-slate-500"><code>{t.id}</code><span className="uppercase">{t.type}</span></div>
                  <div className="font-semibold">{t.title}</div>
                  {k === 'blocked' && <input className={`${field} mt-1 w-full border-red-300 bg-red-50 text-red-800`} placeholder="Blocked because…" value={t.blocked || ''} onChange={(e) => edit(t, { blocked: e.target.value }, 'blocked')} />}
                  <div className="mt-1.5 flex items-center justify-between text-xs"><span className="rounded bg-emerald-100 px-1.5">{nameOf(t.target)}</span><span className="text-slate-500">{hours(t) ? hours(t) + ' h' : ''}</span></div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <select aria-label="Status" className={field} value={t.status} onChange={(e) => edit(t, { status: e.target.value }, 'status')}>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <input aria-label="Owner" className={`${field} w-16 min-w-0 flex-1`} placeholder="Owner" value={t.owner || ''} onChange={(e) => edit(t, { owner: e.target.value }, 'owner')} />
                    <button className="rounded-md px-1.5 text-xs text-red-700 hover:bg-red-50" title="Move to Removed" onClick={() => window.confirm(`Move "${t.title}" to Removed? You can restore it.`) && apply((d) => removeTicket(d, t.id))}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
