import { useState } from 'react';
import { tickets, STATUS, allNodes } from '../data.js';
import { apply } from '../lib/records.js';
import { updateTicket } from '../lib/ops.js';
import { Btn } from '../components/ui.jsx';
import TicketForm from '../components/TicketForm.jsx';

const hours = (t) => (t.log || []).reduce((a, e) => a + (+e.hours || 0), 0);
const nameOf = (k) => (k?.startsWith('dept:') ? k.slice(5) : allNodes().find((n) => n.key === k)?.name || k);
const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm';
const PRI = { urgent: 'bg-red-600 text-white', high: 'bg-orange-100 text-orange-800', low: 'bg-slate-100 text-slate-600' };

/* Tickets, projects, change requests and features: a board with filters, a form to create and edit, and quick status changes. */
export default function Work() {
  const [f, setF] = useState({ type: '', owner: '', priority: '', open: false, q: '' }), [form, setForm] = useState(null);
  const owners = [...new Set(tickets.map((t) => t.owner).filter(Boolean))].sort();
  const list = tickets.filter((t) => (!f.type || t.type === f.type) && (!f.owner || t.owner === f.owner) && (!f.priority || (t.priority || 'normal') === f.priority) && (!f.open || t.status !== 'done') && (!f.q || (t.title + ' ' + t.id + ' ' + (t.description || '') + ' ' + (t.notes || '')).toLowerCase().includes(f.q.toLowerCase())));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const quick = (t, patch, key) => apply((d) => updateTicket(d, t.id, patch), { key: `ticket:${t.id}:${key}` });
  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Btn primary onClick={() => setForm({ id: null })}>New ticket</Btn>
        <select aria-label="Type" className={sel} value={f.type} onChange={set('type')}><option value="">All types</option><option value="ticket">Tickets</option><option value="project">Projects</option><option value="change">Change requests</option><option value="feature">Features</option></select>
        <select aria-label="Owner" className={sel} value={f.owner} onChange={set('owner')}><option value="">Everyone</option>{owners.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Priority" className={sel} value={f.priority} onChange={set('priority')}><option value="">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.open} onChange={set('open')} />Open only</label>
        <input aria-label="Search tickets" type="search" className={`${sel} w-56`} placeholder="Search tickets" value={f.q} onChange={set('q')} />
        <span className="ml-auto text-sm text-slate-500">{list.length} of {tickets.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATUS).map(([k, label]) => (
          <section key={k} className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span><span>{list.filter((t) => t.status === k).length}</span></h3>
            <div className="space-y-2">
              {list.filter((t) => t.status === k).map((t) => (
                <article key={t.id} className={`rounded-lg border p-2.5 text-sm ${k === 'blocked' ? 'border-red-400' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between text-xs text-slate-500"><code>{t.id}</code><span className="flex items-center gap-1">{t.priority && t.priority !== 'normal' && <span className={`rounded px-1 font-semibold uppercase ${PRI[t.priority]}`}>{t.priority}</span>}<span className="uppercase">{t.type}</span></span></div>
                  <button type="button" className="text-left font-semibold hover:text-blue-700" onClick={() => setForm({ id: t.id })}>{t.title}</button>
                  {k === 'blocked' && t.blocked && <div className="mt-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{t.blocked}</div>}
                  <div className="mt-1.5 flex items-center justify-between text-xs"><span className="rounded bg-emerald-100 px-1.5">{nameOf(t.target) || 'not linked'}</span><span className="text-slate-500">{hours(t) ? hours(t) + ' h · ' : ''}{t.owner}</span></div>
                  <select aria-label="Status" className={`${sel} mt-2 !py-0.5 text-xs`} value={t.status} onChange={(e) => quick(t, { status: e.target.value, ...(e.target.value !== 'blocked' ? { blocked: undefined } : {}) }, 'status')}>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      {form && <TicketForm key={form.id || 'new'} id={form.id} onClose={() => setForm(null)} />}
    </div>
  );
}
