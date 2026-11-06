import { Router, type Request } from 'express';
import { z } from 'zod';
import type { ResultSetHeader } from 'mysql2';
import { dbFin, dbOp, transacao } from '../../config/database.js';
import { autorizar, ehAdmin } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/erros.js';
import {
  conflito,
  dinheiro,
  hojeISO,
  idParam,
  naoEncontrado,
  paginacao,
  periodo,
  requisicaoInvalida,
  texto,
  type Linha,
} from '../../utils/http.js';
import { dataISO, valorMonetario } from '../../utils/validacao.js';

export const financeiroRoutes = Router();
const soAdmin = autorizar('ADMIN');

const CATEGORIAS = ['ALUGUEL', 'SALARIOS', 'MANUTENCAO', 'MARKETING', 'IMPOSTOS', 'UTILIDADES', 'COMPRA_VEICULO', 'OUTROS'] as const;

/** Monta filtro de período para uma coluna DATE. */
function filtroData(req: Request, coluna: string, where: string[], params: unknown[]) {
  const { inicio, fim } = periodo(req);
  if (inicio) {
    where.push(`${coluna} >= ?`);
    params.push(inicio);
  }
  if (fim) {
    where.push(`${coluna} <= ?`);
    params.push(fim);
  }
  return { inicio, fim };
}

/** Busca dados das vendas no banco operacional (integração entre os bancos). */
async function dadosVendas(ids: number[]) {
  const mapa = new Map<number, Linha>();
  const unicos = [...new Set(ids)].filter(Boolean);
  if (!unicos.length) return mapa;
  const [rows] = await dbOp.query<Linha[]>(
    `SELECT ve.id, ve.data_venda, (ve.valor_venda - ve.desconto) AS valor_liquido,
            c.nome AS cliente_nome, CONCAT(v.marca, ' ', v.modelo) AS veiculo, v.placa, u.nome AS vendedor_nome
       FROM vendas ve JOIN clientes c ON c.id = ve.cliente_id
       JOIN veiculos v ON v.id = ve.veiculo_id JOIN usuarios u ON u.id = ve.usuario_id
      WHERE ve.id IN (?)`,
    [unicos],
  );
  for (const r of rows) mapa.set(r.id, r);
  return mapa;
}

async function exigirVenda(vendaId: number) {
  const [r] = await dbOp.query<Linha[]>('SELECT id, usuario_id, valor_venda, desconto FROM vendas WHERE id = ?', [vendaId]);
  if (!r[0]) throw conflito(`Venda #${vendaId} não existe no banco operacional. Registro financeiro inconsistente.`);
  return r[0];
}

const pagarSchema = z.object({ data_pagamento: dataISO.optional() });

// =====================================================================
// RESUMO
// =====================================================================
financeiroRoutes.get('/resumo', soAdmin, async (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  filtroData(req, 'data_movimentacao', where, params);
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[fluxo]] = await dbFin.query<Linha[]>(
    `SELECT IFNULL(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor END), 0) AS entradas,
            IFNULL(SUM(CASE WHEN tipo = 'SAIDA' THEN valor END), 0) AS saidas
       FROM fluxo_caixa ${sqlWhere}`,
    params,
  );
  const [[receber]] = await dbFin.query<Linha[]>(
    `SELECT IFNULL(SUM(valor), 0) AS total,
            IFNULL(SUM(CASE WHEN data_vencimento < CURDATE() THEN valor END), 0) AS vencido,
            COUNT(*) AS quantidade
       FROM pagamentos WHERE status = 'PENDENTE'`,
  );
  const [[pagarDesp]] = await dbFin.query<Linha[]>(
    `SELECT IFNULL(SUM(valor), 0) AS total,
            IFNULL(SUM(CASE WHEN data_vencimento < CURDATE() THEN valor END), 0) AS vencido
       FROM despesas WHERE status = 'PENDENTE'`,
  );
  const [[pagarCom]] = await dbFin.query<Linha[]>(
    "SELECT IFNULL(SUM(valor), 0) AS total FROM comissoes WHERE status = 'PENDENTE'",
  );

  const wDesp: string[] = [];
  const pDesp: unknown[] = [];
  filtroData(req, 'data_despesa', wDesp, pDesp);
  const [porCategoria] = await dbFin.query<Linha[]>(
    `SELECT categoria, SUM(valor) AS total FROM despesas
      ${wDesp.length ? `WHERE ${wDesp.join(' AND ')}` : ''}
      GROUP BY categoria ORDER BY total DESC`,
    pDesp,
  );
  const [mensal] = await dbFin.query<Linha[]>(
    `SELECT DATE_FORMAT(data_movimentacao, '%Y-%m') AS mes,
            SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END) AS entradas,
            SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END) AS saidas
       FROM fluxo_caixa ${sqlWhere}
      GROUP BY mes ORDER BY mes`,
    params,
  );

  res.json({
    entradas: Number(fluxo.entradas),
    saidas: Number(fluxo.saidas),
    saldo: dinheiro(Number(fluxo.entradas) - Number(fluxo.saidas)),
    a_receber: { total: Number(receber.total), vencido: Number(receber.vencido), quantidade: receber.quantidade },
    a_pagar: {
      despesas: Number(pagarDesp.total),
      despesas_vencidas: Number(pagarDesp.vencido),
      comissoes: Number(pagarCom.total),
    },
    despesas_por_categoria: porCategoria.map((c) => ({ categoria: c.categoria, total: Number(c.total) })),
    mensal: mensal.map((m) => ({ mes: m.mes, entradas: Number(m.entradas), saidas: Number(m.saidas) })),
  });
});

