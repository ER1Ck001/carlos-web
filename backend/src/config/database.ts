import mysql, { type Pool, type PoolConnection, type PoolOptions } from 'mysql2/promise';
import { env } from './env.js';

/**
 * Dois pools independentes, um para cada banco:
 *  - dbOp  -> concessionaria_db (operação)
 *  - dbFin -> financeiro_db     (financeiro)
 *
 * Operações que precisam ser atômicas nos dois bancos (ex.: registrar uma venda
 * e gerar seus pagamentos/comissão) usam UMA conexão do pool operacional e
 * referenciam as tabelas financeiras pelo nome qualificado (financeiro_db.tabela).
 * Como os dois bancos estão no mesmo servidor MySQL (InnoDB), o COMMIT/ROLLBACK
 * vale para ambos.
 */

const base: PoolOptions = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  ssl: env.DB_SSL
    ? { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}) }
    : undefined,
  dateStrings: true, // DATE/DATETIME chegam como texto, sem conversão de fuso
  decimalNumbers: true, // DECIMAL chega como number
  charset: 'utf8mb4',
};

export const dbOp: Pool = mysql.createPool({ ...base, database: env.DB_CONCESSIONARIA });
export const dbFin: Pool = mysql.createPool({ ...base, database: env.DB_FINANCEIRO });

/** Nome qualificado e escapado de uma tabela do banco financeiro. */
export const FIN = (tabela: string) => `\`${env.DB_FINANCEIRO}\`.\`${tabela}\``;
/** Nome qualificado e escapado de uma tabela do banco operacional. */
export const OP = (tabela: string) => `\`${env.DB_CONCESSIONARIA}\`.\`${tabela}\``;

/** Executa uma função dentro de uma transação, com commit/rollback automático. */
export async function transacao<T>(pool: Pool, fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

export interface StatusBanco {
  banco: string;
  ok: boolean;
  erro?: string;
}

export async function verificarBancos(): Promise<StatusBanco[]> {
  const testar = async (pool: Pool, banco: string): Promise<StatusBanco> => {
    try {
      await pool.query('SELECT 1');
      return { banco, ok: true };
    } catch (err) {
      return { banco, ok: false, erro: (err as Error).message };
    }
  };
  return Promise.all([testar(dbOp, env.DB_CONCESSIONARIA), testar(dbFin, env.DB_FINANCEIRO)]);
}

export async function fecharBancos() {
  await Promise.allSettled([dbOp.end(), dbFin.end()]);
}
