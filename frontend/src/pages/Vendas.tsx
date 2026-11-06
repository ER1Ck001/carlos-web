import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, type Paginado } from '../lib/api';
import { useApi, useDebounce } from '../lib/useApi';
import { useAuth } from '../contexts/AuthContext';
import { data, FORMA_PAGAMENTO, moeda, placa } from '../lib/format';
import { Botao, Cabecalho, CampoBusca, Carregando, ErroCarregar, Input, Paginacao, Painel, Select, Tabela, Td, Th, Vazio, cx } from '../components/ui';

export interface VendaLista {
  id: number;
  data_venda: string;
  valor_venda: number;
  desconto: number;
  valor_liquido: number;
  forma_pagamento: string;
  veiculo_id: number;
  marca: string;
  modelo: string;
  ano: number;
  placa: string | null;
  cliente_id: number;
  cliente_nome: string;
  vendedor_nome: string;
  financeiro: { recebido: number; pendente: number; parcelas: number };
}

export default function Vendas() {
  const { ehAdmin } = useAuth();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [forma, setForma] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [page, setPage] = useState(1);
  const buscaD = useDebounce(busca);

  const { dados, erro, carregando, recarregar } = useApi(
    () =>
      api.get<Paginado<VendaLista> & { soma: number }>('/vendas', {
        busca: buscaD,
        forma_pagamento: forma,
        inicio,
        fim,
        page,
        pageSize: 15,
      }),
    [buscaD, forma, inicio, fim, page],
  );
  const filtrar = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  return (
    <div>
      <Cabecalho
        titulo="Vendas"
        descricao={ehAdmin ? 'Histórico de todas as vendas da concessionária.' : 'Histórico das suas vendas.'}
        acoes={
          <Link to="/vendas/nova">
            <Botao icone={<Plus className="size-4" />}>Registrar venda</Botao>
          </Link>
        }
      />

      <Painel semPadding>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_200px_160px_160px] gap-3 p-4">
          <CampoBusca valor={busca} mudar={filtrar(setBusca)} placeholder="Buscar cliente, veículo ou placa" />
          <Select value={forma} onChange={(e) => filtrar(setForma)(e.target.value)} aria-label="Forma de pagamento">
            <option value="">Todas as formas</option>
            {Object.entries(FORMA_PAGAMENTO).map(([k, r]) => (
              <option key={k} value={k}>
                {r}
              </option>
            ))}
          </Select>
          <Input type="date" value={inicio} onChange={(e) => filtrar(setInicio)(e.target.value)} aria-label="Data inicial" />
          <Input type="date" value={fim} onChange={(e) => filtrar(setFim)(e.target.value)} aria-label="Data final" />
        </div>

        {dados && dados.total > 0 && (
          <p className="px-4 pb-3 text-sm text-muted tabular">
            {dados.total} venda(s) · total líquido <span className="text-ink font-medium">{moeda(dados.soma)}</span>
          </p>
        )}

        {carregando && !dados ? (
          <Carregando />
        ) : erro ? (
          <ErroCarregar mensagem={erro} tentar={recarregar} />
        ) : !dados?.itens.length ? (
          <Vazio titulo="Nenhuma venda encontrada" texto="Ajuste os filtros ou registre uma nova venda." />
        ) : (
          <div className={cx(carregando && 'opacity-60')}>
            <Tabela>
              <thead>
                <tr>
                  <Th>Venda</Th>
                  <Th>Veículo</Th>
                  <Th>Cliente</Th>
                  {ehAdmin && <Th>Vendedor</Th>}
                  <Th>Pagamento</Th>
                  <Th className="text-right">Valor líquido</Th>
                  <Th className="text-right">Recebido</Th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((v) => {
                  const quitado = v.financeiro.pendente === 0;
                  return (
                    <tr key={v.id} className="hover:bg-raised/60 cursor-pointer" onClick={() => navegar(`/vendas/${v.id}`)}>
                      <Td className="whitespace-nowrap">
                        <Link to={`/vendas/${v.id}`} className="font-medium hover:text-brand" onClick={(e) => e.stopPropagation()}>
                          #{v.id}
                        </Link>
                        <p className="text-xs text-faint">{data(v.data_venda)}</p>
                      </Td>
                      <Td>
                        <p className="font-medium">
                          {v.marca} {v.modelo}
                        </p>
                        <p className="text-xs text-faint">
                          {v.ano} · {placa(v.placa)}
                        </p>
                      </Td>
                      <Td>{v.cliente_nome}</Td>
                      {ehAdmin && <Td className="whitespace-nowrap">{v.vendedor_nome}</Td>}
                      <Td className="whitespace-nowrap">{FORMA_PAGAMENTO[v.forma_pagamento]}</Td>
                      <Td className="text-right whitespace-nowrap">{moeda(v.valor_liquido)}</Td>
                      <Td className="text-right whitespace-nowrap">
                        <span className={quitado ? 'text-ok' : 'text-warn'}>{quitado ? 'Quitada' : `${moeda(v.financeiro.pendente)} a receber`}</span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
            <Paginacao page={dados.page} pageSize={dados.pageSize} total={dados.total} mudar={setPage} />
          </div>
        )}
      </Painel>
    </div>
  );
}
