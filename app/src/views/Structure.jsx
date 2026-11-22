import { useState } from 'react';
import { useRecords, apply } from '../lib/records.js';
import * as o from '../lib/ops.js';
import { CommitInput, Btn } from '../components/ui.jsx';
import SheetEdit from '../components/SheetEdit.jsx';
import { openTicketsForDepartment, openTicketsForSection } from '../lib/rollup.js';

const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm';
const CRIT = { high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-slate-200 text-slate-700' };

/* Edit the map itself: departments (members, description), functions (the stored "sections"), sheets, apps and links. Everything here is undoable; deleting a sheet or link goes to Removed. */
export default function Structure({ sel: selected, setSel }) {
  const { data: d } = useRecords(), [newDept, setNewDept] = useState(''), [open, setOpen] = useState({});
  const ed = (fn, key) => apply(fn, key ? { key } : {});
  const open1 = (sheet) => setSel(sheet.name.toLowerCase());
  const sheetRow = (s, i, list) => (
    <li key={s.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${selected === s.name.toLowerCase() ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => open1(s)}>{s.name}</button>
      {s.owner && <span className="hidden text-xs text-slate-500 sm:inline">{s.owner}</span>}
      {s.crit && <span className={`rounded-full px-1.5 text-[10px] font-semibold uppercase ${CRIT[s.crit]}`}>{s.crit}</span>}
      {s.kind === 'sheet' && <select aria-label={`Move ${s.name}`} className={`${sel} !py-0.5 text-xs`} value="" onChange={(e) => e.target.value && ed((x) => o.moveSheet(x, s.id, e.target.value))}><option value="">Move to…</option>{d.departments.flatMap((dep) => dep.sections.filter((c) => c.id !== s.sectionId).map((c) => <option key={c.id} value={c.id}>{dep.name} › {c.title || '(no title)'}</option>))}</select>}
      <button type="button" aria-label={`Move ${s.name} up`} disabled={i === 0} className="px-1 text-slate-500 disabled:opacity-30" onClick={() => ed((x) => o.shiftSheet(x, s.id, -1))}>↑</button>
      <button type="button" aria-label={`Move ${s.name} down`} disabled={i === list.length - 1} className="px-1 text-slate-500 disabled:opacity-30" onClick={() => ed((x) => o.shiftSheet(x, s.id, 1))}>↓</button>
    </li>
  );
  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-auto p-5">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">Edit map</h1>
        <p className="mb-4 text-sm text-slate-500">Departments, functions, sheets, apps and links. Every change can be undone; deleted sheets and links wait in Removed.</p>
        {d.departments.map((dep, di) => (
          <section key={dep.id} className="mb-5 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <CommitInput aria-label="Department name" className="!w-56 font-semibold" value={dep.name} onCommit={(v) => v.trim() && ed((x) => o.updateDepartment(x, dep.id, { name: v.trim() }))} />
              <Btn aria-label="Move department up" disabled={di === 0} onClick={() => ed((x) => o.shiftDepartment(x, dep.id, -1))}>↑</Btn>
              <Btn aria-label="Move department down" disabled={di === d.departments.length - 1} onClick={() => ed((x) => o.shiftDepartment(x, dep.id, 1))}>↓</Btn>
              <OpenBadge n={openTicketsForDepartment(d, dep.id).length} />
              <Btn danger className="ml-auto" onClick={() => window.confirm(`Delete department "${dep.name}"? It must be empty.`) && ed((x) => o.removeDepartment(x, dep.id))}>Delete department</Btn>
            </div>
            <CommitInput multiline aria-label="Department description (one line each)" placeholder="What this department does (one line each)" value={dep.text.join('\n')} onCommit={(v) => ed((x) => o.updateDepartment(x, dep.id, { text: v.split('\n').map((l) => l.trim()).filter(Boolean) }))} />
            <Members dep={dep} ed={ed} />
            {dep.sections.map((sec, si) => {
              const sheets = d.sheets.filter((s) => s.sectionId === sec.id);
              return (
                <div key={sec.id} className="mt-3 rounded-lg bg-amber-50 p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <CommitInput aria-label="Function title" placeholder="(no title)" value={sec.title ?? ''} onCommit={(v) => ed((x) => o.updateSection(x, sec.id, { title: v.trim() || null }))} />
                    <Btn aria-label="Move function up" disabled={si === 0} onClick={() => ed((x) => o.shiftSection(x, sec.id, -1))}>↑</Btn>
                    <Btn aria-label="Move function down" disabled={si === dep.sections.length - 1} onClick={() => ed((x) => o.shiftSection(x, sec.id, 1))}>↓</Btn>
                    <OpenBadge n={openTicketsForSection(d, sec.id).length} />
                    <Btn danger onClick={() => ed((x) => o.removeSection(x, sec.id))}>Delete</Btn>
                  </div>
                  <CommitInput multiline aria-label="Function description" placeholder="What this function does, and how (optional)" value={sec.note} onCommit={(v) => ed((x) => o.updateSection(x, sec.id, { note: v }))} />
                  <ul className="mt-2 space-y-1">{sheets.map((s, i) => sheetRow(s, i, sheets))}</ul>
                  <AddRow label="Add sheet" placeholder="Sheet name" onAdd={(name) => ed((x) => { const id = o.addSheet(x, { name, departmentId: dep.id, sectionId: sec.id }); setTimeout(() => setSel(name.trim().toLowerCase()), 0); return id; })} />
                </div>
              );
            })}
            <AddRow label="Add function" placeholder="Function (process) title" onAdd={(t) => ed((x) => o.addSection(x, dep.id, t))} allowEmpty />
          </section>
        ))}
        <AddRow label="Add department" placeholder="Department name" onAdd={(n) => ed((x) => o.addDepartment(x, n))} />
        <section className="mb-5 mt-5 rounded-xl border border-violet-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">Connected apps</h2>
          <ul className="space-y-1">{d.sheets.filter((s) => s.kind === 'app').map((s, i, l) => sheetRow(s, i, l))}</ul>
          <AddRow label="Add app" placeholder="App name (CRM, Slack…)" onAdd={(n) => ed((x) => { o.addSheet(x, { kind: 'app', name: n }); setTimeout(() => setSel(n.trim().toLowerCase()), 0); })} />
        </section>
        <section className="mb-10 rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">Links (data flows between sheets)</h2>
          {d.links.map((l) => (
            <div key={l.id} className="mb-1.5 flex items-center gap-2">
              <select aria-label="From" className={sel} value={l.fromId || ''} onChange={(e) => ed((x) => o.updateLink(x, l.id, { fromId: e.target.value }))}>{!l.fromId && <option value="">{l.fromName} (not on the map)</option>}{d.sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <span>→</span>
              <select aria-label="To" className={sel} value={l.toId || ''} onChange={(e) => ed((x) => o.updateLink(x, l.id, { toId: e.target.value }))}>{!l.toId && <option value="">{l.toName} (not on the map)</option>}{d.sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <CommitInput aria-label="Method" placeholder="IMPORTRANGE, manual copy…" value={l.label} onCommit={(v) => ed((x) => o.updateLink(x, l.id, { label: v }))} />
              <Btn danger onClick={() => ed((x) => o.removeLink(x, l.id))}>Delete</Btn>
            </div>
          ))}
          <NewLink sheets={d.sheets} onAdd={(v) => ed((x) => o.addLink(x, v))} />
        </section>
      </div>
      {selected && <aside className="w-[340px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4"><SheetEdit k={selected} onSel={setSel} /></aside>}
    </div>
  );
}

const OpenBadge = ({ n }) => (n ? <span title="Open tickets and projects" className="shrink-0 rounded-full bg-amber-200 px-2 text-[11px] font-semibold text-amber-900">{n} open</span> : null);

/* who is in a department and what they do; the owner pick-list on a sheet offers these names */
function Members({ dep, ed }) {
  const [name, setName] = useState(''), [role, setRole] = useState(''), members = dep.members || [];
  const add = () => { if (!name.trim()) return; ed((x) => o.addMember(x, dep.id, { name, role })); setName(''); setRole(''); };
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-2" role="group" aria-label={`Members of ${dep.name}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Members ({members.length})</div>
      {members.map((m) => (
        <div key={m.id} className="mb-1 flex items-center gap-2">
          <CommitInput aria-label="Member name" className="!w-44" value={m.name} onCommit={(v) => v.trim() && ed((x) => o.updateMember(x, dep.id, m.id, { name: v.trim() }))} />
          <CommitInput aria-label="Member role" className="!w-44" placeholder="Role" value={m.role} onCommit={(v) => ed((x) => o.updateMember(x, dep.id, m.id, { role: v.trim() }))} />
          <CommitInput aria-label="Member email" className="!w-56" placeholder="Email (optional)" value={m.email ?? ''} onCommit={(v) => ed((x) => o.updateMember(x, dep.id, m.id, { email: v.trim() }))} />
          <Btn danger aria-label={`Remove ${m.name}`} onClick={() => ed((x) => o.removeMember(x, dep.id, m.id))}>Remove</Btn>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input aria-label="New member name" className={`${sel} w-44`} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input aria-label="New member role" className={`${sel} w-44`} placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Btn onClick={add}>Add member</Btn>
      </div>
    </div>
  );
}
function AddRow({ label, placeholder, onAdd, allowEmpty = false }) {
  const [v, setV] = useState('');
  const go = () => { if (!allowEmpty && !v.trim()) return; onAdd(v); setV(''); };
  return <div className="mt-2 flex items-center gap-2"><input aria-label={label} className={`${sel} w-64`} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /><Btn onClick={go}>{label}</Btn></div>;
}
function NewLink({ sheets, onAdd }) {
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [label, setLabel] = useState('');
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
      <select aria-label="New link from" className={sel} value={from} onChange={(e) => setFrom(e.target.value)}><option value="">From…</option>{sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><span>→</span>
      <select aria-label="New link to" className={sel} value={to} onChange={(e) => setTo(e.target.value)}><option value="">To…</option>{sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <input aria-label="New link method" className={`${sel} w-56`} placeholder="IMPORTRANGE, manual copy…" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Btn disabled={!from || !to} onClick={() => { onAdd({ fromId: from, toId: to, label }); setFrom(''); setTo(''); setLabel(''); }}>Add link</Btn>
    </div>
  );
}
