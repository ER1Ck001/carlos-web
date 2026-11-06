import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { dbOp } from '../../config/database.js';
import { autenticar, gerarToken } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/erros.js';
import { HttpError, type Linha } from '../../utils/http.js';

export const authRoutes = Router();

// Limite simples de tentativas por IP + e-mail (10 em 15 min)
const tentativas = new Map<string, { qtd: number; ate: number }>();
const JANELA = 15 * 60 * 1000;
function registrarFalha(chave: string) {
  const agora = Date.now();
  const t = tentativas.get(chave);
  if (!t || t.ate < agora) tentativas.set(chave, { qtd: 1, ate: agora + JANELA });
  else t.qtd++;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});

authRoutes.post('/login', validar(loginSchema), async (req, res) => {
  const { email, senha } = req.body as z.infer<typeof loginSchema>;
  const chave = `${req.ip}:${email}`;
  const t = tentativas.get(chave);
  if (t && t.ate > Date.now() && t.qtd >= 10) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  }

  const [rows] = await dbOp.query<Linha[]>(
    'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ?',
    [email],
  );
  const u = rows[0];
  const ok = u ? await bcrypt.compare(senha, u.senha_hash) : false;

  if (!u || !ok) {
    registrarFalha(chave);
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }
  if (!u.ativo) throw new HttpError(403, 'Usuário desativado. Procure o administrador.');

  tentativas.delete(chave);
  const usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
  res.json({ token: gerarToken(usuario), usuario });
});

authRoutes.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

const senhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual'),
  novaSenha: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres').max(72),
});

authRoutes.patch('/senha', autenticar, validar(senhaSchema), async (req, res) => {
  const { senhaAtual, novaSenha } = req.body as z.infer<typeof senhaSchema>;
  const [rows] = await dbOp.query<Linha[]>('SELECT senha_hash FROM usuarios WHERE id = ?', [req.usuario!.id]);
  if (!(await bcrypt.compare(senhaAtual, rows[0].senha_hash))) {
    throw new HttpError(400, 'Senha atual incorreta.');
  }
  const hash = await bcrypt.hash(novaSenha, 10);
  await dbOp.execute('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [hash, req.usuario!.id]);
  res.json({ mensagem: 'Senha alterada com sucesso.' });
});