// =====================================================================
// PAGAMENTOS (contas a receber)
// =====================================================================
financeiroRoutes.get('/pagamentos', soAdmin, async (req, res) => {
  const { page, pageSize, offset } = paginacao(req);
  const where: string[] = [];
  const params: unknown[] = [];
  const status = texto(req.query.status);
  if (status === 'VENCIDO') {
    where.push("status = 'PENDENTE' AND data_vencimento < CURDATE()");
  } else if (status && ['PENDENTE', 'PAGO', 'CANCELADO'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }
  filtroData(req, 'data_vencimento', where, params);
  if (Number(req.query.venda_id) > 0) {
    where.push('venda_id = ?');
    params.push(Number(req.query.venda_id));
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[tot]] = await dbFin.query<Linha[]>(
    `SELECT COUNT(*) AS total, IFNULL(SUM(valor), 0) AS soma FROM pagamentos ${sqlWhere}`,
    params,
  );
  const [itens] = await dbFin.query<Linha[]>(
    `SELECT *, (status = 'PENDENTE' AND data_vencimento < CURDATE()) AS vencido
       FROM pagamentos ${sqlWhere}
      ORDER BY FIELD(status, 'PENDENTE', 'PAGO', 'CANCELADO'), data_vencimento, id
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const vendas = await dadosVendas(itens.map((i) => i.venda_id));
  res.json({
    itens: itens.map((i) => ({ ...i, vencido: !!i.vencido, venda: vendas.get(i.venda_id) ?? null })),
    total: tot.total,
    soma: Number(tot.soma),
    page,
    pageSize,
  });
});

financeiroRoutes.patch('/pagamentos/:id/pagar', soAdmin, validar(pagarSchema), async (req, res) => {
  const id = idParam(req);
  const data = (req.body as z.infer<typeof pagarSchema>).data_pagamento ?? hojeISO();
  if (data > hojeISO()) throw requisicaoInvalida('A data de pagamento não pode estar no futuro.');

  const [p] = await dbFin.query<Linha[]>('SELECT * FROM pagamentos WHERE id = ?', [id]);
  if (!p[0]) throw naoEncontrado('Pagamento');
  await exigirVenda(p[0].venda_id); // validação entre bancos

  await transacao(dbFin, async (conn) => {
    const [r] = await conn.execute<ResultSetHeader>(
      "UPDATE pagamentos SET status = 'PAGO', data_pagamento = ? WHERE id = ? AND status = 'PENDENTE'",
      [data, id],
    );
    if (r.affectedRows === 0) throw conflito('Este pagamento não está pendente.');
    await conn.execute(
      `INSERT INTO fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem, referencia_id)
       VALUES ('ENTRADA', ?, ?, ?, 'PAGAMENTO', ?)`,
      [p[0].descricao ?? `Recebimento venda #${p[0].venda_id}`, p[0].valor, data, id],
    );
  });
  res.json({ mensagem: 'Pagamento registrado como recebido.' });
});

