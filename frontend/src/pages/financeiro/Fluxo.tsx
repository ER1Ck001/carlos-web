import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, type Paginado } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useEnvio } from '../../lib/useEnvio';
import { data, hoje, moeda, ORIGEM_FLUXO } from '../../lib/format';
import { Botao, Campo, Carregando, Confirmar, ErroCarregar, Input, Modal, Paginacao, Painel, Select, Tabela, Td, Th, Vazio, cx } from '../../components/ui';
import type { Periodo } from './comum';

interface Lancamento {
  id: number;
  tipo: 'ENTRADA' | 'SAIDA';
  descricao: string;
  valor: number;
  data_movimentacao: string;
  origem: string;
  referencia_id: number | null;
}

export default function Fluxo({ periodo }: { periodo: Periodo }) {
  const [tipo, setTipo] = useState('');
  const [origem, setOrigem] = useState('');
  const [page, setPage] = useState(1);
  const [novo, setNovo] = useState(false);
  const [excluir, setExcluir] = useState<Lancamento | null>(null);
  const [f, setF] = useState({ tipo: 'ENTRADA', descricao: '', valor: '', data_movimentacao: hoje() });
  const envio = useEnvio();

  const { dados, erro, carregando, recarregar } = useApi(
    () =>
      api.get<Paginado<Lancamento> & { entradas: number; saidas: number; saldo: number }>('/financeiro/fluxo', {
        tipo,
        origem,
        ...periodo,
        page,
        pageSize: 20,
      }),
    [tipo, origem, periodo.inicio, periodo.fim, page],
  );

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const ok = envio.validar({
      descricao: f.descricao.trim().length < 3 && 'Informe a descrição',
      valor: !(Number(f.valor) > 0) && 'O valor deve ser maior que zero',
      data_movimentacao: !f.data_movimentacao && 'Informe a data',
    });
    if (!ok) return;
    const r = await envio.enviar(() => api.post('/financeiro/fluxo', { ...f, valor: Number(f.valor) }), 'Lançamento registrado.');
    if (r) {
      setNovo(false);
      setF({ tipo: 'ENTRADA', descricao: '', valor: '', data_movimentacao: hoje() });
      recarregar();
    }
  }

  return (
    <Painel semPadding>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-3">
          <Select value={tipo} onChange={(e) => (setTipo(e.target.value), setPage(1))} className="w-40" aria-label="Tipo">
            <option value="">Entradas e saídas</option>
            <option value="ENTRADA">Só entradas</option>
            <option value="SAIDA">Só saídas</option>
          </Select>
          <Select value={origem} onChange={(e) => (setOrigem(e.target.value), setPage(1))} className="w-52" aria-label="Origem">
            <option value="">Todas as origens</option>
            {Object.entries(ORIGEM_FLUXO).map(([k, r]) => (
              <option key={k} value={k}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <Botao icone={<Plus className="size-4" />} onClick={() => setNovo(true)}>
          Lançamento manual
        </Botao>
      </div>

      {dados && (
        <div className="grid grid-cols-3 border-y border-line divide-x divide-line">
          {[
            ['Entradas', dados.entradas, 'text-ok'],
            ['Saídas', dados.saidas, ''],
            ['Saldo', dados.saldo, dados.saldo < 0 ? 'text-brand' : ''],
          ].map(([r, v, c]) => (
            <div key={r as string} className="px-4 py-3">
              <p className="text-xs text-faint">{r}</p>
              <p className={cx('font-display text-xl sm:text-2xl font-semibold tabular', c as string)}>{moeda(v as number)}</p>
            </div>
          ))}
        </div>
      )}

      {carregando && !dados ? (
        <Carregando />
      ) : erro ? (
        <ErroCarregar mensagem={erro} tentar={recarregar} />
      ) : !dados?.itens.length ? (
        <Vazio titulo="Nenhum lançamento no período" />
      ) : (
        <div className={cx(carregando && 'opacity-60')}>
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th>Origem</Th>
                <Th className="text-right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((l) => (
                <tr key={l.id} className="hover:bg-raised/60">
                  <Td className="whitespace-nowrap">{data(l.data_movimentacao)}</Td>
                  <Td>{l.descricao}</Td>
                  <Td className="text-muted whitespace-nowrap">{ORIGEM_FLUXO[l.origem]}</Td>
                  <Td className={cx('text-right whitespace-nowrap font-medium', l.tipo === 'ENTRADA' ? 'text-ok' : 'text-brand')}>
                    {l.tipo === 'ENTRADA' ? '+' : '−'} {moeda(l.valor)}
                  </Td>
                  <Td className="text-right">
                    {l.origem === 'MANUAL' && (
                      <Botao tamanho="sm" variante="fantasma" aria-label="Excluir lançamento" onClick={() => setExcluir(l)}>
                        <Trash2 className="size-4" />
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

      <Modal
        aberto={novo}
        fechar={() => setNovo(false)}
        titulo="Lançamento manual"
        largura="max-w-md"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setNovo(false)}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-fluxo" carregando={envio.enviando}>
              Registrar lançamento
            </Botao>
          </>
        }
      >
        <p className="text-sm text-muted mb-4">Use para receitas e gastos avulsos que não vêm de vendas, despesas ou comissões.</p>
        <form id="form-fluxo" onSubmit={salvar} noValidate className="grid grid-cols-2 gap-4">
          <Campo rotulo="Tipo" obrigatorio>
            {(id) => (
              <Select id={id} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
              </Select>
            )}
          </Campo>
          <Campo rotulo="Data" obrigatorio erro={envio.erros.data_movimentacao}>
            {(id, inv) => <Input id={id} type="date" value={f.data_movimentacao} invalido={inv} onChange={(e) => setF({ ...f, data_movimentacao: e.target.value })} />}
          </Campo>
          <Campo rotulo="Descrição" obrigatorio erro={envio.erros.descricao} className="col-span-2">
            {(id, inv) => <Input id={id} value={f.descricao} invalido={inv} onChange={(e) => setF({ ...f, descricao: e.target.value })} />}
          </Campo>
          <Campo rotulo="Valor (R$)" obrigatorio erro={envio.erros.valor} className="col-span-2">
            {(id, inv) => <Input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={f.valor} invalido={inv} onChange={(e) => setF({ ...f, valor: e.target.value })} />}
          </Campo>
        </form>
      </Modal>

      <Confirmar
        aberto={!!excluir}
        titulo="Excluir lançamento"
        perigo
        rotulo="Excluir"
        carregando={envio.enviando}
        cancelar={() => setExcluir(null)}
        texto={<>O lançamento <strong className="text-ink">{excluir?.descricao}</strong> será removido do fluxo de caixa.</>}
        confirmar={async () => {
          const r = await envio.enviar(() => api.delete(`/financeiro/fluxo/${excluir!.id}`).then(() => true), 'Lançamento excluído.');
          setExcluir(null);
          if (r) recarregar();
        }}
      />
    </Painel>
  );
}
