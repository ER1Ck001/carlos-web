import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { api, type Paginado } from '../lib/api';
import { useApi, useDebounce } from '../lib/useApi';
import { useAuth } from '../contexts/AuthContext';
import { moeda, numero, placa, STATUS_VEICULO } from '../lib/format';
import VeiculoForm, { type Veiculo } from '../components/VeiculoForm';
import { Badge, Botao, Cabecalho, CampoBusca, Carregando, ErroCarregar, Paginacao, Painel, Select, Tabela, Td, Th, Vazio, cx } from '../components/ui';

export default function Veiculos() {
  const { ehAdmin } = useAuth();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState(params.get('busca') ?? '');
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const buscaD = useDebounce(busca);
  const [form, setForm] = useState<{ aberto: boolean; veiculo: Veiculo | null }>({ aberto: false, veiculo: null });

  const { dados, erro, carregando, recarregar } = useApi(
    () => api.get<Paginado<Veiculo>>('/veiculos', { busca: buscaD, status, page, pageSize: 15 }),
    [buscaD, status, page],
  );

  const mudarParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k !== 'page') p.delete('page');
    setParams(p, { replace: true });
  };

  return (
    <div>
      <Cabecalho
        titulo="Veículos"
        descricao="Todos os veículos do estoque, disponíveis, reservados e vendidos."
        acoes={
          ehAdmin && (
            <Botao icone={<Plus className="size-4" />} onClick={() => setForm({ aberto: true, veiculo: null })}>
              Cadastrar veículo
            </Botao>
          )
        }
      />

      <Painel semPadding>
        <div className="flex flex-col sm:flex-row gap-3 p-4">
          <CampoBusca
            valor={busca}
            mudar={(v) => {
              setBusca(v);
              mudarParam('busca', v);
            }}
            placeholder="Buscar por marca, modelo, placa ou ano"
          />
          <Select value={status} onChange={(e) => mudarParam('status', e.target.value)} className="sm:w-48" aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="DISPONIVEL">Disponíveis</option>
            <option value="RESERVADO">Reservados</option>
            <option value="VENDIDO">Vendidos</option>
          </Select>
        </div>

        {carregando && !dados ? (
          <Carregando />
        ) : erro ? (
          <ErroCarregar mensagem={erro} tentar={recarregar} />
        ) : !dados?.itens.length ? (
          <Vazio
            titulo={buscaD || status ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}
            texto={buscaD || status ? 'Tente outra busca ou limpe o filtro de status.' : 'Cadastre o primeiro veículo para começar a controlar o estoque.'}
          />
        ) : (
          <div className={cx(carregando && 'opacity-60 transition-opacity')}>
            <Tabela>
              <thead>
                <tr>
                  <Th>Veículo</Th>
                  <Th>Placa</Th>
                  <Th className="text-right">Km</Th>
                  <Th className="text-right">Valor de venda</Th>
                  <Th>Local</Th>
                  <Th>Status</Th>
                  {ehAdmin && <Th />}
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((v) => (
                  <tr key={v.id} className="hover:bg-raised/60 cursor-pointer" onClick={() => navegar(`/veiculos/${v.id}`)}>
                    <Td>
                      <Link to={`/veiculos/${v.id}`} className="font-medium hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {v.marca} {v.modelo}
                      </Link>
                      <p className="text-xs text-faint mt-0.5">
                        {v.ano} · {v.cor ?? 'cor não informada'}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">{placa(v.placa)}</Td>
                    <Td className="text-right whitespace-nowrap">{numero(v.quilometragem)}</Td>
                    <Td className="text-right whitespace-nowrap">{moeda(v.valor_venda)}</Td>
                    <Td className="text-muted whitespace-nowrap">{v.status === 'VENDIDO' ? '—' : v.localizacao ?? '—'}</Td>
                    <Td>
                      <Badge valor={v.status} rotulo={STATUS_VEICULO[v.status]} />
                    </Td>
                    {ehAdmin && (
                      <Td className="text-right">
                        <Botao
                          variante="fantasma"
                          tamanho="sm"
                          aria-label={`Editar ${v.marca} ${v.modelo}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({ aberto: true, veiculo: v });
                          }}
                        >
                          <Pencil className="size-4" />
                        </Botao>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <Paginacao page={dados.page} pageSize={dados.pageSize} total={dados.total} mudar={(p) => mudarParam('page', String(p))} />
          </div>
        )}
      </Painel>

      <VeiculoForm aberto={form.aberto} veiculo={form.veiculo} fechar={() => setForm({ aberto: false, veiculo: null })} salvo={() => recarregar()} />
    </div>
  );
}
