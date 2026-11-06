import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader } from 'mysql2';
import { dbOp } from '../../config/database.js';
import { autorizar } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/erros.js';
import { conflito, idParam, naoEncontrado, paginacao, texto, type Linha } from '../../utils/http.js';
import { cpfSchema, somenteDigitos, textoOpcional } from '../../utils/validacao.js';

export const clientesRoutes = Router();

clientesRoutes.get('/', async (req, res) => {
  const { page, pageSize, offset } = paginacao(req);
  const where: string[] = [];
  const params: unknown[] = [];

  const busca = texto(req.query.busca);
  if (busca) {
    const cond = ['c.nome LIKE ?', 'c.email LIKE ?'];
    params.push(`%${busca}%`, `%${busca}%`);
    const digitos = somenteDigitos(busca);
    if (digitos.length >= 3) {
      cond.push('c.cpf LIKE ?', "REGEXP_REPLACE(IFNULL(c.telefone, ''), '[^0-9]', '') LIKE ?");
      params.push(`%${digitos}%`, `%${digitos}%`);
    }
    where.push(`(${cond.join(' OR ')})`);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await dbOp.query<Linha[]>(`SELECT COUNT(*) AS total FROM clientes c ${sqlWhere}`, params);
  const [itens] = await dbOp.query<Linha[]>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM vendas v WHERE v.cliente_id = c.id) AS total_compras,
            (SELECT MAX(v.data_venda) FROM vendas v WHERE v.cliente_id = c.id) AS ultima_compra
       FROM clientes c ${sqlWhere}
      ORDER BY c.nome LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  res.json({ itens, total, page, pageSize });
});

/** Lista enxuta para selects (formulário de venda). */
clientesRoutes.get('/opcoes', async (_req, res) => {
  const [rows] = await dbOp.query<Linha[]>('SELECT id, nome, cpf FROM clientes ORDER BY nome');
  res.json(rows);
});

clientesRoutes.get('/:id', async (req, res) => {
  const id = idParam(req);
  const [rows] = await dbOp.query<Linha[]>('SELECT * FROM clientes WHERE id = ?', [id]);
  if (!rows[0]) throw naoEncontrado('Cliente');
  const [compras] = await dbOp.query<Linha[]>(
    `SELECT ve.id, ve.data_venda, ve.valor_venda, ve.desconto, (ve.valor_venda - ve.desconto) AS valor_liquido,
            ve.forma_pagamento, v.id AS veiculo_id, v.marca, v.modelo, v.ano, v.placa, u.nome AS vendedor_nome
       FROM vendas ve
       JOIN veiculos v ON v.id = ve.veiculo_id
       JOIN usuarios u ON u.id = ve.usuario_id
      WHERE ve.cliente_id = ? ORDER BY ve.data_venda DESC`,
    [id],
  );
  res.json({ ...rows[0], compras });
});

const clienteSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(150),
  cpf: cpfSchema,
  telefone: textoOpcional(20).refine(
    (v) => v === null || (somenteDigitos(v).length >= 10 && somenteDigitos(v).length <= 11),
    'Telefone inválido (DDD + número)',
  ),
  email: textoOpcional(160).refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido'),
  endereco: textoOpcional(255),
});

clientesRoutes.post('/', validar(clienteSchema), async (req, res) => {
  const d = req.body as z.infer<typeof clienteSchema>;
  const [r] = await dbOp.execute<ResultSetHeader>(
    'INSERT INTO clientes (nome, cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
    [d.nome, d.cpf, d.telefone, d.email?.toLowerCase() ?? null, d.endereco],
  );
  const [rows] = await dbOp.query<Linha[]>('SELECT * FROM clientes WHERE id = ?', [r.insertId]);
  res.status(201).json(rows[0]);
});

clientesRoutes.put('/:id', validar(clienteSchema), async (req, res) => {
  const id = idParam(req);
  const d = req.body as z.infer<typeof clienteSchema>;
  const [r] = await dbOp.execute<ResultSetHeader>(
    'UPDATE clientes SET nome = ?, cpf = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?',
    [d.nome, d.cpf, d.telefone, d.email?.toLowerCase() ?? null, d.endereco, id],
  );
  if (r.affectedRows === 0) throw naoEncontrado('Cliente');
  const [rows] = await dbOp.query<Linha[]>('SELECT * FROM clientes WHERE id = ?', [id]);
  res.json(rows[0]);
});

clientesRoutes.delete('/:id', autorizar('ADMIN'), async (req, res) => {
  const id = idParam(req);
  const [v] = await dbOp.query<Linha[]>('SELECT COUNT(*) AS n FROM vendas WHERE cliente_id = ?', [id]);
  if (v[0].n > 0) throw conflito('Cliente possui compras registradas e não pode ser excluído.');
  const [r] = await dbOp.execute<ResultSetHeader>('DELETE FROM clientes WHERE id = ?', [id]);
  if (r.affectedRows === 0) throw naoEncontrado('Cliente');
  res.status(204).end();
});
