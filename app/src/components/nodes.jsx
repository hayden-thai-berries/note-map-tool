import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Handle, Position, useConnection } from '@xyflow/react';
import { useModals } from './modals/ModalHost.jsx';

const CRIT = { high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-slate-200 text-slate-700' };

const mini = 'nodrag nopan shrink-0 rounded border border-slate-300 bg-white px-1.5 text-[10px] font-medium text-slate-600 hover:border-blue-500 hover:text-blue-700';

export function DeptNode({ data }) {
  const { open } = useModals();
  return (
    <div className="h-full w-full rounded-xl border border-slate-300 bg-white/80">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-700">{data.name}</span>
        {data.depId && <button type="button" className={mini} onClick={(e) => { e.stopPropagation(); open('function', { depId: data.depId }); }}>+ Function</button>}
      </div>
    </div>
  );
}

export function SectionNode({ data }) {
  const { open } = useModals();
  return (
    <div className="flex w-[230px] items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs" title={data.note}>
      <span className={`truncate ${data.title ? '' : 'italic text-amber-800'}`}>{data.title || '(untitled function)'}</span>
      <button type="button" className={mini} onClick={(e) => { e.stopPropagation(); open('file', { sectionId: data.secId }); }}>+ File</button>
    </div>
  );
}

export function SheetNode({ data, selected }) {
  const { n, open = [], dim, showTix } = data;
  const blocked = showTix && open.some((t) => t.status === 'blocked');
  return (
    <div
      className={`h-[62px] w-[230px] overflow-hidden rounded-lg border px-3 py-1.5 text-sm shadow-sm transition-opacity ${
        n.kind === 'app' ? 'border-violet-300 bg-violet-100' : 'border-emerald-300 bg-emerald-100'
      } ${selected ? 'ring-2 ring-blue-600' : ''} ${blocked ? 'ring-2 ring-red-500' : ''} ${dim ? 'opacity-30' : ''}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <b className="truncate">{n.name}</b>
        <span className="flex items-center gap-1">
          {!showTix && open.length > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[10px] text-white">{open.length}</span>}
          {n.crit && <span className={`rounded-full px-1.5 text-[10px] font-semibold uppercase ${CRIT[n.crit]}`}>{n.crit}</span>}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span className="truncate">{n.details || ' '}</span>
        {showTix && (
          <span className="flex gap-1">
            {open.map((t) => (
              <span key={t.id} title={t.title} className={`rounded px-1 text-[10px] ${t.status === 'blocked' ? 'bg-red-200 text-red-900' : 'bg-blue-100 text-blue-900'}`}>
                {t.id[0]}{t.id.slice(-3)}
              </span>
            ))}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

/* What the flow canvas can do, handed to its boxes without redrawing the diagram (so a drag is never interrupted). Set by views/Flows.jsx. */
export const FlowUi = createContext({});
/* A text box that takes focus as soon as its box is shown. A box is hidden until the canvas has measured it, and a hidden box cannot take focus, so keep trying for a moment. */
function AutoInput({ multiline, ...props }) {
  const ref = useRef(null);
  useEffect(() => { let n = 0, raf; const tick = () => { ref.current?.focus(); if (ref.current && document.activeElement !== ref.current && n++ < 60) raf = requestAnimationFrame(tick); }; tick(); return () => cancelAnimationFrame(raf); }, []);
  return multiline ? <textarea ref={ref} {...props} /> : <input ref={ref} {...props} />;
}
const tb = 'rounded-full px-1.5 hover:bg-blue-50 hover:text-blue-700';
const mini2 = 'nodrag nopan grid h-4 w-4 place-items-center rounded border border-slate-300 bg-white text-[10px] leading-none text-slate-600 hover:border-blue-500 disabled:opacity-30';

export function LaneNode({ data }) {
  const ui = useContext(FlowUi), [renaming, setRenaming] = useState(false), hot = ui.hot === data.i;
  const done = (v) => { setRenaming(false); if (v.trim() && v.trim() !== data.team) ui.renameLane?.(data.team, v); };
  return (
    <div className={`flex h-full w-full rounded-lg border ${hot ? 'border-dashed border-blue-500 bg-blue-50' : 'border-slate-300 bg-white/70'}`} title="Double-click an empty spot to add a step here">
      <div className="nodrag nopan flex w-[110px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-l-lg border-r border-slate-300 bg-slate-200 px-1" onDoubleClick={(e) => { e.stopPropagation(); setRenaming(true); }}>
        {renaming
          ? <AutoInput aria-label="Lane name" className="nodrag w-full rounded border border-blue-500 bg-white px-1 text-center text-sm" defaultValue={data.team} onFocus={(e) => e.target.select()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') done(e.currentTarget.value); else if (e.key === 'Escape') setRenaming(false); }} onBlur={(e) => done(e.currentTarget.value)} />
          : <span className="text-center text-sm font-semibold" title="Double-click to rename">{data.team}</span>}
        <span className="flex gap-1">
          <button type="button" aria-label={`Move lane ${data.team} up`} disabled={data.i === 0} className={mini2} onClick={(e) => { e.stopPropagation(); ui.moveLane?.(data.team, -1); }}>↑</button>
          <button type="button" aria-label={`Move lane ${data.team} down`} disabled={data.i === data.n - 1} className={mini2} onClick={(e) => { e.stopPropagation(); ui.moveLane?.(data.team, 1); }}>↓</button>
          {data.empty && <button type="button" aria-label={`Remove lane ${data.team}`} className={mini2} onClick={(e) => { e.stopPropagation(); ui.removeLane?.(data.team); }}>×</button>}
        </span>
      </div>
    </div>
  );
}

/* A step. Its shape says what it is: a plain box, a start or end pill, or a decision diamond (the shape lives in the Data file). */
export function StepNode({ data, selected }) {
  const { st, idx, kind } = data, ui = useContext(FlowUi), editing = ui.editing === idx, connecting = useConnection().inProgress;
  const title = editing
    ? <AutoInput aria-label="Step text" className="nodrag nopan min-w-0 flex-1 rounded border border-blue-500 bg-white px-1 text-sm font-semibold" defaultValue={st.title} onFocus={(e) => e.target.select()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') ui.commitTitle?.(idx, e.currentTarget.value); else if (e.key === 'Escape') ui.stopEdit?.(); }} onBlur={(e) => ui.commitTitle?.(idx, e.currentTarget.value)} />
    : <b className="leading-tight">{st.title}</b>;
  const ring = selected ? 'ring-2 ring-blue-600' : '';
  return (
    <div className="relative h-[74px] w-[180px]" data-kind={kind || 'step'}>
      {selected && !editing && (
        <div className="nodrag nopan absolute -top-7 left-0 z-10 flex gap-0.5 rounded-full border border-slate-300 bg-white px-1 py-0.5 text-[11px] shadow" role="toolbar" aria-label="Step actions">
          <button type="button" className={tb} onClick={() => ui.edit?.(idx)}>Edit text</button>
          <button type="button" className={tb} onClick={() => ui.next?.(idx)}>+ Next</button>
          <button type="button" className={tb} onClick={() => ui.noteOn?.(idx)}>+ Note</button>
          <button type="button" className={`${tb} text-red-700`} onClick={() => ui.del?.(idx)}>Delete</button>
        </div>
      )}
      {/* while an arrow is being dragged, the whole step is where it can land */}
      <Handle type="target" position={Position.Left} style={{ top: 0, left: 0, width: '100%', height: '100%', transform: 'none', borderRadius: 8, opacity: 0, pointerEvents: connecting ? 'all' : 'none' }} />
      <Handle type="source" position={Position.Right} />
      <Handle id="bs" type="source" position={Position.Bottom} />
      <Handle id="bt" type="target" position={Position.Bottom} />
      {kind === 'start' || kind === 'end'
        ? <div className="flex h-full items-center" title={st.note}>
            <div className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-2 px-3 text-sm shadow-sm ${kind === 'start' ? 'border-emerald-500 bg-emerald-100 text-emerald-950' : 'border-slate-600 bg-slate-200 text-slate-900'} ${ring}`}>{title}</div>
          </div>
        : kind === 'decision'
          ? <div className="relative h-full w-full" title={st.note}>
              <svg className="absolute inset-0" width="180" height="74" viewBox="0 0 180 74" aria-hidden="true"><polygon points="90,2 178,37 90,72 2,37" fill="#fef3c7" stroke={selected ? '#2563eb' : '#f59e0b'} strokeWidth={selected ? 3 : 2} /></svg>
              <div className="absolute inset-y-0 left-[38px] right-[38px] flex items-center justify-center text-center text-xs">{title}</div>
            </div>
          : <div className={`h-full w-full overflow-hidden rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-sm shadow-sm ${ring}`} title={st.note}>
              <div className="flex items-start gap-1.5"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blue-600 text-[10px] text-white">{idx + 1}</span>{title}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                {st.day && <span className="rounded bg-slate-200 px-1">{st.day}</span>}
                {st.sheet && <span className="rounded bg-emerald-200 px-1">{st.sheet}</span>}
                {st.ticket && <span className="rounded bg-blue-200 px-1">{st.ticket}</span>}
              </div>
            </div>}
    </div>
  );
}

