import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleAlert, Info, Plus, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../contexts/AuthContext';
import { dataHora, mesCurto, moeda, moedaCompacta, numero, placa, TIPO_MOV } from '../lib/format';
import { Badge, Botao, Cabecalho, Carregando, ErroCarregar, Painel, Vazio, cx } from '../components/ui';

interface Dashboard {
  estoque: { total: number; disponiveis: number; reservados: number; vendidos: number; valor_estoque: number; valor_estoque_venda: number };
  vendas: { quantidade: number; faturamento: number; no_mes: number };
  vendas_por_mes: { mes: string; quantidade: number; valor: number }[];
  ultimas_movimentacoes: {
    id: number;
    tipo_movimentacao: string;
    data_movimentacao: string;
    veiculo_id: number;
    marca: string;
    modelo: string;
    placa: string | null;
    usuario_nome: string;
    observacao: string | null;
  }[];
  alertas: { tipo: string; nivel: 'alto' | 'medio' | 'info'; titulo: string; detalhe: string; link: string }[];
  financeiro: null | {
    receitas_mes: number;
    despesas_mes: number;
    receitas_total: number;
    despesas_total: number;
    saldo_total: number;
    pendentes: { quantidade: number; valor: number; vencidos: number; valor_vencido: number };
    fluxo_mensal: { mes: string; receitas: number; despesas: number }[];
  };
}

const eixo = { fill: '#8a93a3', fontSize: 12, fontFamily: 'Inter' };
const tooltipStyle = {
  contentStyle: { background: '#ffffff', border: '1px solid #e6e9ef', borderRadius: 8, fontFamily: 'Inter', fontSize: 13 },
  labelStyle: { color: '#111a2b', marginBottom: 4 },
  cursor: { fill: '#111a2b0a' },
};

/** Indicador grande, no estilo de um painel de instrumentos. */
function Indicador({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className="px-5 py-5 min-w-0">
      <p className="text-[13px] text-muted">{rotulo}</p>
      <p className={cx('font-display font-semibold tabular leading-none mt-2 text-[30px] sm:text-[40px] truncate', destaque && 'text-brand')}>{valor}</p>
      {detalhe && <p className="text-xs text-faint mt-2 truncate">{detalhe}</p>}
    </div>
  );
}

const ICONE_ALERTA = { alto: CircleAlert, medio: TriangleAlert, info: Info };
const COR_ALERTA = { alto: 'text-brand', medio: 'text-warn', info: 'text-info' };

