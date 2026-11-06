import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, type Paginado } from '../../lib/api';
import { useApi, useDebounce } from '../../lib/useApi';
import { useEnvio } from '../../lib/useEnvio';
import { CATEGORIA_DESPESA, data, hoje, moeda } from '../../lib/format';
import { Badge, Botao, Campo, CampoBusca, Carregando, Confirmar, ErroCarregar, Input, Modal, Paginacao, Painel, Select, Tabela, Td, Th, Vazio, cx } from '../../components/ui';
import { ModalBaixa, type Periodo } from './comum';

interface Despesa {
  id: number;
  descricao: string;
  categoria: string;
  valor: number;
  data_despesa: string;
  data_vencimento: string | null;
  status: 'PENDENTE' | 'PAGO';
  vencido: boolean;
}

function DespesaForm({ aberto, fechar, despesa, salvo }: { aberto: boolean; fechar: () => void; despesa: Despesa | null; salvo: () => void }) {
  const vazio = { descricao: '', categoria: 'OUTROS', valor: '', data_despesa: hoje(), data_vencimento: '' };
  const [f, setF] = useState(vazio);
  const { enviando, erros, setErros, enviar, validar } = useEnvio();

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setF(
      despesa
        ? {
            descricao: despesa.descricao,
            categoria: despesa.categoria,
            valor: String(despesa.valor),
            data_despesa: despesa.data_despesa,
            data_vencimento: despesa.data_vencimento ?? '',
          }
        : vazio,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, despesa]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const ok = validar({
      descricao: f.descricao.trim().length < 3 && 'Informe a descrição',
      valor: !(Number(f.valor) > 0) && 'O valor deve ser maior que zero',
      data_despesa: !f.data_despesa && 'Informe a data',
      data_vencimento: f.data_vencimento && f.data_vencimento < f.data_despesa && 'O vencimento não pode ser antes da data da despesa',
    });
    if (!ok) return;
    const corpo = { ...f, valor: Number(f.valor), data_vencimento: f.data_vencimento || null };
    const r = await enviar(
      () => (despesa ? api.put(`/financeiro/despesas/${despesa.id}`, corpo) : api.post('/financeiro/despesas', corpo)),
      despesa ? 'Despesa atualizada.' : 'Despesa cadastrada.',
    );
    if (r) {
      salvo();
      fechar();
    }
  }

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo={despesa ? 'Editar despesa' : 'Nova despesa'}
      largura="max-w-lg"
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-despesa" carregando={enviando}>
            {despesa ? 'Salvar alterações' : 'Cadastrar despesa'}
          </Botao>
        </>
      }
    >
      <form id="form-despesa" onSubmit={salvar} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo rotulo="Descrição" obrigatorio erro={erros.descricao} className="sm:col-span-2">
          {(id, inv) => <Input id={id} value={f.descricao} invalido={inv} onChange={(e) => setF({ ...f, descricao: e.target.value })} />}
        </Campo>
        <Campo rotulo="Categoria" obrigatorio erro={erros.categoria}>
          {(id, inv) => (
            <Select id={id} value={f.categoria} invalido={inv} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {Object.entries(CATEGORIA_DESPESA).map(([k, r]) => (
                <option key={k} value={k}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Campo>
        <Campo rotulo="Valor (R$)" obrigatorio erro={erros.valor}>
          {(id, inv) => <Input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={f.valor} invalido={inv} onChange={(e) => setF({ ...f, valor: e.target.value })} />}
        </Campo>
        <Campo rotulo="Data da despesa" obrigatorio erro={erros.data_despesa}>
          {(id, inv) => <Input id={id} type="date" value={f.data_despesa} invalido={inv} onChange={(e) => setF({ ...f, data_despesa: e.target.value })} />}
        </Campo>
        <Campo rotulo="Vencimento" erro={erros.data_vencimento}>
          {(id, inv) => <Input id={id} type="date" value={f.data_vencimento} invalido={inv} onChange={(e) => setF({ ...f, data_vencimento: e.target.value })} />}
        </Campo>
      </form>
    </Modal>
  );
}

export default function Despesas({ periodo, statusInicial }: { periodo: Periodo; statusInicial: string }) {
  const [status, setStatus] = useState(statusInicial);
  const [categoria, setCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ aberto: boolean; despesa: Despesa | null }>({ aberto: false, despesa: null });
  const [baixa, setBaixa] = useState<Despesa | null>(null);
  const [excluir, setExcluir] = useState<Despesa | null>(null);
  const envio = useEnvio();
  const buscaD = useDebounce(busca);

  const { dados, erro, carregando, recarregar } = useApi(
    () => api.get<Paginado<Despesa> & { soma: number }>('/financeiro/despesas', { status, categoria, busca: buscaD, ...periodo, page, pageSize: 15 }),
    [status, categoria, buscaD, periodo.inicio, periodo.fim, page],
  );

  return (
    <Painel semPadding>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_180px_200px_auto] gap-3 p-4">
        <CampoBusca valor={busca} mudar={(v) => (setBusca(v), setPage(1))} placeholder="Buscar despesa" />
        <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} aria-label="Status">
          <option value="">Todos os status</option>
          <option value="PENDENTE">A pagar</option>
          <option value="VENCIDO">Vencidas</option>
          <option value="PAGO">Pagas</option>
        </Select>
        <Select value={categoria} onChange={(e) => (setCategoria(e.target.value), setPage(1))} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORIA_DESPESA).map(([k, r]) => (
            <option key={k} value={k}>
              {r}
            </option>
          ))}
        </Select>
        <Botao icone={<Plus className="size-4" />} onClick={() => setForm({ aberto: true, despesa: null })}>
          Nova despesa
        </Botao>
      </div>
      {dados && dados.total > 0 && (
        <p className="px-4 pb-3 text-sm text-muted tabular">
          {dados.total} despesa(s) · <span className="text-ink">{moeda(dados.soma)}</span>
        </p>
      )}

      {carregando && !dados ? (
        <Carregando />
      ) : erro ? (
        <ErroCarregar mensagem={erro} tentar={recarregar} />
      ) : !dados?.itens.length ? (
        <Vazio titulo="Nenhuma despesa encontrada" />
      ) : (
        <div className={cx(carregando && 'opacity-60')}>
          <Tabela>
            <thead>
              <tr>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th>Data</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
                <Th className="text-right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((d) => (
                <tr key={d.id} className="hover:bg-raised/60">
                  <Td className="font-medium">{d.descricao}</Td>
                  <Td className="whitespace-nowrap text-muted">{CATEGORIA_DESPESA[d.categoria]}</Td>
                  <Td className="whitespace-nowrap">{data(d.data_despesa)}</Td>
                  <Td className="whitespace-nowrap">{data(d.data_vencimento)}</Td>
                  <Td>
                    <Badge valor={d.vencido ? 'VENCIDO' : d.status} rotulo={d.vencido ? 'Vencida' : d.status === 'PAGO' ? 'Paga' : 'A pagar'} />
                  </Td>
                  <Td className="text-right whitespace-nowrap">{moeda(d.valor)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {d.status === 'PENDENTE' && (
                      <div className="flex justify-end gap-1">
                        <Botao tamanho="sm" variante="secundario" onClick={() => setBaixa(d)}>
                          Pagar
                        </Botao>
                        <Botao tamanho="sm" variante="fantasma" aria-label="Editar" onClick={() => setForm({ aberto: true, despesa: d })}>
                          <Pencil className="size-4" />
                        </Botao>
                        <Botao tamanho="sm" variante="fantasma" aria-label="Excluir" onClick={() => setExcluir(d)}>
                          <Trash2 className="size-4" />
                        </Botao>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          <Paginacao page={dados.page} pageSize={dados.pageSize} total={dados.total} mudar={setPage} />
        </div>
      )}

      <DespesaForm aberto={form.aberto} despesa={form.despesa} fechar={() => setForm({ aberto: false, despesa: null })} salvo={recarregar} />
      <ModalBaixa
        aberto={!!baixa}
        titulo="Pagar despesa"
        rotulo="Confirmar pagamento"
        descricao={baixa && <>{baixa.descricao} · <span className="text-ink">{moeda(baixa.valor)}</span>. O valor sai do fluxo de caixa na data informada.</>}
        carregando={envio.enviando}
        fechar={() => setBaixa(null)}
        confirmar={async (dt) => {
          const r = await envio.enviar(() => api.patch(`/financeiro/despesas/${baixa!.id}/pagar`, { data_pagamento: dt }), 'Despesa paga.');
          if (r) {
            setBaixa(null);
            recarregar();
          }
        }}
      />
      <Confirmar
        aberto={!!excluir}
        titulo="Excluir despesa"
        perigo
        rotulo="Excluir"
        carregando={envio.enviando}
        cancelar={() => setExcluir(null)}
        texto={<>A despesa <strong className="text-ink">{excluir?.descricao}</strong> será apagada.</>}
        confirmar={async () => {
          const r = await envio.enviar(() => api.delete(`/financeiro/despesas/${excluir!.id}`).then(() => true), 'Despesa excluída.');
          setExcluir(null);
          if (r) recarregar();
        }}
      />
    </Painel>
  );
}
