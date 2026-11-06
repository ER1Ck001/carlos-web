import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { ResultSetHeader } from 'mysql2';
import { dbOp } from '../../config/database.js';
import { autorizar } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/erros.js';
import { HttpError, idParam, naoEncontrado, type Linha } from '../../utils/http.js';

export const usuariosRoutes = Router();

const CAMPOS = 'id, nome, email, perfil, ativo, data_criacao';

/** Lista de vendedores ativos (usada no formulário de venda). Qualquer perfil. */
usuariosRoutes.get('/vendedores', async (_req, res) => {
  const [rows] = await dbOp.query<Linha[]>(
    'SELECT id, nome, perfil FROM usuarios WHERE ativo = 1 ORDER BY nome',
  );
  res.json(rows);
});

usuariosRoutes.use(autorizar('ADMIN'));

usuariosRoutes.get('/', async (_req, res) => {
  const [rows] = await dbOp.query<Linha[]>(
    `SELECT ${CAMPOS},
            (SELECT COUNT(*) FROM vendas v WHERE v.usuario_id = u.id) AS total_vendas
       FROM usuarios u ORDER BY ativo DESC, nome`,
  );
  res.json(rows);
});

const baseSchema = {
  nome: z.string().trim().min(3, 'Informe o nome completo').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(160),
  perfil: z.enum(['ADMIN', 'VENDEDOR'], { error: 'Perfil inválido' }),
};

const criarSchema = z.object({
  ...baseSchema,
  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(72),
});

usuariosRoutes.post('/', validar(criarSchema), async (req, res) => {
  const d = req.body as z.infer<typeof criarSchema>;
  const hash = await bcrypt.hash(d.senha, 10);
  const [r] = await dbOp.execute<ResultSetHeader>(
    'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
    [d.nome, d.email, hash, d.perfil],
  );
  const [rows] = await dbOp.query<Linha[]>(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [r.insertId]);
  res.status(201).json(rows[0]);
});

const editarSchema = z.object({
  ...baseSchema,
  ativo: z.boolean(),
  senha: z
    .string()
    .max(72)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || v.length >= 8, 'A senha deve ter pelo menos 8 caracteres'),
});

usuariosRoutes.put('/:id', validar(editarSchema), async (req, res) => {
  const id = idParam(req);
  const d = req.body as z.infer<typeof editarSchema>;

  const [atual] = await dbOp.query<Linha[]>('SELECT id, perfil, ativo FROM usuarios WHERE id = ?', [id]);
  if (!atual[0]) throw naoEncontrado('Usuário');

  if (id === req.usuario!.id && (!d.ativo || d.perfil !== 'ADMIN')) {
    throw new HttpError(400, 'Você não pode desativar nem rebaixar o próprio usuário.');
  }

  // Garante que sempre reste ao menos um administrador ativo
  if (atual[0].perfil === 'ADMIN' && (d.perfil !== 'ADMIN' || !d.ativo)) {
    const [adm] = await dbOp.query<Linha[]>(
      "SELECT COUNT(*) AS n FROM usuarios WHERE perfil = 'ADMIN' AND ativo = 1 AND id <> ?",
      [id],
    );
    if (adm[0].n === 0) throw new HttpError(400, 'O sistema precisa ter pelo menos um administrador ativo.');
  }

  if (d.senha) {
    const hash = await bcrypt.hash(d.senha, 10);
    await dbOp.execute(
      'UPDATE usuarios SET nome = ?, email = ?, perfil = ?, ativo = ?, senha_hash = ? WHERE id = ?',
      [d.nome, d.email, d.perfil, d.ativo ? 1 : 0, hash, id],
    );
  } else {
    await dbOp.execute('UPDATE usuarios SET nome = ?, email = ?, perfil = ?, ativo = ? WHERE id = ?', [
      d.nome,
      d.email,
      d.perfil,
      d.ativo ? 1 : 0,
      id,
    ]);
  }
  const [rows] = await dbOp.query<Linha[]>(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [id]);
  res.json(rows[0]);
});