// =====================================================================
// DESPESAS (contas a pagar)
// =====================================================================
financeiroRoutes.get('/despesas', soAdmin, async (req, res) => {
  const { page, pageSize, offset } = paginacao(req);
  const where: string[] = [];
  const params: unknown[] = [];
  const status = texto(req.query.status);
  if (status === 'VENCIDO') {
    where.push("status = 'PENDENTE' AND data_vencimento < CURDATE()");
  } else if (status && ['PENDENTE', 'PAGO'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }
  const categoria = texto(req.query.categoria);
  if (categoria && (CATEGORIAS as readonly string[]).includes(categoria)) {
    where.push('categoria = ?');
    params.push(categoria);
  }
  const busca = texto(req.query.busca);
  if (busca) {
    where.push('descricao LIKE ?');
    params.push(`%${busca}%`);
  }
  filtroData(req, 'data_despesa', where, params);
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[tot]] = await dbFin.query<Linha[]>(`SELECT COUNT(*) AS total, IFNULL(SUM(valor), 0) AS soma FROM despesas ${sqlWhere}`, params);
  const [itens] = await dbFin.query<Linha[]>(
    `SELECT *, (status = 'PENDENTE' AND data_vencimento < CURDATE()) AS vencido
       FROM despesas ${sqlWhere}
      ORDER BY FIELD(status, 'PENDENTE', 'PAGO'), IFNULL(data_vencimento, data_despesa) DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  res.json({ itens: itens.map((i) => ({ ...i, vencido: !!i.vencido })), total: tot.total, soma: Number(tot.soma), page, pageSize });
});

const despesaSchema = z
  .object({
    descricao: z.string().trim().min(3, 'Informe a descrição').max(255),
    categoria: z.enum(CATEGORIAS, { error: 'Categoria inválida' }),
    valor: valorMonetario('Valor').refine((v) => v > 0, 'O valor deve ser maior que zero'),
    data_despesa: dataISO,
    data_vencimento: dataISO.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  })
  .refine((d) => !d.data_vencimento || d.data_vencimento >= d.data_despesa, {
    path: ['data_vencimento'],
    message: 'O vencimento não pode ser anterior à data da despesa',
  });

financeiroRoutes.post('/despesas', soAdmin, validar(despesaSchema), async (req, res) => {
  const d = req.body as z.infer<typeof despesaSchema>;
  const [r] = await dbFin.execute<ResultSetHeader>(
    'INSERT INTO despesas (descricao, categoria, valor, data_despesa, data_vencimento) VALUES (?, ?, ?, ?, ?)',
    [d.descricao, d.categoria, d.valor, d.data_despesa, d.data_vencimento],
  );
  const [rows] = await dbFin.query<Linha[]>('SELECT * FROM despesas WHERE id = ?', [r.insertId]);
  res.status(201).json(rows[0]);
});

financeiroRoutes.put('/despesas/:id', soAdmin, validar(despesaSchema), async (req, res) => {
  const id = idParam(req);
  const d = req.body as z.infer<typeof despesaSchema>;
  const [atual] = await dbFin.query<Linha[]>('SELECT status FROM despesas WHERE id = ?', [id]);
  if (!atual[0]) throw naoEncontrado('Despesa');
  if (atual[0].status === 'PAGO') throw conflito('Despesa já paga não pode ser alterada (já está no fluxo de caixa).');
  await dbFin.execute(
    'UPDATE despesas SET descricao = ?, categoria = ?, valor = ?, data_despesa = ?, data_vencimento = ? WHERE id = ?',
    [d.descricao, d.categoria, d.valor, d.data_despesa, d.data_vencimento, id],
  );
  const [rows] = await dbFin.query<Linha[]>('SELECT * FROM despesas WHERE id = ?', [id]);
  res.json(rows[0]);
});

financeiroRoutes.delete('/despesas/:id', soAdmin, async (req, res) => {
  const id = idParam(req);
  const [atual] = await dbFin.query<Linha[]>('SELECT status FROM despesas WHERE id = ?', [id]);
  if (!atual[0]) throw naoEncontrado('Despesa');
  if (atual[0].status === 'PAGO') throw conflito('Despesa já paga não pode ser excluída (histórico do fluxo de caixa).');
  await dbFin.execute('DELETE FROM despesas WHERE id = ?', [id]);
  res.status(204).end();
});

financeiroRoutes.patch('/despesas/:id/pagar', soAdmin, validar(pagarSchema), async (req, res) => {
  const id = idParam(req);
  const data = (req.body as z.infer<typeof pagarSchema>).data_pagamento ?? hojeISO();
  if (data > hojeISO()) throw requisicaoInvalida('A data de pagamento não pode estar no futuro.');
  await transacao(dbFin, async (conn) => {
    const [d] = await conn.query<Linha[]>('SELECT * FROM despesas WHERE id = ? FOR UPDATE', [id]);
    if (!d[0]) throw naoEncontrado('Despesa');
    if (d[0].status !== 'PENDENTE') throw conflito('Esta despesa já foi paga.');
    await conn.execute("UPDATE despesas SET status = 'PAGO' WHERE id = ?", [id]);
    await conn.execute(
      `INSERT INTO fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem, referencia_id)
       VALUES ('SAIDA', ?, ?, ?, 'DESPESA', ?)`,
      [d[0].descricao, d[0].valor, data, id],
    );
  });
  res.json({ mensagem: 'Despesa paga.' });
});

// =====================================================================
// COMISSÕES
// =====================================================================
financeiroRoutes.get('/comissoes', async (req, res) => {
  const { page, pageSize, offset } = paginacao(req);
  const where: string[] = [];
  const params: unknown[] = [];
  if (!ehAdmin(req)) {
    where.push('vendedor_id = ?');
    params.push(req.usuario!.id);
  } else if (Number(req.query.vendedor_id) > 0) {
    where.push('vendedor_id = ?');
    params.push(Number(req.query.vendedor_id));
  }
  const status = texto(req.query.status);
  if (status && ['PENDENTE', 'PAGA'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }
  const { inicio, fim } = periodo(req);
  if (inicio) {
    where.push('data_calculo >= ?');
    params.push(inicio);
  }
  if (fim) {
    where.push('data_calculo < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(fim);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[tot]] = await dbFin.query<Linha[]>(
    `SELECT COUNT(*) AS total, IFNULL(SUM(valor), 0) AS soma,
            IFNULL(SUM(CASE WHEN status = 'PENDENTE' THEN valor END), 0) AS pendente
       FROM comissoes ${sqlWhere}`,
    params,
  );
  const [itens] = await dbFin.query<Linha[]>(
    `SELECT * FROM comissoes ${sqlWhere} ORDER BY FIELD(status, 'PENDENTE', 'PAGA'), data_calculo DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const vendas = await dadosVendas(itens.map((i) => i.venda_id));
  res.json({
    itens: itens.map((i) => ({ ...i, venda: vendas.get(i.venda_id) ?? null })),
    total: tot.total,
    soma: Number(tot.soma),
    pendente: Number(tot.pendente),
    page,
    pageSize,
  });
});

