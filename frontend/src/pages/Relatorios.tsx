import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { FORMA_PAGAMENTO, inicioDoMes, hoje, moeda, moedaCompacta, placa, STATUS_VEICULO } from '../lib/format';
import { Badge, Botao, Cabecalho, Carregando, ErroCarregar, Painel, Tabela, Td, Th, Vazio, cx } from '../components/ui';
import { FiltroPeriodo, type Periodo } from './financeiro/comum';

interface RelVendas {
  quantidade: number;
  faturamento: number;
  descontos: number;
  custo: number;
  margem_bruta: number;
  comissoes: number;
  ticket_medio: number;
  por_vendedor: { id: number; nome: string; quantidade: number; faturamento: number; margem: number }[];
  por_marca: { marca: string; quantidade: number; faturamento: number }[];
  por_forma_pagamento: { forma_pagamento: string; quantidade: number; faturamento: number }[];
}
interface RelEstoque {
  itens: { id: number; marca: string; modelo: string; ano: number; placa: string | null; status: string; valor_compra: number; valor_venda: number; margem_prevista: number; dias_estoque: number }[];
  por_marca: { marca: string; quantidade: number; valor_compra: number }[];
}

const ATALHOS: { rotulo: string; periodo: () => Periodo }[] = [
  { rotulo: 'Este mês', periodo: () => ({ inicio: inicioDoMes(), fim: hoje() }) },
  {
    rotulo: 'Últimos 90 dias',
    periodo: () => {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return { inicio: d.toLocaleDateString('sv-SE'), fim: hoje() };
    },
  },
  { rotulo: 'Este ano', periodo: () => ({ inicio: `${hoje().slice(0, 4)}-01-01`, fim: hoje() }) },
  { rotulo: 'Tudo', periodo: () => ({ inicio: '', fim: '' }) },
];

function Kpi({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[13px] text-muted">{rotulo}</p>
      <p className={cx('font-display text-[28px] font-semibold tabular leading-tight mt-1', cor)}>{valor}</p>
    </div>
  );
}

