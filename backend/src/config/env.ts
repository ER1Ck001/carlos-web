import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
// backend/.env (funciona tanto em src/ quanto em dist/)
dotenv.config({ path: path.resolve(here, '../../.env'), quiet: true });

const identificador = z
  .string()
  .regex(/^[A-Za-z0-9_]+$/, 'use apenas letras, números e _');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string({ error: 'obrigatório (usuário do MySQL)' }).min(1, 'obrigatório (usuário do MySQL)'),
  DB_PASSWORD: z.string().default(''),
  DB_CONCESSIONARIA: identificador.default('concessionaria_db'),
  DB_FINANCEIRO: identificador.default('financeiro_db'),

  JWT_SECRET: z.string({ error: 'obrigatório (texto secreto com 16+ caracteres)' }).min(16, 'deve ter pelo menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  COMISSAO_PERCENTUAL_PADRAO: z.coerce.number().min(0).max(100).default(2),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n[config] Variáveis de ambiente inválidas. Confira backend/.env (modelo em .env.example):');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