const percentualSchema = z.object({
  percentual: z.coerce.number({ error: 'Percentual inválido' }).min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
});

/** Recalcula a comissão com outro percentual, a partir do valor líquido da venda. */
financeiroRoutes.patch('/comissoes/:id', soAdmin, validar(percentualSchema), async (req, res) => {
  const id = idParam(req);
  const { percentual } = req.body as z.infer<typeof percentualSchema>;
  const [c] = await dbFin.query<Linha[]>('SELECT * FROM comissoes WHERE id = ?', [id]);
  if (!c[0]) throw naoEncontrado('Comissão');
  if (c[0].status !== 'PENDENTE') throw conflito('Comissão já paga não pode ser recalculada.');
  const venda = await exigirVenda(c[0].venda_id);
  const valor = dinheiro(((venda.valor_venda - venda.desconto) * percentual) / 100);
  await dbFin.execute('UPDATE comissoes SET percentual = ?, valor = ?, data_calculo = NOW() WHERE id = ?', [percentual, valor, id]);
  res.json({ mensagem: 'Comissão recalculada.', percentual, valor });
});

financeiroRoutes.patch('/comissoes/:id/pagar', soAdmin, validar(pagarSchema), async (req, res) => {
  const id = idParam(req);
  const data = (req.body as z.infer<typeof pagarSchema>).data_pagamento ?? hojeISO();
  const [c] = await dbFin.query<Linha[]>('SELECT * FROM comissoes WHERE id = ?', [id]);
  if (!c[0]) throw naoEncontrado('Comissão');
  await exigirVenda(c[0].venda_id);
  await transacao(dbFin, async (conn) => {
    const [r] = await conn.execute<ResultSetHeader>("UPDATE comissoes SET status = 'PAGA' WHERE id = ? AND status = 'PENDENTE'", [id]);
    if (r.affectedRows === 0) throw conflito('Esta comissão já foi paga.');
    if (c[0].valor > 0) {
      await conn.execute(
        `INSERT INTO fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem, referencia_id)
         VALUES ('SAIDA', ?, ?, ?, 'COMISSAO', ?)`,
        [`Comissão da venda #${c[0].venda_id}`, c[0].valor, data, id],
      );
    }
  });
  res.json({ mensagem: 'Comissão paga.' });
});

