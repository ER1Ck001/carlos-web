import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { HttpError } from '../utils/http.js';

/** Valida req.body com um schema zod e substitui pelo valor tratado. */
export const validar =
  (schema: ZodType) =>
  (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };

const MENSAGENS_CONEXAO: Record<string, string> = {
  ECONNREFUSED: 'Não foi possível conectar ao MySQL. Verifique se o servidor está em execução e se DB_HOST/DB_PORT estão corretos.',
  ENOTFOUND: 'Servidor MySQL não encontrado. Verifique DB_HOST.',
  ETIMEDOUT: 'Tempo de conexão com o MySQL esgotado.',
  ER_ACCESS_DENIED_ERROR: 'Acesso negado ao MySQL. Verifique DB_USER e DB_PASSWORD no arquivo .env.',
  ER_BAD_DB_ERROR: 'Banco de dados não encontrado. Execute os scripts 01 e 02 no MySQL Workbench.',
  ER_NO_SUCH_TABLE: 'Tabela não encontrada. Execute novamente os scripts SQL da pasta database.',
  PROTOCOL_CONNECTION_LOST: 'A conexão com o MySQL foi perdida. Tente novamente.',
};

function mensagemDuplicidade(msg: string) {
  if (msg.includes('placa')) return 'Já existe um veículo com esta placa.';
  if (msg.includes('chassi')) return 'Já existe um veículo com este chassi.';
  if (msg.includes('cpf')) return 'Já existe um cliente com este CPF.';
  if (msg.includes('email')) return 'Este e-mail já está em uso.';
  if (msg.includes('uk_vendas_veiculo')) return 'Este veículo já foi vendido.';
  return 'Registro duplicado.';
}

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.detalhes });
  }

  if (err instanceof ZodError) {
    const campos: Record<string, string> = {};
    for (const issue of err.issues) {
      const chave = issue.path.join('.') || '_';
      campos[chave] ??= issue.message;
    }
    return res.status(400).json({ erro: 'Verifique os campos informados.', campos });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ erro: 'JSON inválido na requisição.' });
  }

  const e = err as { code?: string; message?: string };
  if (e.code && MENSAGENS_CONEXAO[e.code]) {
    console.error(`[db] ${e.code}: ${e.message}`);
    return res.status(503).json({ erro: MENSAGENS_CONEXAO[e.code] });
  }
  if (e.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: mensagemDuplicidade(e.message ?? '') });
  }
  if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ erro: 'Não é possível excluir: existem registros vinculados.' });
  }
  if (e.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(400).json({ erro: 'Valor inválido: verifique preços, quantidades e descontos.' });
  }
  if (e.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ erro: 'Registro relacionado não existe.' });
  }

  console.error('[erro]', err);
  return res.status(500).json({ erro: 'Erro interno no servidor. Tente novamente.' });
}