/* A step that is still being typed. Enter adds it and opens the next one after it; Esc drops it; pasting several lines adds one step per line. */
export function DraftNode() {
  const ui = useContext(FlowUi), finished = useRef(false);
  const end = (fn) => { if (finished.current) return; finished.current = true; fn(); };
  return (
    <div className="h-[74px] w-[180px] rounded-lg border-2 border-dashed border-blue-500 bg-blue-50/60 px-2.5 py-2 text-sm">
      <AutoInput aria-label="New step text" placeholder="Type a step, Enter for the next" className="nodrag nopan w-full rounded border border-blue-500 bg-white px-1 py-1 text-sm"
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); const v = e.currentTarget.value; end(() => ui.draftCommit?.(v, true)); } else if (e.key === 'Escape') end(() => ui.draftCancel?.()); }}
        onPaste={(e) => { const t = e.clipboardData.getData('text'); if (/\r?\n/.test(t.trim())) { e.preventDefault(); end(() => ui.draftCommit?.(t, false)); } }}
        onBlur={(e) => { const v = e.currentTarget.value; end(() => (v.trim() ? ui.draftCommit?.(v, false) : ui.draftCancel?.())); }} />
      <div className="mt-1 text-[10px] text-slate-500">Enter: next step · Esc: stop</div>
    </div>
  );
}

