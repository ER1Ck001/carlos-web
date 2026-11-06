import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader } from 'mysql2';
import { dbOp, transacao } from '../../config/database.js';
import { validar } from '../../middlewares/erros.js';
import { conflito, naoEncontrado, paginacao, periodo, requisicaoInvalida, texto, type Linha } from '../../utils/http.js';
import { textoOpcional } from '../../utils/validacao.js';

export const estoqueRoutes = Router();

const TIPOS = ['ENTRADA', 'SAIDA', 'RESERVA', 'LIBERACAO', 'TRANSFERENCIA'] as const;

estoqueRoutes.get('/', async (req, res) => {
  const { page, pageSize, offset } = paginacao(req, 25);
  const { inicio, fim } = periodo(req);
  const where: string[] = [];
  const params: unknown[] = [];

  const tipo = texto(req.query.tipo);
  if (tipo && (TIPOS as readonly string[]).includes(tipo)) {
    where.push('e.tipo_movimentacao = ?');
    params.push(tipo);
  }
  const veiculoId = Number(req.query.veiculo_id);
  if (Number.isInteger(veiculoId) && veiculoId > 0) {
    where.push('e.veiculo_id = ?');
    params.push(veiculoId);
  }
  if (inicio) {
    where.push('e.data_movimentacao >= ?');
    params.push(inicio);
  }
  if (fim) {
    where.push('e.data_movimentacao < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(fim);
  }
  const busca = texto(req.query.busca);
  if (busca) {
    where.push("(CONCAT(v.marca, ' ', v.modelo) LIKE ? OR v.placa LIKE ?)");
    params.push(`%${busca}%`, `%${busca.toUpperCase()}%`);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM estoque e JOIN veiculos v ON v.id = e.veiculo_id JOIN usuarios u ON u.id = e.usuario_id ${sqlWhere}`;

  const [[{ total }]] = await dbOp.query<Linha[]>(`SELECT COUNT(*) AS total ${from}`, params);
  const [itens] = await dbOp.query<Linha[]>(
    `SELECT e.*, v.marca, v.modelo, v.ano, v.placa, v.status AS veiculo_status, u.nome AS usuario_nome
       ${from} ORDER BY e.data_movimentacao DESC, e.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  res.json({ itens, total, page, pageSize });
});

/**
 * Movimentações manuais:
 *  RESERVA       DISPONIVEL -> RESERVADO
 *  LIBERACAO     RESERVADO  -> DISPONIVEL
 *  TRANSFERENCIA muda a localização (exige localização)
 * ENTRADA e SAIDA são geradas automaticamente pelo cadastro e pela venda.
 */
const movSchema = z.object({
  veiculo_id: z.coerce.number({ error: 'Selecione o veículo' }).int().positive('Selecione o veículo'),
  tipo_movimentacao: z.enum(['RESERVA', 'LIBERACAO', 'TRANSFERENCIA'], {
    error: 'Tipo deve ser RESERVA, LIBERACAO ou TRANSFERENCIA',
  }),
  localizacao: textoOpcional(80),
  observacao: textoOpcional(255),
});

estoqueRoutes.post('/', validar(movSchema), async (req, res) => {
  const d = req.body as z.infer<typeof movSchema>;
  if (d.tipo_movimentacao === 'TRANSFERENCIA' && !d.localizacao) {
    throw requisicaoInvalida('Informe a nova localização para a transferência.');
  }

  const id = await transacao(dbOp, async (conn) => {
    const [v] = await conn.query<Linha[]>('SELECT id, status FROM veiculos WHERE id = ? FOR UPDATE', [d.veiculo_id]);
    if (!v[0]) throw naoEncontrado('Veículo');
    const status = v[0].status as string;

    if (status === 'VENDIDO') throw conflito('Veículo já vendido: não há movimentações de estoque possíveis.');
    if (d.tipo_movimentacao === 'RESERVA') {
      if (status !== 'DISPONIVEL') throw conflito('Só é possível reservar veículos disponíveis.');
      await conn.execute("UPDATE veiculos SET status = 'RESERVADO' WHERE id = ?", [d.veiculo_id]);
    }
    if (d.tipo_movimentacao === 'LIBERACAO') {
      if (status !== 'RESERVADO') throw conflito('Este veículo não está reservado.');
      await conn.execute("UPDATE veiculos SET status = 'DISPONIVEL' WHERE id = ?", [d.veiculo_id]);
    }

    const [r] = await conn.execute<ResultSetHeader>(
      `INSERT INTO estoque (veiculo_id, tipo_movimentacao, quantidade, localizacao, observacao, usuario_id)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [d.veiculo_id, d.tipo_movimentacao, d.localizacao, d.observacao, req.usuario!.id],
    );
    return r.insertId;
  });

  const [rows] = await dbOp.query<Linha[]>('SELECT * FROM estoque WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});
