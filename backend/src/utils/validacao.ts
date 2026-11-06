import { z } from 'zod';

export const somenteDigitos = (v: string) => v.replace(/\D/g, '');

export function cpfValido(valor: string) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dig = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(cpf[9]) && dig(10) === Number(cpf[10]);
}

/** Campo de texto opcional: "" ou espaços viram null. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

export const cpfSchema = z
  .string({ error: 'CPF é obrigatório' })
  .transform(somenteDigitos)
  .refine(cpfValido, 'CPF inválido');

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). Opcional. */
export const placaSchema = z
  .string()
  .nullish()
  .transform((v) => (v ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : null))
  .refine((v) => v === null || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v), 'Placa inválida (use ABC1234 ou ABC1D23)');

/** Chassi (VIN) com 17 caracteres, sem I, O e Q. Opcional. */
export const chassiSchema = z
  .string()
  .nullish()
  .transform((v) => (v ? v.toUpperCase().replace(/\s/g, '') : null))
  .refine((v) => v === null || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), 'Chassi inválido (17 caracteres, sem I, O ou Q)');

export const valorMonetario = (campo: string) =>
  z.coerce
    .number({ error: `${campo} deve ser um número` })
    .min(0, `${campo} não pode ser negativo`)
    .max(9_999_999_999.99, `${campo} muito alto`)
    .transform((v) => Math.round(v * 100) / 100);

export const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)');

export const FORMAS_PAGAMENTO = ['PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'BOLETO', 'FINANCIAMENTO'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];
