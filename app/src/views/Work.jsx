import { useState } from 'react';
import { useRecords, apply } from '../lib/records.js';
import { moveTicket, updateTicket, addTicket } from '../lib/ops.js';
import { byPriority, priorityOf, targetOf } from '../lib/board.js';
import { Btn } from '../components/ui.jsx';
import TicketForm from '../components/TicketForm.jsx';
import { Summary, Board, Table, BlockedAsk } from '../components/TicketBoard.jsx';
import Report from '../components/Report.jsx';

const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm';
const remembered = () => { try { const v = localStorage.getItem('tview'); return v === 'table' || v === 'report' ? v : 'board'; } catch { return 'board'; } };

/* Tickets, projects, change requests and features: a board you can drag across, or a table, both editable in place, plus the full form. */
export default function Work() {
  const { data: d } = useRecords(), items = d.tickets.items;
  const [f, setF] = useState({ type: '', owner: '', priority: '', open: false, q: '' }), [form, setForm] = useState(null), [view, setView] = useState(remembered), [ask, setAsk] = useState(null);
  const owners = [...new Set(items.map((t) => t.owner).filter(Boolean))].sort();
  const text = (t) => [t.id, t.title, t.description, t.owner, targetOf(d, t)?.name, t.notes, t.blocked, t.requestedBy, t.impact, items.find((x) => x.id === t.project)?.title].join(' ').toLowerCase();
  const list = byPriority(items).filter((t) => (!f.type || t.type === f.type) && (!f.owner || t.owner === f.owner) && (!f.priority || priorityOf(t) === f.priority) && (!f.open || t.status !== 'done') && (!f.q || text(t).includes(f.q.toLowerCase())));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const quick = (t, patch, key) => apply((x) => updateTicket(x, t.id, patch), { key: `ticket:${t.id}:${key}` });
  const onMove = (t, status) => { if (status === t.status) return; if (status === 'blocked') setAsk(t); else apply((x) => moveTicket(x, t.id, status)); };
  const onAdd = (title, status) => apply((x) => addTicket(x, { title, status, type: f.type || 'ticket', owner: f.owner || '' }));
  const switchTo = (v) => { setView(v); try { localStorage.setItem('tview', v); } catch { /* not remembered, still works */ } };
  const tab = (v, label) => <button type="button" aria-pressed={view === v} className={`px-3 py-1 text-sm ${view === v ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-100'}`} onClick={() => switchTo(v)}>{label}</button>;
  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Btn primary onClick={() => setForm({ id: null })}>New ticket</Btn>
        <div className="flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="View">{tab('board', 'Board')}{tab('table', 'Table')}{tab('report', 'Report')}</div>
        <select aria-label="Type" className={sel} value={f.type} onChange={set('type')}><option value="">All types</option><option value="ticket">Tickets</option><option value="project">Projects</option><option value="change">Change requests</option><option value="feature">Features</option></select>
        <select aria-label="Owner filter" className={sel} value={f.owner} onChange={set('owner')}><option value="">Everyone</option>{owners.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Priority filter" className={sel} value={f.priority} onChange={set('priority')}><option value="">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.open} onChange={set('open')} />Open only</label>
        <input aria-label="Search tickets" type="search" className={`${sel} w-56`} placeholder="Search tickets" value={f.q} onChange={set('q')} />
        <span className="ml-auto text-sm text-slate-500">{list.length} of {items.length}</span>
      </div>
      {view !== 'report' && <Summary items={items} onOpen={(id) => setForm({ id })} />}
      {view === 'report' ? <Report d={d} list={list} onOpen={(id) => setForm({ id })} /> : view === 'board' ? <Board d={d} list={list} quick={quick} onMove={onMove} onOpen={(id) => setForm({ id })} onAdd={onAdd} /> : <Table d={d} list={list} quick={quick} onMove={onMove} onOpen={(id) => setForm({ id })} />}
      {ask && <BlockedAsk ticket={ask} onDone={(reason) => { if (reason !== null) apply((x) => moveTicket(x, ask.id, 'blocked', reason)); setAsk(null); }} />}
      {form && <TicketForm key={form.id || 'new'} id={form.id} onClose={() => setForm(null)} />}
    </div>
  );
}
