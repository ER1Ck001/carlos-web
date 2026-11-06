import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, type Paginado } from '../lib/api';
import { useApi, useDebounce } from '../lib/useApi';
import { dataHora, placa, TIPO_MOV } from '../lib/format';
import MovimentacaoForm from '../components/MovimentacaoForm';
import { Badge, Botao, Cabecalho, CampoBusca, Carregando, ErroCarregar, Input, Paginacao, Painel, Select, Tabela, Td, Th, Vazio, cx } from '../components/ui';

interface Mov {
  id: number;
  veiculo_id: number;
  tipo_movimentacao: string;
  localizacao: string | null;
  observacao: string | null;
  data_movimentacao: string;
  marca: string;
  modelo: string;
  ano: number;
  placa: string | null;
  usuario_nome: string;
}

export default function Estoque() {
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(false);
  const buscaD = useDebounce(busca);

  const { dados, erro, carregando, recarregar } = useApi(
    () => api.get<Paginado<Mov>>('/estoque', { busca: buscaD, tipo, inicio, fim, page, pageSize: 20 }),
    [buscaD, tipo, inicio, fim, page],
  );
  const filtrar = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  return (
    <div>
      <Cabecalho
        titulo="Movimentações de estoque"
        descricao="Entradas, saídas, reservas e transferências de todos os veículos."
        acoes={
          <Botao icone={<Plus className="size-4" />} onClick={() => setForm(true)}>
            Registrar movimentação
          </Botao>
        }
      />

      <Painel semPadding>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_200px_160px_160px] gap-3 p-4">
          <CampoBusca valor={busca} mudar={filtrar(setBusca)} placeholder="Buscar veículo ou placa" />
          <Select value={tipo} onChange={(e) => filtrar(setTipo)(e.target.value)} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_MOV).map(([k, r]) => (
              <option key={k} value={k}>
                {r}
              </option>
            ))}
          </Select>
          <Input type="date" value={inicio} onChange={(e) => filtrar(setInicio)(e.target.value)} aria-label="Data inicial" />
          <Input type="date" value={fim} onChange={(e) => filtrar(setFim)(e.target.value)} aria-label="Data final" />
        </div>

        {carregando && !dados ? (
          <Carregando />
        ) : erro ? (
          <ErroCarregar mensagem={erro} tentar={recarregar} />
        ) : !dados?.itens.length ? (
          <Vazio titulo="Nenhuma movimentação encontrada" texto="Ajuste os filtros de tipo ou período." />
        ) : (
          <div className={cx(carregando && 'opacity-60')}>
            <Tabela>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Tipo</Th>
                  <Th>Veículo</Th>
                  <Th>Local</Th>
                  <Th>Observação</Th>
                  <Th>Responsável</Th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((m) => (
                  <tr key={m.id} className="hover:bg-raised/60">
                    <Td className="whitespace-nowrap text-muted">{dataHora(m.data_movimentacao)}</Td>
                    <Td>
                      <Badge valor={m.tipo_movimentacao} rotulo={TIPO_MOV[m.tipo_movimentacao]} />
                    </Td>
                    <Td>
                      <Link to={`/veiculos/${m.veiculo_id}`} className="font-medium hover:text-brand">
                        {m.marca} {m.modelo}
                      </Link>
                      <p className="text-xs text-faint">{placa(m.placa)}</p>
                    </Td>
                    <Td className="text-muted">{m.localizacao ?? '—'}</Td>
                    <Td className="text-muted max-w-xs">{m.observacao ?? '—'}</Td>
                    <Td className="whitespace-nowrap">{m.usuario_nome}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <Paginacao page={dados.page} pageSize={dados.pageSize} total={dados.total} mudar={setPage} />
          </div>
        )}
      </Painel>

      <MovimentacaoForm aberto={form} fechar={() => setForm(false)} salvo={recarregar} />
    </div>
  );
}
