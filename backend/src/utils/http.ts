import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalhes?: unknown,
  ) {
    super(message);
  }
}

export const naoEncontrado = (o = 'Registro') => new HttpError(404, `${o} não encontrado.`);
export const conflito = (msg: string) => new HttpError(409, msg);
export const requisicaoInvalida = (msg: string) => new HttpError(400, msg);

export type Linha = RowDataPacket & Record<string, any>;

/** Lê e valida o :id da rota. */
export function idParam(req: Request, nome = 'id'): number {
  const id = Number(req.params[nome]);
  if (!Number.isInteger(id) || id <= 0) throw requisicaoInvalida('Identificador inválido.');
  return id;
}

/** Paginação a partir de ?page=&pageSize= */
export function paginacao(req: Request, padrao = 20) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || padrao));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

/** Arredonda para 2 casas evitando erros de ponto flutuante. */
export const dinheiro = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Data local no formato YYYY-MM-DD. */
export function hojeISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function somarMeses(iso: string, meses: number) {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  return hojeISO(alvo);
}

export function somarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split('-').map(Number);
  return hojeISO(new Date(a, m - 1, d + dias));
}

const reData = /^\d{4}-\d{2}-\d{2}$/;
/** Lê ?inicio=&fim= (YYYY-MM-DD). */
export function periodo(req: Request) {
  const inicio = typeof req.query.inicio === 'string' && reData.test(req.query.inicio) ? req.query.inicio : undefined;
  const fim = typeof req.query.fim === 'string' && reData.test(req.query.fim) ? req.query.fim : undefined;
  if (inicio && fim && inicio > fim) throw requisicaoInvalida('A data inicial não pode ser maior que a final.');
  return { inicio, fim };
}
