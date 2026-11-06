import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronLeft, ChevronRight, Inbox, LoaderCircle, RotateCw, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------------ Botão
type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-brand text-white hover:bg-brand-hover',
  secundario: 'bg-raised text-ink border border-line-strong hover:border-faint',
  fantasma: 'text-muted hover:text-ink hover:bg-raised',
  perigo: 'bg-transparent text-brand border border-brand/50 hover:bg-brand-soft',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
  icone?: ReactNode;
  tamanho?: 'md' | 'sm';
}

export function Botao({ variante = 'primario', carregando, icone, tamanho = 'md', className, children, disabled, ...p }: BotaoProps) {
  return (
    <button
      {...p}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors whitespace-nowrap',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        tamanho === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-[13px]',
        VARIANTES[variante],
        className,
      )}
    >
      {carregando ? <LoaderCircle className="size-4 animate-spin" /> : icone}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Campos
/** Remove w-full quando o componente recebe uma largura própria (ex.: w-40). */
const largura = (className?: string) => (className && /(^|\s)w-/.test(className) ? '' : 'w-full');

const baseCampo =
  'h-10 rounded-md bg-base border border-line-strong px-3 text-sm text-ink placeholder:text-faint ' +
  'focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-60';

interface CampoProps {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  className?: string;
  children: (id: string, invalido: boolean) => ReactNode;
}

export function Campo({ rotulo, erro, ajuda, obrigatorio, className, children }: CampoProps) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {rotulo}
        {obrigatorio && <span className="text-brand"> *</span>}
      </label>
      {children(id, !!erro)}
      {erro ? (
        <p className="text-xs text-brand" role="alert">
          {erro}
        </p>
      ) : ajuda ? (
        <p className="text-xs text-faint">{ajuda}</p>
      ) : null}
    </div>
  );
}

type InputP = InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean };
export const Input = forwardRef<HTMLInputElement, InputP>(({ invalido, className, ...p }, ref) => (
  <input ref={ref} {...p} aria-invalid={invalido || undefined} className={cx(baseCampo, largura(className), invalido && 'border-brand', className)} />
));

type SelectP = SelectHTMLAttributes<HTMLSelectElement> & { invalido?: boolean };
export function Select({ invalido, className, children, ...p }: SelectP) {
  return (
    <select {...p} aria-invalid={invalido || undefined} className={cx(baseCampo, largura(className), 'pr-8', invalido && 'border-brand', className)}>
      {children}
    </select>
  );
}

type TextareaP = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalido?: boolean };
export function Textarea({ invalido, className, ...p }: TextareaP) {
  return (
    <textarea
      {...p}
      aria-invalid={invalido || undefined}
      className={cx(baseCampo, 'w-full h-auto min-h-20 py-2 resize-y', invalido && 'border-brand', className)}
    />
  );
}

// ------------------------------------------------------------------ Badge de status
const CORES_STATUS: Record<string, string> = {
  DISPONIVEL: 'text-ok bg-ok/10 border-ok/30',
  RESERVADO: 'text-warn bg-warn/10 border-warn/30',
  VENDIDO: 'text-muted bg-raised border-line-strong',
  PAGO: 'text-ok bg-ok/10 border-ok/30',
  PAGA: 'text-ok bg-ok/10 border-ok/30',
  PENDENTE: 'text-warn bg-warn/10 border-warn/30',
  VENCIDO: 'text-brand bg-brand-soft border-brand/40',
  CANCELADO: 'text-muted bg-raised border-line-strong',
  ENTRADA: 'text-ok bg-ok/10 border-ok/30',
  SAIDA: 'text-brand bg-brand-soft border-brand/40',
  RESERVA: 'text-warn bg-warn/10 border-warn/30',
  LIBERACAO: 'text-info bg-info/10 border-info/30',
  TRANSFERENCIA: 'text-info bg-info/10 border-info/30',
  ADMIN: 'text-brand bg-brand-soft border-brand/40',
  VENDEDOR: 'text-info bg-info/10 border-info/30',
  INATIVO: 'text-muted bg-raised border-line-strong',
};

export function Badge({ valor, rotulo }: { valor: string; rotulo?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        CORES_STATUS[valor] ?? 'text-muted bg-raised border-line-strong',
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {rotulo ?? valor}
    </span>
  );
}

