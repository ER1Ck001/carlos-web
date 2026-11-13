import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../contexts/AuthContext';
import { cpf, data, dataHora, FORMA_PAGAMENTO, hoje, moeda, placa } from '../lib/format';
import { Badge, Carregando, Detalhes, ErroCarregar, Painel, Tabela, Td, Th } from '../components/ui';

interface Venda {
  id: number;
  data_venda: string;
  valor_venda: number;
  desconto: number;
  valor_liquido: number;
  forma_pagamento: string;
  observacoes: string | null;
  veiculo_id: number;
  marca: string;
  modelo: string;
  ano: number;
  placa: string | null;
  cor: string | null;
  valor_compra: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_cpf: string;
  vendedor_nome: string;
  pagamentos: { id: number; valor: number; data_vencimento: string; data_pagamento: string | null; status: string; descricao: string }[];
  comissao: { percentual: number; valor: number; status: string } | null;
}

export default function VendaDetalhe() {
  const { id } = useParams();
  const { ehAdmin } = useAuth();
  const { dados: v, erro, carregando, recarregar } = useApi(() => api.get<Venda>(`/vendas/${id}`), [id]);

  if (carregando && !v) return <Carregando />;
  if (erro || !v) return <ErroCarregar mensagem={erro ?? 'Venda não encontrada.'} tentar={recarregar} />;

  const recebido = v.pagamentos.filter((p) => p.status === 'PAGO').reduce((s, p) => s + Number(p.valor), 0);
  const hojeIso = hoje();

  return (
    <div>
      <Link to="/vendas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Vendas
      </Link>
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-none">Venda #{v.id}</h1>
        <p className="text-muted mt-2 text-sm">
          {dataHora(v.data_venda)} · vendido por {v.vendedor_nome}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 flex flex-col gap-5">
          <Painel titulo="Veículo e cliente">
            <Detalhes
              itens={[
                [
                  'Veículo',
                  <Link to={`/veiculos/${v.veiculo_id}`} className="hover:text-brand font-medium">
                    {v.marca} {v.modelo} {v.ano}
                  </Link>,
                ],
                ['Placa', placa(v.placa)],
                [
                  'Cliente',
                  <Link to={`/clientes/${v.cliente_id}`} className="hover:text-brand font-medium">
                    {v.cliente_nome}
                  </Link>,
                ],
                ['CPF', cpf(v.cliente_cpf)],
                ['Forma de pagamento', FORMA_PAGAMENTO[v.forma_pagamento]],
                ['Observações', v.observacoes ?? '—'],
              ]}
            />
          </Painel>

          <Painel titulo="Pagamentos" semPadding acao={<span className="text-sm text-muted tabular">{moeda(recebido)} de {moeda(v.valor_liquido)} recebido</span>}>
            <Tabela>
              <thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Vencimento</Th>
                  <Th>Pago em</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {v.pagamentos.map((p) => {
                  const vencido = p.status === 'PENDENTE' && p.data_vencimento < hojeIso;
                  return (
                    <tr key={p.id}>
                      <Td>{p.descricao}</Td>
                      <Td className="whitespace-nowrap">{data(p.data_vencimento)}</Td>
                      <Td className="whitespace-nowrap text-muted">{data(p.data_pagamento)}</Td>
                      <Td>
                        <Badge valor={vencido ? 'VENCIDO' : p.status} rotulo={vencido ? 'Vencido' : p.status === 'PAGO' ? 'Pago' : p.status === 'PENDENTE' ? 'Pendente' : 'Cancelado'} />
                      </Td>
                      <Td className="text-right whitespace-nowrap">{moeda(p.valor)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
            {ehAdmin && v.pagamentos.some((p) => p.status === 'PENDENTE') && (
              <p className="px-4 py-3 text-sm text-muted">
                Para dar baixa em uma parcela, use{' '}
                <Link to={`/financeiro?aba=pagamentos&status=PENDENTE`} className="text-ink underline underline-offset-2 hover:text-brand">
                  Financeiro › Pagamentos
                </Link>
                .
              </p>
            )}
          </Painel>
        </div>

        <div className="flex flex-col gap-5">
          <Painel titulo="Valores">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Preço negociado</dt>
                <dd className="tabular">{moeda(v.valor_venda)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Desconto</dt>
                <dd className="tabular">− {moeda(v.desconto)}</dd>
              </div>
              <div className="flex justify-between items-baseline border-t border-line pt-3">
                <dt className="text-muted">Valor líquido</dt>
                <dd className="font-display text-3xl font-semibold tabular">{moeda(v.valor_liquido)}</dd>
              </div>
              {ehAdmin && (
                <div className="flex justify-between">
                  <dt className="text-muted">Margem sobre a compra</dt>
                  <dd className="tabular text-ok">{moeda(v.valor_liquido - v.valor_compra)}</dd>
                </div>
              )}
            </dl>
          </Painel>
          {v.comissao && (
            <Painel titulo="Comissão do vendedor">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-3xl font-semibold tabular">{moeda(v.comissao.valor)}</p>
                <Badge valor={v.comissao.status} rotulo={v.comissao.status === 'PAGA' ? 'Paga' : 'Pendente'} />
              </div>
              <p className="text-sm text-muted mt-1">
                {Number(v.comissao.percentual).toLocaleString('pt-BR')}% sobre o valor líquido · {v.vendedor_nome}
              </p>
            </Painel>
          )}
        </div>
      </div>
    </div>
  );
}
