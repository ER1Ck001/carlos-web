import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { dbFin, dbOp, FIN, transacao } from '../../config/database.js';
import { env } from '../../config/env.js';
import { conflito, dinheiro, HttpError, hojeISO, naoEncontrado, somarDias, somarMeses, type Linha } from '../../utils/http.js';
import type { FormaPagamento } from '../../utils/validacao.js';

export const A_VISTA: FormaPagamento[] = ['PIX', 'DINHEIRO', 'CARTAO_DEBITO'];
export const PARCELAVEIS: FormaPagamento[] = ['CARTAO_CREDITO', 'BOLETO'];

export interface NovaVenda {
  veiculo_id: number;
  cliente_id: number;
  usuario_id: number;
  valor_venda: number;
  desconto: number;
  forma_pagamento: FormaPagamento;
  parcelas: number;
  observacoes: string | null;
}

interface Parcela {
  valor: number;
  vencimento: string;
  pago: boolean;
  descricao: string;
}

/** Divide o valor em parcelas; a diferença de centavos fica na última. */
export function gerarParcelas(vendaId: number, liquido: number, forma: FormaPagamento, parcelas: number, hoje = hojeISO()): Parcela[] {
  if (A_VISTA.includes(forma)) {
    return [{ valor: liquido, vencimento: hoje, pago: true, descricao: `Venda #${vendaId} - pagamento à vista` }];
  }
  if (forma === 'FINANCIAMENTO') {
    return [{ valor: liquido, vencimento: somarDias(hoje, 15), pago: false, descricao: `Venda #${vendaId} - repasse do financiamento` }];
  }
  const n = Math.max(1, parcelas);
  const base = Math.floor((liquido / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    valor: i === n - 1 ? dinheiro(liquido - base * (n - 1)) : base,
    vencimento: somarMeses(hoje, i + 1),
    pago: false,
    descricao: `Venda #${vendaId} - parcela ${i + 1}/${n}`,
  }));
}

/**
 * Registra a venda numa única transação que envolve os dois bancos:
 *  1. trava o veículo (SELECT ... FOR UPDATE) e confere se ainda está à venda
 *  2. valida cliente e vendedor
 *  3. grava a venda, marca o veículo como VENDIDO e registra a SAÍDA do estoque
 *  4. gera pagamentos, comissão e, se à vista, a entrada no fluxo de caixa
 * Qualquer falha desfaz tudo.
 */
export async function registrarVenda(d: NovaVenda, operadorId: number) {
  return transacao(dbOp, async (conn: PoolConnection) => {
    const [veic] = await conn.query<Linha[]>(
      'SELECT id, marca, modelo, status FROM veiculos WHERE id = ? FOR UPDATE',
      [d.veiculo_id],
    );
    if (!veic[0]) throw naoEncontrado('Veículo');
    if (veic[0].status === 'VENDIDO') throw conflito('Este veículo já foi vendido.');

    const [cli] = await conn.query<Linha[]>('SELECT id FROM clientes WHERE id = ?', [d.cliente_id]);
    if (!cli[0]) throw naoEncontrado('Cliente');

    const [vend] = await conn.query<Linha[]>('SELECT id, ativo FROM usuarios WHERE id = ?', [d.usuario_id]);
    if (!vend[0] || !vend[0].ativo) throw new HttpError(400, 'Vendedor inválido ou inativo.');

    const liquido = dinheiro(d.valor_venda - d.desconto);
    if (liquido <= 0) throw new HttpError(400, 'O desconto deve ser menor que o valor da venda.');

    const [rv] = await conn.execute<ResultSetHeader>(
      `INSERT INTO vendas (veiculo_id, cliente_id, usuario_id, valor_venda, desconto, forma_pagamento, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d.veiculo_id, d.cliente_id, d.usuario_id, d.valor_venda, d.desconto, d.forma_pagamento, d.observacoes],
    );
    const vendaId = rv.insertId;

    await conn.execute("UPDATE veiculos SET status = 'VENDIDO' WHERE id = ?", [d.veiculo_id]);
    await conn.execute(
      `INSERT INTO estoque (veiculo_id, tipo_movimentacao, quantidade, observacao, usuario_id)
       VALUES (?, 'SAIDA', 1, ?, ?)`,
      [d.veiculo_id, `Saída por venda #${vendaId}`, operadorId],
    );

    const hoje = hojeISO();
    for (const p of gerarParcelas(vendaId, liquido, d.forma_pagamento, d.parcelas, hoje)) {
      const [rp] = await conn.execute<ResultSetHeader>(
        `INSERT INTO ${FIN('pagamentos')} (venda_id, valor, forma_pagamento, data_vencimento, data_pagamento, status, descricao)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vendaId, p.valor, d.forma_pagamento, p.vencimento, p.pago ? hoje : null, p.pago ? 'PAGO' : 'PENDENTE', p.descricao],
      );
      if (p.pago) {
        await conn.execute(
          `INSERT INTO ${FIN('fluxo_caixa')} (tipo, descricao, valor, data_movimentacao, origem, referencia_id)
           VALUES ('ENTRADA', ?, ?, ?, 'PAGAMENTO', ?)`,
          [p.descricao, p.valor, hoje, rp.insertId],
        );
      }
    }

    const percentual = env.COMISSAO_PERCENTUAL_PADRAO;
    await conn.execute(
      `INSERT INTO ${FIN('comissoes')} (venda_id, vendedor_id, percentual, valor) VALUES (?, ?, ?, ?)`,
      [vendaId, d.usuario_id, percentual, dinheiro((liquido * percentual) / 100)],
    );

    return vendaId;
  });
}

/** Enriquecimento entre bancos: resumo financeiro de várias vendas. */
export async function resumoFinanceiroVendas(ids: number[]) {
  const mapa = new Map<number, { recebido: number; pendente: number; parcelas: number }>();
  if (!ids.length) return mapa;
  const [rows] = await dbFin.query<Linha[]>(
    `SELECT venda_id,
            SUM(CASE WHEN status = 'PAGO' THEN valor ELSE 0 END) AS recebido,
            SUM(CASE WHEN status = 'PENDENTE' THEN valor ELSE 0 END) AS pendente,
            COUNT(*) AS parcelas
       FROM pagamentos WHERE venda_id IN (?) GROUP BY venda_id`,
    [ids],
  );
  for (const r of rows) mapa.set(r.venda_id, { recebido: Number(r.recebido), pendente: Number(r.pendente), parcelas: r.parcelas });
  return mapa;
}