// ------------------------------------------------------------------ Estrutura
export function Painel({ titulo, acao, children, className, semPadding }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string; semPadding?: boolean }) {
  return (
    <section className={cx('rounded-xl bg-surface border border-line', className)}>
      {(titulo || acao) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          {titulo && <h2 className="font-display text-lg font-semibold tracking-wide">{titulo}</h2>}
          {acao}
        </header>
      )}
      <div className={semPadding ? '' : 'px-5 pb-5'}>{children}</div>
    </section>
  );
}

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="font-display text-3xl sm:text-[34px] font-semibold leading-none tracking-wide">{titulo}</h1>
        {descricao && <p className="text-muted mt-2 text-sm">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted text-sm">
      <LoaderCircle className="size-5 animate-spin text-brand" />
      {texto}
    </div>
  );
}

export function ErroCarregar({ mensagem, tentar }: { mensagem: string; tentar?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center px-4">
      <p className="text-sm text-ink max-w-md">{mensagem}</p>
      {tentar && (
        <Botao variante="secundario" tamanho="sm" icone={<RotateCw className="size-4" />} onClick={tentar}>
          Tentar novamente
        </Botao>
      )}
    </div>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center px-4">
      <Inbox className="size-8 text-faint mb-1" />
      <p className="font-medium">{titulo}</p>
      {texto && <p className="text-sm text-muted max-w-sm">{texto}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Tabela
export function Tabela({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm tabular">{children}</table>
    </div>
  );
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={cx('text-left font-medium text-faint text-xs px-4 py-3 border-b border-line whitespace-nowrap', className)}>
    {children}
  </th>
);
export const Td = ({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={cx('px-4 py-3 border-b border-line/70 align-middle', className)}>
    {children}
  </td>
);

export function Paginacao({ page, pageSize, total, mudar }: { page: number; pageSize: number; total: number; mudar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const de = (page - 1) * pageSize + 1;
  const ate = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
      <span className="tabular">
        {de}–{ate} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Botao variante="fantasma" tamanho="sm" disabled={page <= 1} onClick={() => mudar(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="size-4" />
        </Botao>
        <span className="tabular px-1">
          {page} / {paginas}
        </span>
        <Botao variante="fantasma" tamanho="sm" disabled={page >= paginas} onClick={() => mudar(page + 1)} aria-label="Próxima página">
          <ChevronRight className="size-4" />
        </Botao>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Modal
export function Modal({
  aberto,
  fechar,
  titulo,
  children,
  rodape,
  largura = 'max-w-2xl',
}: {
  aberto: boolean;
  fechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      // foca o primeiro campo, a menos que o usuário já tenha clicado em outro
      if (ref.current && !ref.current.contains(document.activeElement)) {
        ref.current.querySelector<HTMLElement>('input, select, textarea, button:not([data-fechar])')?.focus();
      }
    }, 30);
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
      anterior?.focus?.();
    };
  }, [aberto, fechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={fechar} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cx(
          'animar-entrada relative w-full bg-surface border border-line-strong rounded-t-2xl sm:rounded-xl shadow-2xl shadow-black/60',
          'max-h-[92vh] flex flex-col',
          largura,
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-xl font-semibold tracking-wide">{titulo}</h2>
          <button data-fechar onClick={fechar} className="text-muted hover:text-ink p-1 rounded" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {rodape && <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">{rodape}</div>}
      </div>
    </div>
  );
}

export function Confirmar({
  aberto,
  titulo,
  texto,
  confirmar,
  cancelar,
  rotulo = 'Confirmar',
  perigo,
  carregando,
}: {
  aberto: boolean;
  titulo: string;
  texto: ReactNode;
  confirmar: () => void;
  cancelar: () => void;
  rotulo?: string;
  perigo?: boolean;
  carregando?: boolean;
}) {
  return (
    <Modal
      aberto={aberto}
      fechar={cancelar}
      titulo={titulo}
      largura="max-w-md"
      rodape={
        <>
          <Botao variante="secundario" onClick={cancelar}>
            Cancelar
          </Botao>
          <Botao variante={perigo ? 'perigo' : 'primario'} onClick={confirmar} carregando={carregando}>
            {rotulo}
          </Botao>
        </>
      }
    >
      <div className="text-sm text-muted leading-relaxed">{texto}</div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Abas
export function Abas<T extends string>({ abas, atual, mudar }: { abas: { id: T; rotulo: string }[]; atual: T; mudar: (a: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line mb-5 -mx-1 px-1">
      {abas.map((a) => (
        <button
          key={a.id}
          role="tab"
          aria-selected={atual === a.id}
          onClick={() => mudar(a.id)}
          className={cx(
            'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
            atual === a.id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Busca
export function CampoBusca({ valor, mudar, placeholder }: { valor: string; mudar: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[220px]">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <Input value={valor} onChange={(e) => mudar(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  );
}

/** Lista de pares rótulo/valor (telas de detalhe). */
export function Detalhes({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {itens.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-faint">{k}</dt>
          <dd className="mt-0.5 text-sm">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
