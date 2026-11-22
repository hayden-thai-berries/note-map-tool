import { useEffect, useState } from 'react';
import { useRecords, apply } from '../lib/records.js';
import { updateSheet, removeSheet } from '../lib/ops.js';

const Field = ({ label, children }) => <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}<div className="mt-0.5 text-sm font-normal normal-case tracking-normal text-slate-900">{children}</div></label>;
const input = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500';

/* Edit one sheet or app. Typing is one undo step per field; the name is applied when you leave the field. */
export default function SheetEdit({ k, onSel }) {
  const { data } = useRecords(), sheet = data.sheets.find((x) => x.name.toLowerCase() === k);
  const [name, setName] = useState(sheet?.name ?? ''), [sure, setSure] = useState(false);
  useEffect(() => { setName(sheet?.name ?? ''); setSure(false); }, [sheet?.id, sheet?.name]);
  if (!sheet) return null;
  const set = (patch, field) => apply((d) => updateSheet(d, sheet.id, patch), { key: `sheet:${sheet.id}:${field}` });
  const commitName = () => { const v = name.trim(); if (!v) return setName(sheet.name); if (v !== sheet.name && set({ name: v }, 'name') !== false) onSel(v.toLowerCase()); };
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3" open>
      <summary className="cursor-pointer text-sm font-semibold">Edit this {sheet.kind}</summary>
      <div className="mt-3">
        <Field label="Name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} /></Field>
        <Field label="Owner"><input className={input} value={sheet.owner} onChange={(e) => set({ owner: e.target.value }, 'owner')} /></Field>
        <Field label="Criticality">
          <select className={input} value={sheet.crit || ''} onChange={(e) => set({ crit: e.target.value || null }, 'crit')}><option value="">None</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        </Field>
        <Field label="Link (URL)"><input className={input} type="url" placeholder="https://" value={sheet.url || ''} onChange={(e) => set({ url: e.target.value || null }, 'url')} /></Field>
        <Field label="Note"><textarea className={`${input} min-h-20`} value={sheet.note} onChange={(e) => set({ note: e.target.value }, 'note')} /></Field>
        {!sure ? <button className="rounded-lg border border-red-300 bg-white px-3 py-1 text-sm text-red-700 hover:bg-red-50" onClick={() => setSure(true)}>Delete…</button> : (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-sm">
            <p className="mb-2">Move <b>{sheet.name}</b> to Removed? Its links go with it. You can restore it any time.</p>
            <button className="mr-2 rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700" onClick={() => { apply((d) => removeSheet(d, sheet.id)); onSel(null); }}>Move to Removed</button>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-1" onClick={() => setSure(false)}>Cancel</button>
          </div>
        )}
      </div>
    </details>
  );
}