export default function Dashboard() {
  const { usuario, ehAdmin } = useAuth();
  const { dados, erro, carregando, recarregar } = useApi(() => api.get<Dashboard>('/relatorios/dashboard'), []);

  if (carregando && !dados) return <Carregando />;
  if (erro || !dados) return <ErroCarregar mensagem={erro ?? 'Sem dados.'} tentar={recarregar} />;

  const { estoque, vendas, financeiro } = dados;
  const ocupacao = estoque.total ? Math.round(((estoque.disponiveis + estoque.reservados) / estoque.total) * 100) : 0;

  return (
    <div>
      <Cabecalho
        titulo={`Olá, ${usuario?.nome.split(' ')[0]}`}
        descricao={ehAdmin ? 'Situação da concessionária hoje.' : 'Situação do estoque e das suas vendas.'}
        acoes={
          <Link to="/vendas/nova">
            <Botao icone={<Plus className="size-4" />}>Registrar venda</Botao>
          </Link>
        }
      />

      {/* faixa de indicadores */}
      <section className="rounded-xl bg-surface border border-line grid grid-cols-2 md:grid-cols-4 divide-line [&>*]:border-line max-md:[&>*:nth-child(-n+2)]:border-b md:divide-x max-md:[&>*:nth-child(odd)]:border-r">
        <Indicador rotulo="Veículos cadastrados" valor={numero(estoque.total)} detalhe={`${ocupacao}% ainda no pátio`} />
        <Indicador rotulo="Disponíveis" valor={numero(estoque.disponiveis)} detalhe={`${estoque.reservados} reservado(s)`} destaque />
        <Indicador rotulo="Vendidos" valor={numero(estoque.vendidos)} detalhe={`${vendas.no_mes} venda(s) neste mês`} />
        <Indicador rotulo="Valor do estoque" valor={moedaCompacta(estoque.valor_estoque)} detalhe={`Custo de compra · venda prevista ${moedaCompacta(estoque.valor_estoque_venda)}`} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
        <Painel
          className="xl:col-span-2"
          titulo="Vendas por mês"
          acao={
            <span className="text-sm text-muted tabular">
              {vendas.quantidade} {ehAdmin ? 'vendas' : 'vendas suas'} · {moeda(vendas.faturamento)}
            </span>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.vendas_por_mes} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e6e9ef" />
                <XAxis dataKey="mes" tickFormatter={mesCurto} tick={eixo} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => moedaCompacta(v)} tick={eixo} axisLine={false} tickLine={false} width={76} />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(l) => mesCurto(String(l))}
                  formatter={(v, _n, item) => [`${moeda(Number(v))} (${item.payload.quantidade} venda${item.payload.quantidade === 1 ? '' : 's'})`, 'Faturamento']}
                />
                <Bar animationDuration={500} dataKey="valor" fill="#d33632" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Painel>

        <Painel titulo="Alertas">
          {dados.alertas.length === 0 ? (
            <p className="text-sm text-muted py-6">Nenhum alerta no momento.</p>
          ) : (
            <ul className="flex flex-col gap-1 -mx-2">
              {dados.alertas.map((a, i) => {
                const Icone = ICONE_ALERTA[a.nivel];
                return (
                  <li key={i}>
                    <Link to={a.link} className="flex gap-3 rounded-lg px-2 py-2.5 hover:bg-raised">
                      <Icone className={cx('size-[18px] shrink-0 mt-0.5', COR_ALERTA[a.nivel])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{a.titulo}</p>
                        <p className="text-xs text-muted mt-0.5">{a.detalhe}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
      </div>

      {financeiro && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
          <Painel titulo="Receitas e despesas" acao={<Link to="/financeiro" className="text-sm text-muted hover:text-ink">Abrir financeiro</Link>} className="xl:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-faint">Receitas no mês</p>
                <p className="font-display text-2xl font-semibold tabular text-ok">{moeda(financeiro.receitas_mes)}</p>
              </div>
              <div>
                <p className="text-xs text-faint">Despesas no mês</p>
                <p className="font-display text-2xl font-semibold tabular">{moeda(financeiro.despesas_mes)}</p>
              </div>
              <div>
                <p className="text-xs text-faint">A receber</p>
                <p className="font-display text-2xl font-semibold tabular text-warn">{moeda(financeiro.pendentes.valor)}</p>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeiro.fluxo_mensal} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e6e9ef" />
                  <XAxis dataKey="mes" tickFormatter={mesCurto} tick={eixo} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => moedaCompacta(v)} tick={eixo} axisLine={false} tickLine={false} width={76} />
                  <Tooltip {...tooltipStyle} labelFormatter={(l) => mesCurto(String(l))} formatter={(v, n) => [moeda(Number(v)), n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: '#525d6f' }} />
                  <Bar animationDuration={500} dataKey="receitas" name="Receitas" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar animationDuration={500} dataKey="despesas" name="Despesas" fill="#d33632" radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Painel>

          <Painel titulo="Saldo do caixa">
            <p className={cx('font-display text-[40px] font-semibold tabular leading-none mt-1', financeiro.saldo_total < 0 && 'text-brand')}>
              {moeda(financeiro.saldo_total)}
            </p>
            <dl className="mt-6 flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Entradas acumuladas</dt>
                <dd className="tabular">{moeda(financeiro.receitas_total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Saídas acumuladas</dt>
                <dd className="tabular">{moeda(financeiro.despesas_total)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3">
                <dt className="text-muted">Recebimentos vencidos</dt>
                <dd className={cx('tabular', financeiro.pendentes.vencidos > 0 && 'text-brand')}>
                  {financeiro.pendentes.vencidos} · {moeda(financeiro.pendentes.valor_vencido)}
                </dd>
              </div>
            </dl>
          </Painel>
        </div>
      )}

      <Painel titulo="Últimas movimentações" className="mt-5" semPadding acao={<Link to="/estoque" className="text-sm text-muted hover:text-ink">Ver todas</Link>}>
        {dados.ultimas_movimentacoes.length === 0 ? (
          <Vazio titulo="Nenhuma movimentação ainda" />
        ) : (
          <ul className="divide-y divide-line/70">
            {dados.ultimas_movimentacoes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <Badge valor={m.tipo_movimentacao} rotulo={TIPO_MOV[m.tipo_movimentacao]} />
                <Link to={`/veiculos/${m.veiculo_id}`} className="font-medium hover:text-brand min-w-0 truncate">
                  {m.marca} {m.modelo}
                </Link>
                <span className="text-xs text-faint">{placa(m.placa)}</span>
                <span className="text-xs text-muted sm:ml-auto tabular">
                  {dataHora(m.data_movimentacao)} · {m.usuario_nome}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  );
}
