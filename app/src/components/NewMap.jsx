import { useState } from 'react';
import { createMap } from '../lib/records.js';
import { Btn } from './ui.jsx';

/* Start a map from nothing: a file name and a title. */
export default function NewMap({ onCreated, onCancel }) {
  const [name, setName] = useState(''), [title, setTitle] = useState(''), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await createMap(name.trim(), title); onCreated(name.trim()); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const f = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500';
  return (
    <form onSubmit={go} className="rounded-xl border border-slate-200 bg-white p-3 text-sm" aria-label="New map">
      <div className="mb-2 font-semibold">New map</div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Title<input className={f} required autoFocus placeholder="For example: Finance sheets" value={title} onChange={(e) => { setTitle(e.target.value); if (!name || name === slug(title)) setName(slug(e.target.value)); }} /></label>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">File name<input className={f} required pattern="[A-Za-z0-9_\-]{1,40}" placeholder="finance" value={name} onChange={(e) => setName(e.target.value)} /></label>
      {err && <p role="alert" className="mb-2 text-red-700">{err}</p>}
      <div className="flex gap-2"><Btn primary type="submit" disabled={busy}>Create map</Btn>{onCancel && <Btn onClick={onCancel}>Cancel</Btn>}</div>
    </form>
  );
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
