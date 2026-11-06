import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { dbOp } from '../config/database.js';
import { HttpError, type Linha } from '../utils/http.js';

export type Perfil = 'ADMIN' | 'VENDEDOR';

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export function gerarToken(u: UsuarioAutenticado) {
  return jwt.sign({ sub: String(u.id), perfil: u.perfil }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Valida o token e confirma no banco que o usuário continua ativo
 * (um usuário desativado perde o acesso imediatamente).
 */
export async function autenticar(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Faça login para continuar.');

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, 'Sessão expirada ou inválida. Faça login novamente.');
  }

  const [rows] = await dbOp.query<Linha[]>(
    'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?',
    [Number(payload.sub)],
  );
  const u = rows[0];
  if (!u || !u.ativo) throw new HttpError(401, 'Usuário inativo ou inexistente.');

  req.usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
  next();
}

export const autorizar =
  (...perfis: Perfil[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      throw new HttpError(403, 'Você não tem permissão para esta ação.');
    }
    next();
  };

export const ehAdmin = (req: Request) => req.usuario?.perfil === 'ADMIN';
