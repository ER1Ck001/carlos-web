import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Handshake, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useEnvio } from '../lib/useEnvio';
import { cpf, data, FORMA_PAGAMENTO, mascaraTelefone, moeda, placa } from '../lib/format';
import ClienteForm, { type Cliente } from '../components/ClienteForm';
import { Botao, Carregando, Confirmar, Detalhes, ErroCarregar, Painel, Tabela, Td, Th, Vazio } from '../components/ui';

interface Detalhe extends Cliente {
  compras: {
    id: number;
    data_venda: string;
    valor_liquido: number;
    forma_pagamento: string;
    veiculo_id: number;
    marca: string;
    modelo: string;
    ano: number;
    placa: string | null;
    vendedor_nome: string;
  }[];
}

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { ehAdmin } = useAuth();
  const { dados: c, erro, carregando, recarregar } = useApi(() => api.get<Detalhe>(`/clientes/${id}`), [id]);
  const [editar, setEditar] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const exclusao = useEnvio();

  if (carregando && !c) return <Carregando />;
  if (erro || !c) return <ErroCarregar mensagem={erro ?? 'Cliente não encontrado.'} tentar={recarregar} />;

  const totalGasto = c.compras.reduce((s, x) => s + Number(x.valor_liquido), 0);

  return (
    <div>
      <Link to="/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-none">{c.nome}</h1>
          <p className="text-muted mt-2 text-sm">
            Cliente desde {data(c.data_cadastro)} · {c.compras.length} compra(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao icone={<Handshake className="size-4" />} onClick={() => navegar(`/vendas/nova?cliente=${c.id}`)}>
            Nova venda
          </Botao>
          <Botao variante="secundario" icone={<Pencil className="size-4" />} onClick={() => setEditar(true)}>
            Editar
          </Botao>
          {ehAdmin && c.compras.length === 0 && (
            <Botao variante="perigo" icone={<Trash2 className="size-4" />} onClick={() => setExcluir(true)}>
              Excluir
            </Botao>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Painel titulo="Dados do cliente">
          <Detalhes
            itens={[
              ['CPF', cpf(c.cpf)],
              ['Telefone', c.telefone ? mascaraTelefone(c.telefone) : '—'],
              ['E-mail', c.email ?? '—'],
              ['Endereço', c.endereco ?? '—'],
            ]}
          />
          <div className="border-t border-line mt-5 pt-4">
            <p className="text-xs text-faint">Total em compras</p>
            <p className="font-display text-3xl font-semibold tabular mt-1">{moeda(totalGasto)}</p>
          </div>
        </Painel>

        <Painel titulo="Histórico de compras" semPadding className="xl:col-span-2">
          {c.compras.length === 0 ? (
            <Vazio titulo="Nenhuma compra registrada" texto="As vendas para este cliente aparecerão aqui." />
          ) : (
            <Tabela>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Veículo</Th>
                  <Th>Pagamento</Th>
                  <Th>Vendedor</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {c.compras.map((v) => (
                  <tr key={v.id} className="hover:bg-raised/60">
                    <Td className="whitespace-nowrap">
                      <Link to={`/vendas/${v.id}`} className="hover:text-brand">
                        {data(v.data_venda)}
                      </Link>
                    </Td>
                    <Td>
                      <Link to={`/veiculos/${v.veiculo_id}`} className="font-medium hover:text-brand">
                        {v.marca} {v.modelo} {v.ano}
                      </Link>
                      <p className="text-xs text-faint">{placa(v.placa)}</p>
                    </Td>
                    <Td>{FORMA_PAGAMENTO[v.forma_pagamento]}</Td>
                    <Td>{v.vendedor_nome}</Td>
                    <Td className="text-right whitespace-nowrap">{moeda(v.valor_liquido)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Painel>
      </div>

      <ClienteForm aberto={editar} cliente={c} fechar={() => setEditar(false)} salvo={() => recarregar()} />
      <Confirmar
        aberto={excluir}
        titulo="Excluir cliente"
        perigo
        rotulo="Excluir cliente"
        carregando={exclusao.enviando}
        cancelar={() => setExcluir(false)}
        texto={<>O cadastro de <strong className="text-ink">{c.nome}</strong> será apagado. Clientes com compras não podem ser excluídos.</>}
        confirmar={async () => {
          const r = await exclusao.enviar(() => api.delete(`/clientes/${c.id}`).then(() => true), 'Cliente excluído.');
          if (r) navegar('/clientes', { replace: true });
          else setExcluir(false);
        }}
      />
    </div>
  );
}
