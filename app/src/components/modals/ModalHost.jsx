import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import DepartmentModal from './DepartmentModal.jsx';
import FunctionModal from './FunctionModal.jsx';
import FileModal from './FileModal.jsx';
import LinkModal from './LinkModal.jsx';
import TicketForm from '../TicketForm.jsx';

const Ctx = createContext({ open: () => {}, close: () => {} });
export const useModals = () => useContext(Ctx);

/* One modal at a time. open('department' | 'function' | 'file' | 'link' | 'ticket', params); opening another replaces the current one. */
export function ModalProvider({ children }) {
  const [m, setM] = useState(null), close = useCallback(() => setM(null), []), open = useCallback((kind, params = {}) => setM({ kind, params, n: Date.now() }), []);
  const api = useMemo(() => ({ open, close }), [open, close]), p = m?.params || {};
  return (
    <Ctx.Provider value={api}>
      {children}
      {m?.kind === 'department' && <DepartmentModal key={m.n} {...p} onClose={close} open={open} />}
      {m?.kind === 'function' && <FunctionModal key={m.n} {...p} onClose={close} />}
      {m?.kind === 'file' && <FileModal key={m.n} {...p} onClose={close} open={open} />}
      {m?.kind === 'link' && <LinkModal key={m.n} {...p} onClose={close} />}
      {m?.kind === 'ticket' && <TicketForm key={m.n} id={p.id} preset={p.preset} onClose={close} />}
    </Ctx.Provider>
  );
}
