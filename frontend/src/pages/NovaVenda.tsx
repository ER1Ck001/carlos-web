import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useEnvio } from '../lib/useEnvio';
import { cpf, FORMA_PAGAMENTO, hoje, moeda, placa, STATUS_VEICULO } from '../lib/format';
import ClienteForm from '../components/ClienteForm';
import { Botao, Cabecalho, Campo, Carregando, Input, Painel, Select, Textarea } from '../components/ui';

interface VeiculoOpcao {
  id: number;
  marca: string;
  modelo: string;
  ano: number;
  cor: string | null;
  placa: string | null;
  valor_venda: number;
  status: 'DISPONIVEL' | 'RESERVADO';
}
interface ClienteOpcao {
  id: number;
  nome: string;
  cpf: string;
}
interface Vendedor {
  id: number;
  nome: string;
}

const PARCELAVEIS = ['CARTAO_CREDITO', 'BOLETO'];
const A_VISTA = ['PIX', 'DINHEIRO', 'CARTAO_DEBITO'];

/** Mesmo cálculo de vencimento do backend (mês a mês, a partir de hoje). */
function vencimento(meses: number) {
  const [a, m, d] = hoje().split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimo));
  return alvo.toLocaleDateString('pt-BR');
}

export default function NovaVenda() {
  const { usuario, ehAdmin } = useAuth();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [veiculos, setVeiculos] = useState<VeiculoOpcao[] | null>(null);
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [novoCliente, setNovoCliente] = useState(false);
  const { enviando, erros, enviar, validar } = useEnvio();

  const [f, setF] = useState({
    veiculo_id: params.get('veiculo') ?? '',
    cliente_id: params.get('cliente') ?? '',
    usuario_id: '',
    valor_venda: '',
    desconto: '0',
    forma_pagamento: 'PIX',
    parcelas: '1',
    observacoes: '',
  });

  useEffect(() => {
    Promise.all([
      api.get<VeiculoOpcao[]>('/veiculos/vendaveis'),
      api.get<ClienteOpcao[]>('/clientes/opcoes'),
      api.get<Vendedor[]>('/usuarios/vendedores'),
    ])
      .then(([v, c, u]) => {
        setVeiculos(v);
        setClientes(c);
        setVendedores(u);
        setF((x) => {
          const sel = v.find((o) => String(o.id) === x.veiculo_id);
          return { ...x, usuario_id: String(usuario?.id ?? ''), valor_venda: sel ? String(sel.valor_venda) : x.valor_venda, veiculo_id: sel ? x.veiculo_id : '' };
        });
      })
      .catch(() => setVeiculos([]));
  }, [usuario?.id]);

  const veiculo = useMemo(() => veiculos?.find((v) => String(v.id) === f.veiculo_id), [veiculos, f.veiculo_id]);
  const valor = Number(f.valor_venda) || 0;
  const desconto = Number(f.desconto) || 0;
  const liquido = Math.max(0, valor - desconto);
  const parcelavel = PARCELAVEIS.includes(f.forma_pagamento);
  const nParcelas = parcelavel ? Math.min(12, Math.max(1, Number(f.parcelas) || 1)) : 1;
  const valorParcela = Math.floor((liquido / nParcelas) * 100) / 100;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const ok = validar({
      veiculo_id: !f.veiculo_id && 'Selecione um veículo disponível',
      cliente_id: !f.cliente_id && 'Selecione o cliente',
      valor_venda: !(valor > 0) && 'Informe o valor da venda',
      desconto: (desconto < 0 && 'O desconto não pode ser negativo') || (desconto >= valor && valor > 0 && 'O desconto deve ser menor que o valor'),
      parcelas: parcelavel && (nParcelas < 1 || nParcelas > 12) && 'Entre 1 e 12 parcelas',
    });
    if (!ok) return;
    const r = await enviar(
      () =>
        api.post<{ id: number }>('/vendas', {
          veiculo_id: Number(f.veiculo_id),
          cliente_id: Number(f.cliente_id),
          usuario_id: ehAdmin ? Number(f.usuario_id) : undefined,
          valor_venda: valor,
          desconto,
          forma_pagamento: f.forma_pagamento,
          parcelas: nParcelas,
          observacoes: f.observacoes,
        }),
      'Venda registrada. O veículo foi marcado como vendido.',
    );
    if (r) navegar(`/vendas/${r.id}`, { replace: true });
  }

  if (!veiculos) return <Carregando />;

  return (
    <div>
      <Link to="/vendas" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Vendas
      </Link>
      <Cabecalho titulo="Registrar venda" descricao="A venda baixa o veículo do estoque e gera os pagamentos e a comissão no financeiro." />

      <form onSubmit={salvar} noValidate className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 flex flex-col gap-5">
          <Painel titulo="Veículo e cliente">
            <div className="grid grid-cols-1 gap-4">
              <Campo rotulo="Veículo" obrigatorio erro={erros.veiculo_id} ajuda={veiculos.length === 0 ? 'Não há veículos disponíveis para venda.' : 'Somente veículos disponíveis ou reservados.'}>
                {(id, inv) => (
                  <Select
                    id={id}
                    value={f.veiculo_id}
                    invalido={inv}
                    onChange={(e) => {
                      const sel = veiculos.find((v) => String(v.id) === e.target.value);
                      setF({ ...f, veiculo_id: e.target.value, valor_venda: sel ? String(sel.valor_venda) : '' });
                    }}
                  >
                    <option value="">Selecione o veículo…</option>
                    {veiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.marca} {v.modelo} {v.ano} · {placa(v.placa)} · {moeda(v.valor_venda)}
                        {v.status === 'RESERVADO' ? ' (reservado)' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Campo>

              <div className="flex gap-2 items-end">
                <Campo rotulo="Cliente" obrigatorio erro={erros.cliente_id} className="flex-1">
                  {(id, inv) => (
                    <Select id={id} value={f.cliente_id} invalido={inv} onChange={(e) => setF({ ...f, cliente_id: e.target.value })}>
                      <option value="">Selecione o cliente…</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} · {cpf(c.cpf)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Campo>
                <Botao type="button" variante="secundario" icone={<UserPlus className="size-4" />} onClick={() => setNovoCliente(true)} className={erros.cliente_id ? 'mb-6' : ''}>
                  <span className="hidden sm:inline">Novo cliente</span>
                </Botao>
              </div>

              <Campo rotulo="Vendedor" ajuda={ehAdmin ? undefined : 'A venda é registrada no seu nome.'}>
                {(id) => (
                  <Select id={id} value={f.usuario_id} disabled={!ehAdmin} onChange={(e) => setF({ ...f, usuario_id: e.target.value })}>
                    {vendedores.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </Select>
                )}
              </Campo>
            </div>
          </Painel>

          <Painel titulo="Valores e pagamento">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo rotulo="Preço negociado (R$)" obrigatorio erro={erros.valor_venda}>
                {(id, inv) => <Input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={f.valor_venda} invalido={inv} onChange={(e) => setF({ ...f, valor_venda: e.target.value })} />}
              </Campo>
              <Campo rotulo="Desconto (R$)" erro={erros.desconto}>
                {(id, inv) => <Input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={f.desconto} invalido={inv} onChange={(e) => setF({ ...f, desconto: e.target.value })} />}
              </Campo>
              <Campo rotulo="Forma de pagamento" obrigatorio erro={erros.forma_pagamento}>
                {(id, inv) => (
                  <Select id={id} value={f.forma_pagamento} invalido={inv} onChange={(e) => setF({ ...f, forma_pagamento: e.target.value, parcelas: '1' })}>
                    {Object.entries(FORMA_PAGAMENTO).map(([k, r]) => (
                      <option key={k} value={k}>
                        {r}
                      </option>
                    ))}
                  </Select>
                )}
              </Campo>
              {parcelavel && (
                <Campo rotulo="Parcelas" erro={erros.parcelas}>
                  {(id, inv) => (
                    <Select id={id} value={f.parcelas} invalido={inv} onChange={(e) => setF({ ...f, parcelas: e.target.value })}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}x
                        </option>
                      ))}
                    </Select>
                  )}
                </Campo>
              )}
              <Campo rotulo="Observações" className="sm:col-span-2">
                {(id) => <Textarea id={id} rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />}
              </Campo>
            </div>
          </Painel>
        </div>

        <div className="xl:sticky xl:top-6 self-start flex flex-col gap-5">
          <Painel titulo="Resumo">
            {veiculo ? (
              <div className="rounded-lg bg-raised px-4 py-3 mb-4">
                <p className="font-medium">
                  {veiculo.marca} {veiculo.modelo}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {veiculo.ano} · {placa(veiculo.placa)} · {STATUS_VEICULO[veiculo.status]}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted mb-4">Selecione um veículo.</p>
            )}
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Preço</dt>
                <dd className="tabular">{moeda(valor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Desconto</dt>
                <dd className="tabular">− {moeda(desconto)}</dd>
              </div>
              <div className="flex justify-between items-baseline border-t border-line pt-3 mt-1">
                <dt className="text-muted">Valor líquido</dt>
                <dd className="font-display text-3xl font-semibold tabular">{moeda(liquido)}</dd>
              </div>
            </dl>
            <div className="mt-4 text-sm text-muted leading-relaxed">
              {A_VISTA.includes(f.forma_pagamento) && <p>Pagamento à vista: entra como recebido hoje no fluxo de caixa.</p>}
              {f.forma_pagamento === 'FINANCIAMENTO' && <p>Financiamento: repasse do banco previsto para 15 dias, como pagamento pendente.</p>}
              {parcelavel && (
                <p>
                  {nParcelas}x de <span className="text-ink tabular">{moeda(valorParcela)}</span>, a primeira em {vencimento(1)}.
                </p>
              )}
            </div>
            <Botao type="submit" carregando={enviando} className="w-full mt-5 h-11" disabled={veiculos.length === 0}>
              Confirmar venda
            </Botao>
          </Painel>
        </div>
      </form>

      <ClienteForm
        aberto={novoCliente}
        fechar={() => setNovoCliente(false)}
        salvo={(c) => {
          setClientes((l) => [...l, { id: c.id, nome: c.nome, cpf: c.cpf }].sort((a, b) => a.nome.localeCompare(b.nome)));
          setF((x) => ({ ...x, cliente_id: String(c.id) }));
        }}
      />
    </div>
  );
}
