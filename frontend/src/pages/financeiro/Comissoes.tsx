import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Percent } from 'lucide-react';
import { api, type Paginado } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useEnvio } from '../../lib/useEnvio';
import { dataHora, moeda } from '../../lib/format';
import { Badge, Botao, Campo, Carregando, ErroCarregar, Input, Modal, Paginacao, Painel, Select, Tabela, Td, Th, Vazio, cx } from '../../components/ui';
import { ModalBaixa, type Periodo } from './comum';

interface Comissao {
  id: number;
  venda_id: number;
  vendedor_id: number;
  percentual: number;
  valor: number;
  data_calculo: string;
  status: 'PENDENTE' | 'PAGA';
  venda: { cliente_nome: string; veiculo: string; vendedor_nome: string; valor_liquido: number } | null;
}

export default function Comissoes({ periodo }: { periodo: Periodo }) {
  const [status, setStatus] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [vendedores, setVendedores] = useState<{ id: number; nome: string }[]>([]);
  const [page, setPage] = useState(1);
  const [baixa, setBaixa] = useState<Comissao | null>(null);
  const [recalc, setRecalc] = useState<Comissao | null>(null);
  const [percentual, setPercentual] = useState('');
  const envio = useEnvio();

  useEffect(() => {
    api.get<{ id: number; nome: string }[]>('/usuarios/vendedores').then(setVendedores).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (recalc) setPercentual(String(recalc.percentual));
  }, [recalc]);

  const { dados, erro, carregando, recarregar } = useApi(
    () =>
      api.get<Paginado<Comissao> & { soma: number; pendente: number }>('/financeiro/comissoes', {
        status,
        vendedor_id: vendedor,
        ...periodo,
        page,
        pageSize: 15,
      }),
    [status, vendedor, periodo.inicio, periodo.fim, page],
  );

  const pct = Number(percentual);
  const novoValor = recalc?.venda ? Math.round(recalc.venda.valor_liquido * pct) / 100 : 0;

  return (
    <Painel semPadding>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-3">
          <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-44" aria-label="Status">
            <option value="">Todos os status</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="PAGA">Pagas</option>
          </Select>
          <Select value={vendedor} onChange={(e) => (setVendedor(e.target.value), setPage(1))} className="w-52" aria-label="Vendedor">
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </Select>
        </div>
        {dados && (
          <p className="text-sm text-muted tabular">
            Total {moeda(dados.soma)} · <span className="text-warn">{moeda(dados.pendente)} a pagar</span>
          </p>
        )}
      </div>

      {carregando && !dados ? (
        <Carregando />
      ) : erro ? (
        <ErroCarregar mensagem={erro} tentar={recarregar} />
      ) : !dados?.itens.length ? (
        <Vazio titulo="Nenhuma comissão encontrada" texto="As comissões são calculadas automaticamente a cada venda." />
      ) : (
        <div className={cx(carregando && 'opacity-60')}>
          <Tabela>
            <thead>
              <tr>
                <Th>Venda</Th>
                <Th>Vendedor</Th>
                <Th className="text-right">Venda líquida</Th>
                <Th className="text-right">%</Th>
                <Th className="text-right">Comissão</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((c) => (
                <tr key={c.id} className="hover:bg-raised/60">
                  <Td>
                    <Link to={`/vendas/${c.venda_id}`} className="font-medium hover:text-brand">
                      #{c.venda_id} · {c.venda?.veiculo}
                    </Link>
                    <p className="text-xs text-faint">
                      {c.venda?.cliente_nome} · {dataHora(c.data_calculo)}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">{c.venda?.vendedor_nome}</Td>
                  <Td className="text-right whitespace-nowrap">{moeda(c.venda?.valor_liquido)}</Td>
                  <Td className="text-right">{Number(c.percentual).toLocaleString('pt-BR')}%</Td>
                  <Td className="text-right whitespace-nowrap font-medium">{moeda(c.valor)}</Td>
                  <Td>
                    <Badge valor={c.status} rotulo={c.status === 'PAGA' ? 'Paga' : 'Pendente'} />
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {c.status === 'PENDENTE' && (
                      <div className="flex justify-end gap-1">
                        <Botao tamanho="sm" variante="secundario" onClick={() => setBaixa(c)}>
                          Pagar
                        </Botao>
                        <Botao tamanho="sm" variante="fantasma" aria-label="Alterar percentual" onClick={() => setRecalc(c)}>
                          <Percent className="size-4" />
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

      <ModalBaixa
        aberto={!!baixa}
        titulo="Pagar comissão"
        rotulo="Confirmar pagamento"
        descricao={baixa && <>Comissão da venda #{baixa.venda_id} para {baixa.venda?.vendedor_nome} · <span className="text-ink">{moeda(baixa.valor)}</span>.</>}
        carregando={envio.enviando}
        fechar={() => setBaixa(null)}
        confirmar={async (dt) => {
          const r = await envio.enviar(() => api.patch(`/financeiro/comissoes/${baixa!.id}/pagar`, { data_pagamento: dt }), 'Comissão paga.');
          if (r) {
            setBaixa(null);
            recarregar();
          }
        }}
      />

      <Modal
        aberto={!!recalc}
        fechar={() => setRecalc(null)}
        titulo="Alterar percentual da comissão"
        largura="max-w-md"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setRecalc(null)}>
              Cancelar
            </Botao>
            <Botao
              carregando={envio.enviando}
              onClick={async () => {
                if (!(pct >= 0 && pct <= 100) || percentual === '') return envio.validar({ percentual: 'Informe um percentual entre 0 e 100' });
                const r = await envio.enviar(() => api.patch(`/financeiro/comissoes/${recalc!.id}`, { percentual: pct }), 'Comissão recalculada.');
                if (r) {
                  setRecalc(null);
                  recarregar();
                }
              }}
            >
              Recalcular
            </Botao>
          </>
        }
      >
        <p className="text-sm text-muted mb-4">
          Venda #{recalc?.venda_id} · valor líquido {moeda(recalc?.venda?.valor_liquido)}
        </p>
        <Campo rotulo="Percentual (%)" erro={envio.erros.percentual} ajuda={`Nova comissão: ${moeda(novoValor)}`}>
          {(id, inv) => <Input id={id} type="number" min={0} max={100} step="0.1" value={percentual} invalido={inv} onChange={(e) => setPercentual(e.target.value)} />}
        </Campo>
      </Modal>
    </Painel>
  );
}