export default function Relatorios() {
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: '', fim: '' });
  const vendas = useApi(() => api.get<RelVendas>('/relatorios/vendas', { ...periodo }), [periodo.inicio, periodo.fim]);
  const estoque = useApi(() => api.get<RelEstoque>('/relatorios/estoque'), []);
  const v = vendas.dados;

  return (
    <div>
      <Cabecalho titulo="Relatórios" descricao="Desempenho de vendas por período e situação atual do estoque." acoes={<FiltroPeriodo periodo={periodo} mudar={setPeriodo} />} />
      <div className="flex flex-wrap gap-2 -mt-2 mb-5">
        {ATALHOS.map((a) => (
          <Botao key={a.rotulo} tamanho="sm" variante="secundario" onClick={() => setPeriodo(a.periodo())}>
            {a.rotulo}
          </Botao>
        ))}
      </div>

      {vendas.carregando && !v ? (
        <Carregando />
      ) : vendas.erro || !v ? (
        <ErroCarregar mensagem={vendas.erro ?? 'Sem dados'} tentar={vendas.recarregar} />
      ) : (
        <div className={cx('flex flex-col gap-5', vendas.carregando && 'opacity-60')}>
          <section className="rounded-xl bg-surface border border-line grid grid-cols-2 lg:grid-cols-4 divide-line [&>*]:border-line max-lg:[&>*:nth-child(-n+2)]:border-b lg:divide-x max-lg:[&>*:nth-child(odd)]:border-r">
            <Kpi rotulo="Vendas no período" valor={String(v.quantidade)} />
            <Kpi rotulo="Faturamento líquido" valor={moeda(v.faturamento)} />
            <Kpi rotulo="Margem bruta" valor={moeda(v.margem_bruta)} cor="text-ok" />
            <Kpi rotulo="Ticket médio" valor={moeda(v.ticket_medio)} />
          </section>
          <p className="text-sm text-muted -mt-2">
            Descontos concedidos: <span className="text-ink tabular">{moeda(v.descontos)}</span> · Custo dos veículos vendidos:{' '}
            <span className="text-ink tabular">{moeda(v.custo)}</span> · Comissões geradas: <span className="text-ink tabular">{moeda(v.comissoes)}</span>
          </p>

          {v.quantidade === 0 ? (
            <Painel>
              <Vazio titulo="Nenhuma venda no período" texto="Escolha outro período para ver o desempenho." />
            </Painel>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Painel titulo="Por vendedor" semPadding>
                <Tabela>
                  <thead>
                    <tr>
                      <Th>Vendedor</Th>
                      <Th className="text-right">Vendas</Th>
                      <Th className="text-right">Faturamento</Th>
                      <Th className="text-right">Margem</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.por_vendedor.map((x) => (
                      <tr key={x.id}>
                        <Td className="font-medium">{x.nome}</Td>
                        <Td className="text-right">{x.quantidade}</Td>
                        <Td className="text-right whitespace-nowrap">{moeda(x.faturamento)}</Td>
                        <Td className="text-right whitespace-nowrap text-ok">{moeda(x.margem)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
                <div className="h-4" />
                <Tabela>
                  <thead>
                    <tr>
                      <Th>Forma de pagamento</Th>
                      <Th className="text-right">Vendas</Th>
                      <Th className="text-right">Faturamento</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.por_forma_pagamento.map((x) => (
                      <tr key={x.forma_pagamento}>
                        <Td>{FORMA_PAGAMENTO[x.forma_pagamento]}</Td>
                        <Td className="text-right">{x.quantidade}</Td>
                        <Td className="text-right whitespace-nowrap">{moeda(x.faturamento)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </Painel>

              <Painel titulo="Faturamento por marca">
                <div style={{ height: Math.max(180, v.por_marca.length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={v.por_marca} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke="#2a2a30" />
                      <XAxis type="number" tickFormatter={(x) => moedaCompacta(x)} tick={{ fill: '#6b6b74', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="marca" tick={{ fill: '#f2f2f3', fontSize: 13 }} axisLine={false} tickLine={false} width={96} />
                      <Tooltip
                        contentStyle={{ background: '#1f1f23', border: '1px solid #3a3a42', borderRadius: 8, fontSize: 13 }}
                        labelStyle={{ color: '#f2f2f3' }}
                        cursor={{ fill: '#ffffff08' }}
                        formatter={(x, _n, item) => [`${moeda(Number(x))} (${item.payload.quantidade} venda${item.payload.quantidade === 1 ? '' : 's'})`, 'Faturamento']}
                      />
                      <Bar animationDuration={500} dataKey="faturamento" fill="#e11d2e" radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Painel>
            </div>
          )}
        </div>
      )}

      <h2 className="font-display text-2xl font-semibold tracking-wide mt-10 mb-4">Estoque atual</h2>
      {estoque.carregando && !estoque.dados ? (
        <Carregando />
      ) : estoque.erro || !estoque.dados ? (
        <ErroCarregar mensagem={estoque.erro ?? 'Sem dados'} tentar={estoque.recarregar} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Painel titulo="Veículos no pátio, do mais antigo ao mais recente" semPadding className="xl:col-span-2">
            <Tabela>
              <thead>
                <tr>
                  <Th>Veículo</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Dias</Th>
                  <Th className="text-right">Compra</Th>
                  <Th className="text-right">Margem prevista</Th>
                </tr>
              </thead>
              <tbody>
                {estoque.dados.itens.map((x) => (
                  <tr key={x.id} className="hover:bg-raised/60">
                    <Td>
                      <Link to={`/veiculos/${x.id}`} className="font-medium hover:text-brand">
                        {x.marca} {x.modelo}
                      </Link>
                      <p className="text-xs text-faint">
                        {x.ano} · {placa(x.placa)}
                      </p>
                    </Td>
                    <Td>
                      <Badge valor={x.status} rotulo={STATUS_VEICULO[x.status]} />
                    </Td>
                    <Td className={cx('text-right', x.dias_estoque >= 90 && 'text-warn')}>{x.dias_estoque}</Td>
                    <Td className="text-right whitespace-nowrap">{moeda(x.valor_compra)}</Td>
                    <Td className="text-right whitespace-nowrap text-ok">{moeda(x.margem_prevista)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Painel>
          <Painel titulo="Estoque por marca">
            <ul className="flex flex-col divide-y divide-line">
              {estoque.dados.por_marca.map((m) => (
                <li key={m.marca} className="flex justify-between py-2.5 text-sm">
                  <span>
                    {m.marca} <span className="text-faint">· {m.quantidade}</span>
                  </span>
                  <span className="tabular text-muted">{moeda(m.valor_compra)}</span>
                </li>
              ))}
            </ul>
          </Painel>
        </div>
      )}
    </div>
  );
}
