import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Paginado } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useEnvio } from '../../lib/useEnvio';
import { data, FORMA_PAGAMENTO, moeda } from '../../lib/format';
import { Badge, Botao, Carregando, ErroCarregar, Paginacao, Painel, Select, Tabela, Td, Th, Vazio, cx } from '../../components/ui';
import { ModalBaixa, type Periodo } from './comum';

interface Pagamento {
  id: number;
  venda_id: number;
  valor: number;
  forma_pagamento: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  descricao: string;
  vencido: boolean;
  venda: { cliente_nome: string; veiculo: string } | null;
}

export default function Pagamentos({ periodo, statusInicial }: { periodo: Periodo; statusInicial: string }) {
  const [status, setStatus] = useState(statusInicial);
  const [page, setPage] = useState(1);
  const [baixa, setBaixa] = useState<Pagamento | null>(null);
  const envio = useEnvio();

  const { dados, erro, carregando, recarregar } = useApi(
    () => api.get<Paginado<Pagamento> & { soma: number }>('/financeiro/pagamentos', { status, ...periodo, page, pageSize: 15 }),
    [status, periodo.inicio, periodo.fim, page],
  );

  return (
    <Painel semPadding>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="sm:w-56"
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="VENCIDO">Vencidos</option>
          <option value="PAGO">Recebidos</option>
        </Select>
        {dados && (
          <p className="text-sm text-muted tabular">
            {dados.total} parcela(s) · <span className="text-ink">{moeda(dados.soma)}</span>
          </p>
        )}
      </div>
      <p className="px-4 -mt-2 pb-3 text-xs text-faint">O período filtra pela data de vencimento.</p>

      {carregando && !dados ? (
        <Carregando />
      ) : erro ? (
        <ErroCarregar mensagem={erro} tentar={recarregar} />
      ) : !dados?.itens.length ? (
        <Vazio titulo="Nenhum pagamento encontrado" />
      ) : (
        <div className={cx(carregando && 'opacity-60')}>
          <Tabela>
            <thead>
              <tr>
                <Th>Venda</Th>
                <Th>Descrição</Th>
                <Th>Forma</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
                <Th className="text-right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((p) => (
                <tr key={p.id} className="hover:bg-raised/60">
                  <Td className="whitespace-nowrap">
                    <Link to={`/vendas/${p.venda_id}`} className="font-medium hover:text-brand">
                      #{p.venda_id}
                    </Link>
                    <p className="text-xs text-faint">{p.venda?.cliente_nome}</p>
                  </Td>
                  <Td>
                    {p.descricao}
                    <p className="text-xs text-faint">{p.venda?.veiculo}</p>
                  </Td>
                  <Td className="whitespace-nowrap">{FORMA_PAGAMENTO[p.forma_pagamento]}</Td>
                  <Td className="whitespace-nowrap">
                    {data(p.data_vencimento)}
                    {p.data_pagamento && <p className="text-xs text-faint">pago em {data(p.data_pagamento)}</p>}
                  </Td>
                  <Td>
                    <Badge valor={p.vencido ? 'VENCIDO' : p.status} rotulo={p.vencido ? 'Vencido' : p.status === 'PAGO' ? 'Recebido' : p.status === 'PENDENTE' ? 'Pendente' : 'Cancelado'} />
                  </Td>
                  <Td className="text-right whitespace-nowrap">{moeda(p.valor)}</Td>
                  <Td className="text-right">
                    {p.status === 'PENDENTE' && (
                      <Botao tamanho="sm" variante="secundario" onClick={() => setBaixa(p)}>
                        Registrar recebimento
                      </Botao>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          <Paginacao page={dados.page} pageSize={dados.pageSize} total={dados.total} mudar={setPage} />
        </div>
      )}

      <ModalBaixa
        aberto={!!baixa}
        titulo="Registrar recebimento"
        rotulo="Registrar recebimento"
        descricao={
          baixa && (
            <>
              {baixa.descricao} · <span className="text-ink">{moeda(baixa.valor)}</span>. O valor entra no fluxo de caixa na data informada.
            </>
          )
        }
        carregando={envio.enviando}
        fechar={() => setBaixa(null)}
        confirmar={async (d) => {
          const r = await envio.enviar(() => api.patch(`/financeiro/pagamentos/${baixa!.id}/pagar`, { data_pagamento: d }), 'Recebimento registrado.');
          if (r) {
            setBaixa(null);
            recarregar();
          }
        }}
      />
    </Painel>
  );
}
