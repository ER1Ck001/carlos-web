import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Handshake, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useEnvio } from '../lib/useEnvio';
import { data, dataHora, FORMA_PAGAMENTO, moeda, numero, placa, STATUS_VEICULO, TIPO_MOV } from '../lib/format';
import VeiculoForm, { type Veiculo } from '../components/VeiculoForm';
import MovimentacaoForm from '../components/MovimentacaoForm';
import { Badge, Botao, Carregando, Confirmar, Detalhes, ErroCarregar, Painel } from '../components/ui';

interface Detalhe extends Veiculo {
  movimentacoes: { id: number; tipo_movimentacao: string; data_movimentacao: string; localizacao: string | null; observacao: string | null; usuario_nome: string }[];
  venda: null | {
    id: number;
    data_venda: string;
    valor_venda: number;
    desconto: number;
    valor_liquido: number;
    forma_pagamento: string;
    cliente_id: number;
    cliente_nome: string;
    vendedor_nome: string;
  };
}

export default function VeiculoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { ehAdmin } = useAuth();
  const { dados: v, erro, carregando, recarregar } = useApi(() => api.get<Detalhe>(`/veiculos/${id}`), [id]);
  const [editar, setEditar] = useState(false);
  const [mov, setMov] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const exclusao = useEnvio();

  if (carregando && !v) return <Carregando />;
  if (erro || !v) return <ErroCarregar mensagem={erro ?? 'Veículo não encontrado.'} tentar={recarregar} />;

  const margem = v.valor_venda - v.valor_compra;
  const podeExcluir = ehAdmin && v.status === 'DISPONIVEL' && !v.venda;

  return (
    <div>
      <Link to="/veiculos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Veículos
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-none">
              {v.marca} {v.modelo}
            </h1>
            <Badge valor={v.status} rotulo={STATUS_VEICULO[v.status]} />
          </div>
          <p className="text-muted mt-2 text-sm">
            {v.ano} · {placa(v.placa)} · {numero(v.quilometragem)} km · {v.dias_estoque} dias desde a entrada
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {v.status !== 'VENDIDO' && (
            <>
              <Botao variante="secundario" icone={<ArrowLeftRight className="size-4" />} onClick={() => setMov(true)}>
                Movimentar
              </Botao>
              <Botao icone={<Handshake className="size-4" />} onClick={() => navegar(`/vendas/nova?veiculo=${v.id}`)}>
                Vender
              </Botao>
            </>
          )}
          {ehAdmin && (
            <Botao variante="secundario" icone={<Pencil className="size-4" />} onClick={() => setEditar(true)}>
              Editar
            </Botao>
          )}
          {podeExcluir && (
            <Botao variante="perigo" icone={<Trash2 className="size-4" />} onClick={() => setExcluir(true)}>
              Excluir
            </Botao>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 flex flex-col gap-5">
          <Painel titulo="Dados do veículo">
            <Detalhes
              itens={[
                ['Marca', v.marca],
                ['Modelo', v.modelo],
                ['Ano', v.ano],
                ['Cor', v.cor ?? '—'],
                ['Placa', placa(v.placa)],
                ['Chassi', <span className="tabular">{v.chassi ?? '—'}</span>],
                ['Quilometragem', `${numero(v.quilometragem)} km`],
                ['Local atual', v.status === 'VENDIDO' ? 'Entregue ao cliente' : v.localizacao ?? '—'],
                ['Cadastrado em', data(v.data_cadastro)],
                ['Observações', v.observacoes ?? '—'],
              ]}
            />
          </Painel>

          <Painel titulo="Histórico de movimentações" semPadding>
            <ol className="px-5 pb-5">
              {v.movimentacoes.map((m, i) => (
                <li key={m.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < v.movimentacoes.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-line-strong" aria-hidden />}
                  <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-brand bg-base" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge valor={m.tipo_movimentacao} rotulo={TIPO_MOV[m.tipo_movimentacao]} />
                      {m.localizacao && <span className="text-sm">{m.localizacao}</span>}
                    </div>
                    {m.observacao && <p className="text-sm text-muted mt-1">{m.observacao}</p>}
                    <p className="text-xs text-faint mt-1 tabular">
                      {dataHora(m.data_movimentacao)} · {m.usuario_nome}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Painel>
        </div>

        <div className="flex flex-col gap-5">
          <Painel titulo="Valores">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Valor de venda</dt>
                <dd className="font-display text-2xl font-semibold tabular">{moeda(v.valor_venda)}</dd>
              </div>
              {ehAdmin && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted">Valor de compra</dt>
                    <dd className="tabular">{moeda(v.valor_compra)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3">
                    <dt className="text-muted">Margem prevista</dt>
                    <dd className={`tabular ${margem >= 0 ? 'text-ok' : 'text-brand'}`}>{moeda(margem)}</dd>
                  </div>
                </>
              )}
            </dl>
          </Painel>

          {v.venda && (
            <Painel titulo="Venda" acao={<Link to={`/vendas/${v.venda.id}`} className="text-sm text-muted hover:text-ink">Ver venda #{v.venda.id}</Link>}>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Cliente</dt>
                  <dd className="text-right">
                    <Link to={`/clientes/${v.venda.cliente_id}`} className="hover:text-brand">
                      {v.venda.cliente_nome}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Vendedor</dt>
                  <dd>{v.venda.vendedor_nome}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Data</dt>
                  <dd className="tabular">{data(v.venda.data_venda)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Pagamento</dt>
                  <dd>{FORMA_PAGAMENTO[v.venda.forma_pagamento]}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-3">
                  <dt className="text-muted">Valor líquido</dt>
                  <dd className="tabular font-medium">{moeda(v.venda.valor_liquido)}</dd>
                </div>
              </dl>
            </Painel>
          )}
        </div>
      </div>

      <VeiculoForm aberto={editar} veiculo={v} fechar={() => setEditar(false)} salvo={() => recarregar()} />
      <MovimentacaoForm aberto={mov} fechar={() => setMov(false)} veiculo={v.status === 'VENDIDO' ? null : (v as never)} salvo={() => recarregar()} />
      <Confirmar
        aberto={excluir}
        titulo="Excluir veículo"
        perigo
        rotulo="Excluir veículo"
        carregando={exclusao.enviando}
        cancelar={() => setExcluir(false)}
        texto={
          <>
            O cadastro de <strong className="text-ink">{v.marca} {v.modelo}</strong> e as movimentações dele serão apagados. Use isto só para corrigir um cadastro feito por engano.
          </>
        }
        confirmar={async () => {
          const r = await exclusao.enviar(() => api.delete(`/veiculos/${v.id}`).then(() => true), 'Veículo excluído.');
          if (r) navegar('/veiculos', { replace: true });
          else setExcluir(false);
        }}
      />
    </div>
  );
}