/* A sticky note: free text on the diagram. Double-click to edit; Ctrl/Cmd+Enter or leaving the box saves, Esc drops the change. */
const sticky = 'h-full w-full overflow-auto rounded-sm border border-yellow-400 bg-yellow-200 px-2.5 py-2 text-sm text-slate-800 shadow-md';
export function NoteNode({ data, selected }) {
  const ui = useContext(FlowUi), editing = ui.editingNote === data.id;
  return (
    <div className="relative h-full w-full">
      {selected && !editing && (
        <div className="nodrag nopan absolute -top-7 left-0 z-10 flex gap-0.5 rounded-full border border-slate-300 bg-white px-1 py-0.5 text-[11px] shadow" role="toolbar" aria-label="Note actions">
          <button type="button" className={tb} onClick={() => ui.noteEdit?.(data.id)}>Edit text</button>
          <button type="button" className={`${tb} text-red-700`} onClick={() => ui.noteDel?.(data.id)}>Delete</button>
        </div>
      )}
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0 }} />
      {editing
        ? <AutoInput multiline aria-label="Note text" className={`${sticky} nodrag nopan resize-none outline-none ring-2 ring-blue-600`} defaultValue={data.text} onFocus={(e) => e.target.select()}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') ui.noteStop?.(); else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ui.noteCommit?.(data.id, e.currentTarget.value); }}
            onBlur={(e) => ui.noteCommit?.(data.id, e.currentTarget.value)} />
        : <div className={`${sticky} whitespace-pre-wrap break-words ${selected ? 'ring-2 ring-blue-600' : ''} ${data.orphan ? 'border-dashed opacity-70' : ''}`} title={data.orphan ? 'The step this note was pinned to is in Removed' : undefined}>{data.text}</div>}
    </div>
  );
}

/* A note that is still being typed: it exists once it has text. */
export function NoteDraftNode() {
  const ui = useContext(FlowUi), finished = useRef(false);
  const end = (fn) => { if (finished.current) return; finished.current = true; fn(); };
  return (
    <AutoInput multiline aria-label="New note text" placeholder="Type a note. Ctrl/Cmd+Enter to save, Esc to drop it." className={`${sticky} nodrag nopan resize-none outline-none ring-2 ring-blue-600`}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') end(() => ui.noteDraftCancel?.()); else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { const v = e.currentTarget.value; end(() => ui.noteDraftCommit?.(v)); } }}
      onBlur={(e) => { const v = e.currentTarget.value; end(() => (v.trim() ? ui.noteDraftCommit?.(v) : ui.noteDraftCancel?.())); }} />
  );
}

export const nodeTypes = { dept: DeptNode, section: SectionNode, sheet: SheetNode, lane: LaneNode, step: StepNode, draft: DraftNode, note: NoteNode, notedraft: NoteDraftNode };
