import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

type Tipo = 'sucesso' | 'erro';
interface Toast {
  id: number;
  tipo: Tipo;
  texto: string;
}

const ToastContext = createContext<{ sucesso: (t: string) => void; erro: (t: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);

  const remover = (id: number) => setLista((l) => l.filter((t) => t.id !== id));
  const mostrar = useCallback((tipo: Tipo, texto: string) => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l.slice(-3), { id, tipo, texto }]);
    setTimeout(() => remover(id), tipo === 'erro' ? 6000 : 3500);
  }, []);

  const valor = {
    sucesso: useCallback((t: string) => mostrar('sucesso', t), [mostrar]),
    erro: useCallback((t: string) => mostrar('erro', t), [mostrar]),
  };

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-96" aria-live="polite">
        {lista.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'erro' ? 'alert' : 'status'}
            className={`animar-entrada flex items-start gap-3 rounded-lg border px-4 py-3 shadow-xl shadow-navy/10 bg-surface ${
              t.tipo === 'erro' ? 'border-brand/60' : 'border-ok/40'
            }`}
          >
            {t.tipo === 'erro' ? (
              <CircleAlert className="size-5 shrink-0 text-brand mt-0.5" />
            ) : (
              <CircleCheck className="size-5 shrink-0 text-ok mt-0.5" />
            )}
            <p className="flex-1 text-sm leading-snug">{t.texto}</p>
            <button onClick={() => remover(t.id)} className="text-muted hover:text-ink" aria-label="Fechar aviso">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error('useToast fora do ToastProvider');
  return c;
}
