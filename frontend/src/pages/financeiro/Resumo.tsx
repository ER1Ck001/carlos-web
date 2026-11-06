import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { CATEGORIA_DESPESA, mesCurto, moeda, moedaCompacta } from '../../lib/format';
import { Carregando, ErroCarregar, Painel, Vazio, cx } from '../../components/ui';
import type { Periodo } from './comum';

interface Resumo {
  entradas: number;
  saidas: number;
  saldo: number;
  a_receber: { total: number; vencido: number; quantidade: number };
  a_pagar: { despesas: number; despesas_vencidas: number; comissoes: number };
  despesas_por_categoria: { categoria: string; total: number }[];
  mensal: { mes: string; entradas: number; saidas: number }[];
}

const eixo = { fill: '#6b6b74', fontSize: 12, fontFamily: 'Barlow' };

function Numero({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: number; cor?: string; detalhe?: string }) {
  return (
    <div className="rounded-xl bg-surface border border-line px-5 py-4">
      <p className="text-[13px] text-muted">{rotulo}</p>
      <p className={cx('font-display text-[30px] font-semibold tabular leading-tight mt-1', cor)}>{moeda(valor)}</p>
      {detalhe && <p className="text-xs text-faint mt-1">{detalhe}</p>}
    </div>
  );
}

export default function Resumo({ periodo }: { periodo: Periodo }) {
  const { dados: r, erro, carregando, recarregar } = useApi(() => api.get<Resumo>('/financeiro/resumo', { ...periodo }), [periodo.inicio, periodo.fim]);

  if (carregando && !r) return <Carregando />;
  if (erro || !r) return <ErroCarregar mensagem={erro ?? 'Sem dados'} tentar={recarregar} />;

  const maxCat = Math.max(1, ...r.despesas_por_categoria.map((c) => c.total));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Numero rotulo="Entradas no caixa" valor={r.entradas} cor="text-ok" detalhe={periodo.inicio || periodo.fim ? 'No período filtrado' : 'Todo o período'} />
        <Numero rotulo="Saídas do caixa" valor={r.saidas} detalhe="Despesas e comissões pagas" />
        <Numero rotulo="Saldo" valor={r.saldo} cor={r.saldo < 0 ? 'text-brand' : undefined} detalhe="Entradas menos saídas" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Numero rotulo="A receber de vendas" valor={r.a_receber.total} cor="text-warn" detalhe={`${r.a_receber.quantidade} parcela(s) · ${moeda(r.a_receber.vencido)} vencido`} />
        <Numero rotulo="Despesas a pagar" valor={r.a_pagar.despesas} detalhe={`${moeda(r.a_pagar.despesas_vencidas)} vencido`} />
        <Numero rotulo="Comissões a pagar" valor={r.a_pagar.comissoes} detalhe="Comissões pendentes dos vendedores" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Painel titulo="Entradas e saídas por mês" className="xl:col-span-2">
          {r.mensal.length === 0 ? (
            <Vazio titulo="Sem movimentações no período" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.mensal} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#2a2a30" />
                  <XAxis dataKey="mes" tickFormatter={mesCurto} tick={eixo} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => moedaCompacta(v)} tick={eixo} axisLine={false} tickLine={false} width={76} />
                  <Tooltip
                    contentStyle={{ background: '#1f1f23', border: '1px solid #3a3a42', borderRadius: 8, fontFamily: 'Barlow', fontSize: 13 }}
                    labelStyle={{ color: '#f2f2f3' }}
                    cursor={{ fill: '#ffffff08' }}
                    labelFormatter={(l) => mesCurto(String(l))}
                    formatter={(v, n) => [moeda(Number(v)), n]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: '#9a9aa3' }} />
                  <Bar animationDuration={500} dataKey="entradas" name="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  <Bar animationDuration={500} dataKey="saidas" name="Saídas" fill="#e11d2e" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Painel>
        <Painel titulo="Despesas por categoria">
          {r.despesas_por_categoria.length === 0 ? (
            <p className="text-sm text-muted py-6">Nenhuma despesa no período.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {r.despesas_por_categoria.map((c) => (
                <li key={c.categoria}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>{CATEGORIA_DESPESA[c.categoria] ?? c.categoria}</span>
                    <span className="tabular text-muted">{moeda(c.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-raised overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </div>
  );
}
