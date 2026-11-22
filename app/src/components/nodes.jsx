import { Handle, Position } from '@xyflow/react';
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

export function LaneNode({ data }) {
  return (
    <div className="flex h-full w-full rounded-lg border border-slate-300 bg-white/70">
      <div className="grid w-[110px] shrink-0 place-items-center rounded-l-lg border-r border-slate-300 bg-slate-200 text-sm font-semibold">{data.team}</div>
    </div>
  );
}

export function StepNode({ data, selected }) {
  const { st, idx } = data;
  return (
    <div className={`h-[74px] w-[180px] overflow-hidden rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-sm shadow-sm ${selected ? 'ring-2 ring-blue-600' : ''}`} title={st.note}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle id="bs" type="source" position={Position.Bottom} />
      <Handle id="bt" type="target" position={Position.Bottom} />
      <div className="flex items-start gap-1.5"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blue-600 text-[10px] text-white">{idx + 1}</span><b className="leading-tight">{st.title}</b></div>
      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
        {st.day && <span className="rounded bg-slate-200 px-1">{st.day}</span>}
        {st.sheet && <span className="rounded bg-emerald-200 px-1">{st.sheet}</span>}
        {st.ticket && <span className="rounded bg-blue-200 px-1">{st.ticket}</span>}
      </div>
    </div>
  );
}

export const nodeTypes = { dept: DeptNode, section: SectionNode, sheet: SheetNode, lane: LaneNode, step: StepNode };
