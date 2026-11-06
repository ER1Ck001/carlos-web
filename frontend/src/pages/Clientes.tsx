import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { api, type Paginado } from '../lib/api';
import { useApi, useDebounce } from '../lib/useApi';
import { cpf, data, mascaraTelefone } from '../lib/format';
import ClienteForm, { type Cliente } from '../components/ClienteForm';
import { Botao, Cabecalho, CampoBusca, Carregando, ErroCarregar, Paginacao, Painel, Tabela, Td, Th, Vazio, cx } from '../components/ui';

export default function Clientes() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ aberto: boolean; cliente: Cliente | null }>({ aberto: false, cliente: null });
  const buscaD = useDebounce(busca);

  const { dados, erro, carregando, recarregar } = useApi(
    () => api.get<Paginado<Cliente>>('/clientes', { busca: buscaD, page, pageSize: 15 }),
    [buscaD, page],
  );

  return (
    <div>
      <Cabecalho
        titulo="Clientes"
        descricao="Cadastro de clientes e histórico de compras."
        acoes={
          <Botao icone={<Plus className="size-4" />} onClick={() => setForm({ aberto: true, cliente: null })}>
            Cadastrar cliente
          </Botao>
        }
      />

      <Painel semPadding>
        <div className="p-4">
          <CampoBusca
            valor={busca}
            mudar={(v) => {
              setBusca(v);
              setPage(1);
            }}
            placeholder="Buscar por nome, CPF ou telefone"
          />
        </div>

        {carregando && !dados ? (
          <Carregando />
        ) : erro ? (
          <ErroCarregar mensagem={erro} tentar={recarregar} />
        ) : !dados?.itens.length ? (
          <Vazio
            titulo={buscaD ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            texto={buscaD ? 'Confira o nome, CPF ou telefone digitado.' : 'Cadastre um cliente para registrar vendas.'}
          />
        ) : (
          <div className={cx(carregando && 'opacity-60')}>
            <Tabela>
              <thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>CPF</Th>
                  <Th>Telefone</Th>
                  <Th className="text-right">Compras</Th>
                  <Th>Última compra</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((c) => (
                  <tr key={c.id} className="hover:bg-raised/60 cursor-pointer" onClick={() => navegar(`/clientes/${c.id}`)}>
                    <Td>
                      <Link to={`/clientes/${c.id}`} className="font-medium hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {c.nome}
                      </Link>
                      {c.email && <p className="text-xs text-faint">{c.email}</p>}
                    </Td>
                    <Td className="whitespace-nowrap">{cpf(c.cpf)}</Td>
                    <Td className="whitespace-nowrap">{c.telefone ? mascaraTelefone(c.telefone) : '—'}</Td>
                    <Td className="text-right">{c.total_compras}</Td>
                    <Td className="text-muted whitespace-nowrap">{c.ultima_compra ? data(c.ultima_compra) : '—'}</Td>
                    <Td className="text-right">
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        aria-label={`Editar ${c.nome}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm({ aberto: true, cliente: c });
                        }}
                      >
                        <Pencil className="size-4" />
                      </Botao>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <Paginacao page={dados.page} pageSize={dados.pageSize} total={dados.total} mudar={setPage} />
          </div>
        )}
      </Painel>

      <ClienteForm aberto={form.aberto} cliente={form.cliente} fechar={() => setForm({ aberto: false, cliente: null })} salvo={() => recarregar()} />
    </div>
  );
}
