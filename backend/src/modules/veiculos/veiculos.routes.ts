import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader } from 'mysql2';
import { dbOp, transacao } from '../../config/database.js';
import { autorizar } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/erros.js';
import { conflito, idParam, naoEncontrado, paginacao, texto, type Linha } from '../../utils/http.js';
import { chassiSchema, placaSchema, textoOpcional, valorMonetario } from '../../utils/validacao.js';

export const veiculosRoutes = Router();

const STATUS = ['DISPONIVEL', 'RESERVADO', 'VENDIDO'] as const;
const anoMax = new Date().getFullYear() + 1;

/** Localização atual = última movimentação que informou localização. */
const LOCALIZACAO_ATUAL = `(SELECT e.localizacao FROM estoque e
   WHERE e.veiculo_id = v.id AND e.localizacao IS NOT NULL
   ORDER BY e.data_movimentacao DESC, e.id DESC LIMIT 1)`;

veiculosRoutes.get('/', async (req, res) => {
  const { page, pageSize, offset } = paginacao(req);
  const where: string[] = [];
  const params: unknown[] = [];

  const busca = texto(req.query.busca);
  if (busca) {
    const like = `%${busca}%`;
    const cond = ['v.marca LIKE ?', 'v.modelo LIKE ?', 'v.placa LIKE ?', "CONCAT(v.marca, ' ', v.modelo) LIKE ?"];
    params.push(like, like, `%${busca.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`, like);
    if (/^\d{4}$/.test(busca)) {
      cond.push('v.ano = ?');
      params.push(Number(busca));
    }
    where.push(`(${cond.join(' OR ')})`);
  }
  const status = texto(req.query.status);
  if (status && (STATUS as readonly string[]).includes(status)) {
    where.push('v.status = ?');
    params.push(status);
  }
  const ano = Number(req.query.ano);
  if (Number.isInteger(ano) && ano > 1900) {
    where.push('v.ano = ?');
    params.push(ano);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await dbOp.query<Linha[]>(`SELECT COUNT(*) AS total FROM veiculos v ${sqlWhere}`, params);
  const [itens] = await dbOp.query<Linha[]>(
    `SELECT v.*, ${LOCALIZACAO_ATUAL} AS localizacao,
            DATEDIFF(NOW(), v.data_cadastro) AS dias_estoque
       FROM veiculos v ${sqlWhere}
      ORDER BY FIELD(v.status, 'DISPONIVEL', 'RESERVADO', 'VENDIDO'), v.data_cadastro DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  res.json({ itens, total, page, pageSize });
});

/** Veículos que podem ser vendidos (disponíveis ou reservados). */
veiculosRoutes.get('/vendaveis', async (_req, res) => {
  const [rows] = await dbOp.query<Linha[]>(
    `SELECT id, marca, modelo, ano, cor, placa, valor_venda, status
       FROM veiculos WHERE status IN ('DISPONIVEL', 'RESERVADO')
      ORDER BY marca, modelo`,
  );
  res.json(rows);
});

veiculosRoutes.get('/:id', async (req, res) => {
  const id = idParam(req);
  const [rows] = await dbOp.query<Linha[]>(
    `SELECT v.*, ${LOCALIZACAO_ATUAL} AS localizacao, DATEDIFF(NOW(), v.data_cadastro) AS dias_estoque
       FROM veiculos v WHERE v.id = ?`,
    [id],
  );
  if (!rows[0]) throw naoEncontrado('Veículo');

  const [movimentacoes] = await dbOp.query<Linha[]>(
    `SELECT e.*, u.nome AS usuario_nome FROM estoque e
       JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.veiculo_id = ? ORDER BY e.data_movimentacao DESC, e.id DESC`,
    [id],
  );
  const [venda] = await dbOp.query<Linha[]>(
    `SELECT ve.id, ve.data_venda, ve.valor_venda, ve.desconto, ve.forma_pagamento,
            (ve.valor_venda - ve.desconto) AS valor_liquido,
            c.id AS cliente_id, c.nome AS cliente_nome, u.nome AS vendedor_nome
       FROM vendas ve JOIN clientes c ON c.id = ve.cliente_id JOIN usuarios u ON u.id = ve.usuario_id
      WHERE ve.veiculo_id = ?`,
    [id],
  );
  res.json({ ...rows[0], movimentacoes, venda: venda[0] ?? null });
});

const veiculoSchema = z
  .object({
    marca: z.string().trim().min(2, 'Informe a marca').max(60),
    modelo: z.string().trim().min(1, 'Informe o modelo').max(80),
    ano: z.coerce
      .number({ error: 'Ano inválido' })
      .int('Ano inválido')
      .min(1950, 'Ano inválido')
      .max(anoMax, `Ano máximo: ${anoMax}`),
    cor: textoOpcional(40),
    placa: placaSchema,
    chassi: chassiSchema,
    quilometragem: z.coerce.number({ error: 'Quilometragem inválida' }).int().min(0, 'Quilometragem não pode ser negativa'),
    valor_compra: valorMonetario('Valor de compra'),
    valor_venda: valorMonetario('Valor de venda').refine((v) => v > 0, 'Informe o valor de venda'),
    observacoes: textoOpcional(2000),
    localizacao: textoOpcional(80),
  });

veiculosRoutes.post('/', autorizar('ADMIN'), validar(veiculoSchema), async (req, res) => {
  const d = req.body as z.infer<typeof veiculoSchema>;
  const id = await transacao(dbOp, async (conn) => {
    const [r] = await conn.execute<ResultSetHeader>(
      `INSERT INTO veiculos (marca, modelo, ano, cor, placa, chassi, quilometragem, valor_compra, valor_venda, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.marca, d.modelo, d.ano, d.cor, d.placa, d.chassi, d.quilometragem, d.valor_compra, d.valor_venda, d.observacoes],
    );
    await conn.execute(
      `INSERT INTO estoque (veiculo_id, tipo_movimentacao, quantidade, localizacao, observacao, usuario_id)
       VALUES (?, 'ENTRADA', 1, ?, 'Entrada no estoque (cadastro)', ?)`,
      [r.insertId, d.localizacao ?? 'Pátio', req.usuario!.id],
    );
    return r.insertId;
  });
  const [rows] = await dbOp.query<Linha[]>('SELECT * FROM veiculos WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

veiculosRoutes.put('/:id', autorizar('ADMIN'), validar(veiculoSchema), async (req, res) => {
  const id = idParam(req);
  const d = req.body as z.infer<typeof veiculoSchema>;
  const [atual] = await dbOp.query<Linha[]>('SELECT status FROM veiculos WHERE id = ?', [id]);
  if (!atual[0]) throw naoEncontrado('Veículo');

  if (atual[0].status === 'VENDIDO') {
    // Veículo vendido: preserva os dados da venda; só observações podem mudar.
    await dbOp.execute('UPDATE veiculos SET observacoes = ? WHERE id = ?', [d.observacoes, id]);
  } else {
    await dbOp.execute(
      `UPDATE veiculos SET marca = ?, modelo = ?, ano = ?, cor = ?, placa = ?, chassi = ?,
              quilometragem = ?, valor_compra = ?, valor_venda = ?, observacoes = ?
        WHERE id = ?`,
      [d.marca, d.modelo, d.ano, d.cor, d.placa, d.chassi, d.quilometragem, d.valor_compra, d.valor_venda, d.observacoes, id],
    );
  }
  const [rows] = await dbOp.query<Linha[]>('SELECT * FROM veiculos WHERE id = ?', [id]);
  res.json(rows[0]);
});

/**
 * Exclusão: só para veículos disponíveis e nunca vendidos (cadastro feito por engano).
 * As movimentações desse veículo são removidas junto, na mesma transação.
 * Veículos vendidos ou reservados não podem ser excluídos, preservando o histórico.
 */
veiculosRoutes.delete('/:id', autorizar('ADMIN'), async (req, res) => {
  const id = idParam(req);
  await transacao(dbOp, async (conn) => {
    const [v] = await conn.query<Linha[]>('SELECT status FROM veiculos WHERE id = ? FOR UPDATE', [id]);
    if (!v[0]) throw naoEncontrado('Veículo');
    const [vendas] = await conn.query<Linha[]>('SELECT COUNT(*) AS n FROM vendas WHERE veiculo_id = ?', [id]);
    if (v[0].status === 'VENDIDO' || vendas[0].n > 0) {
      throw conflito('Veículo vendido não pode ser excluído: o histórico de vendas deve ser preservado.');
    }
    if (v[0].status === 'RESERVADO') {
      throw conflito('Libere a reserva antes de excluir o veículo.');
    }
    await conn.execute('DELETE FROM estoque WHERE veiculo_id = ?', [id]);
    await conn.execute('DELETE FROM veiculos WHERE id = ?', [id]);
  });
  res.status(204).end();
});
