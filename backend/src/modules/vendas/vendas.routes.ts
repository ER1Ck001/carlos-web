import { Router } from 'express';
import { z } from 'zod';
import { dbFin, dbOp } from '../../config/database.js';
import { ehAdmin } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/erros.js';
import { HttpError, idParam, naoEncontrado, paginacao, periodo, texto, type Linha } from '../../utils/http.js';
import { FORMAS_PAGAMENTO, textoOpcional, valorMonetario } from '../../utils/validacao.js';
import { PARCELAVEIS, registrarVenda, resumoFinanceiroVendas } from './vendas.service.js';

export const vendasRoutes = Router();

const SELECT_VENDA = `
  SELECT ve.id, ve.data_venda, ve.valor_venda, ve.desconto, (ve.valor_venda - ve.desconto) AS valor_liquido,
         ve.forma_pagamento, ve.observacoes,
         v.id AS veiculo_id, v.marca, v.modelo, v.ano, v.placa, v.cor, v.valor_compra,
         c.id AS cliente_id, c.nome AS cliente_nome, c.cpf AS cliente_cpf,
         u.id AS vendedor_id, u.nome AS vendedor_nome
    FROM vendas ve
    JOIN veiculos v ON v.id = ve.veiculo_id
    JOIN clientes c ON c.id = ve.cliente_id
    JOIN usuarios u ON u.id = ve.usuario_id`;

vendasRoutes.get('/', async (req, res) => {
  const { page, pageSize, offset } = paginacao(req);
  const { inicio, fim } = periodo(req);
  const where: string[] = [];
  const params: unknown[] = [];

  // Vendedor enxerga apenas as próprias vendas
  if (!ehAdmin(req)) {
    where.push('ve.usuario_id = ?');
    params.push(req.usuario!.id);
  } else if (Number(req.query.vendedor_id) > 0) {
    where.push('ve.usuario_id = ?');
    params.push(Number(req.query.vendedor_id));
  }
  if (inicio) {
    where.push('ve.data_venda >= ?');
    params.push(inicio);
  }
  if (fim) {
    where.push('ve.data_venda < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(fim);
  }
  const forma = texto(req.query.forma_pagamento);
  if (forma && (FORMAS_PAGAMENTO as readonly string[]).includes(forma)) {
    where.push('ve.forma_pagamento = ?');
    params.push(forma);
  }
  const busca = texto(req.query.busca);
  if (busca) {
    where.push("(c.nome LIKE ? OR CONCAT(v.marca, ' ', v.modelo) LIKE ? OR v.placa LIKE ?)");
    params.push(`%${busca}%`, `%${busca}%`, `%${busca.toUpperCase()}%`);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[tot]] = await dbOp.query<Linha[]>(
    `SELECT COUNT(*) AS total, IFNULL(SUM(ve.valor_venda - ve.desconto), 0) AS soma
       FROM vendas ve JOIN veiculos v ON v.id = ve.veiculo_id JOIN clientes c ON c.id = ve.cliente_id ${sqlWhere}`,
    params,
  );
  const [itens] = await dbOp.query<Linha[]>(`${SELECT_VENDA} ${sqlWhere} ORDER BY ve.data_venda DESC LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    offset,
  ]);

  const fin = await resumoFinanceiroVendas(itens.map((i) => i.id));
  const comFinanceiro = itens.map((i) => ({ ...i, financeiro: fin.get(i.id) ?? { recebido: 0, pendente: 0, parcelas: 0 } }));

  res.json({ itens: comFinanceiro, total: tot.total, soma: Number(tot.soma), page, pageSize });
});

vendasRoutes.get('/:id', async (req, res) => {
  const id = idParam(req);
  const [rows] = await dbOp.query<Linha[]>(`${SELECT_VENDA} WHERE ve.id = ?`, [id]);
  const venda = rows[0];
  if (!venda) throw naoEncontrado('Venda');
  if (!ehAdmin(req) && venda.vendedor_id !== req.usuario!.id) {
    throw new HttpError(403, 'Você só pode visualizar as próprias vendas.');
  }
  const [pagamentos] = await dbFin.query<Linha[]>(
    'SELECT * FROM pagamentos WHERE venda_id = ? ORDER BY data_vencimento, id',
    [id],
  );
  const [comissao] = await dbFin.query<Linha[]>('SELECT * FROM comissoes WHERE venda_id = ?', [id]);
  res.json({ ...venda, pagamentos, comissao: comissao[0] ?? null });
});

const vendaSchema = z
  .object({
    veiculo_id: z.coerce.number({ error: 'Selecione o veículo' }).int().positive('Selecione o veículo'),
    cliente_id: z.coerce.number({ error: 'Selecione o cliente' }).int().positive('Selecione o cliente'),
    usuario_id: z.coerce.number().int().positive().optional(),
    valor_venda: valorMonetario('Valor da venda').refine((v) => v > 0, 'Informe o valor da venda'),
    desconto: valorMonetario('Desconto').default(0),
    forma_pagamento: z.enum(FORMAS_PAGAMENTO, { error: 'Selecione a forma de pagamento' }),
    parcelas: z.coerce.number().int().min(1, 'Mínimo 1 parcela').max(12, 'Máximo 12 parcelas').default(1),
    observacoes: textoOpcional(2000),
  })
  .refine((d) => d.desconto < d.valor_venda, { path: ['desconto'], message: 'O desconto deve ser menor que o valor da venda' });

vendasRoutes.post('/', validar(vendaSchema), async (req, res) => {
  const d = req.body as z.infer<typeof vendaSchema>;
  // Vendedor sempre registra a venda em seu próprio nome; admin pode escolher o vendedor.
  const usuarioId = ehAdmin(req) && d.usuario_id ? d.usuario_id : req.usuario!.id;
  const parcelas = PARCELAVEIS.includes(d.forma_pagamento) ? d.parcelas : 1;

  const vendaId = await registrarVenda({ ...d, usuario_id: usuarioId, parcelas }, req.usuario!.id);
  res.status(201).json({ id: vendaId, mensagem: 'Venda registrada com sucesso.' });
});