// =====================================================================
// FLUXO DE CAIXA
// =====================================================================
financeiroRoutes.get('/fluxo', soAdmin, async (req, res) => {
  const { page, pageSize, offset } = paginacao(req, 30);
  const where: string[] = [];
  const params: unknown[] = [];
  const tipo = texto(req.query.tipo);
  if (tipo && ['ENTRADA', 'SAIDA'].includes(tipo)) {
    where.push('tipo = ?');
    params.push(tipo);
  }
  const origem = texto(req.query.origem);
  if (origem && ['PAGAMENTO', 'DESPESA', 'COMISSAO', 'MANUAL'].includes(origem)) {
    where.push('origem = ?');
    params.push(origem);
  }
  filtroData(req, 'data_movimentacao', where, params);
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[tot]] = await dbFin.query<Linha[]>(
    `SELECT COUNT(*) AS total,
            IFNULL(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor END), 0) AS entradas,
            IFNULL(SUM(CASE WHEN tipo = 'SAIDA' THEN valor END), 0) AS saidas
       FROM fluxo_caixa ${sqlWhere}`,
    params,
  );
  const [itens] = await dbFin.query<Linha[]>(
    `SELECT * FROM fluxo_caixa ${sqlWhere} ORDER BY data_movimentacao DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  res.json({
    itens,
    total: tot.total,
    entradas: Number(tot.entradas),
    saidas: Number(tot.saidas),
    saldo: dinheiro(Number(tot.entradas) - Number(tot.saidas)),
    page,
    pageSize,
  });
});

const lancamentoSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SAIDA'], { error: 'Tipo inválido' }),
  descricao: z.string().trim().min(3, 'Informe a descrição').max(255),
  valor: valorMonetario('Valor').refine((v) => v > 0, 'O valor deve ser maior que zero'),
  data_movimentacao: dataISO,
});

/** Lançamento manual (ex.: receitas avulsas de serviços). */
financeiroRoutes.post('/fluxo', soAdmin, validar(lancamentoSchema), async (req, res) => {
  const d = req.body as z.infer<typeof lancamentoSchema>;
  const [r] = await dbFin.execute<ResultSetHeader>(
    `INSERT INTO fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem) VALUES (?, ?, ?, ?, 'MANUAL')`,
    [d.tipo, d.descricao, d.valor, d.data_movimentacao],
  );
  const [rows] = await dbFin.query<Linha[]>('SELECT * FROM fluxo_caixa WHERE id = ?', [r.insertId]);
  res.status(201).json(rows[0]);
});

/** Apenas lançamentos manuais podem ser excluídos (correção de erro de digitação). */
financeiroRoutes.delete('/fluxo/:id', soAdmin, async (req, res) => {
  const id = idParam(req);
  const [l] = await dbFin.query<Linha[]>('SELECT origem FROM fluxo_caixa WHERE id = ?', [id]);
  if (!l[0]) throw naoEncontrado('Lançamento');
  if (l[0].origem !== 'MANUAL') throw conflito('Lançamentos gerados por pagamentos, despesas ou comissões não podem ser excluídos.');
  await dbFin.execute('DELETE FROM fluxo_caixa WHERE id = ?', [id]);
  res.status(204).end();
});
