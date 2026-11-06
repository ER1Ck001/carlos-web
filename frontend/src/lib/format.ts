const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const numeroFmt = new Intl.NumberFormat('pt-BR');

export const moeda = (v: number | null | undefined) => moedaFmt.format(Number(v ?? 0));
export const moedaCompacta = (v: number) => moedaCurta.format(v);
export const numero = (v: number | null | undefined) => numeroFmt.format(Number(v ?? 0));

/** Aceita 'YYYY-MM-DD' ou 'YYYY-MM-DD HH:mm:ss' (sem conversão de fuso). */
export function data(v: string | null | undefined) {
  if (!v) return '—';
  const [d] = v.split(' ');
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}
export function dataHora(v: string | null | undefined) {
  if (!v) return '—';
  const [d, h] = v.split(' ');
  return h ? `${data(d)} ${h.slice(0, 5)}` : data(d);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function mesCurto(yyyyMm: string) {
  const [a, m] = yyyyMm.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const inicioDoMes = () => hoje().slice(0, 8) + '01';

export const digitos = (v: string) => v.replace(/\D/g, '');

export function cpf(v: string | null | undefined) {
  const d = digitos(v ?? '');
  if (d.length !== 11) return v ?? '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function mascaraCpf(v: string) {
  const d = digitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function mascaraTelefone(v: string) {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function placa(v: string | null | undefined) {
  if (!v) return 'Sem placa';
  // placa antiga (ABC1234) leva hífen; Mercosul (ABC1D23) não
  return v.length === 7 && /\d/.test(v[4]) ? `${v.slice(0, 3)}-${v.slice(3)}` : v;
}

export function cpfValido(valor: string) {
  const c = digitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dig = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(c[9]) && dig(10) === Number(c[10]);
}

export const placaValida = (v: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v.toUpperCase().replace(/[^A-Z0-9]/gi, ''));
export const chassiValido = (v: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v.toUpperCase().replace(/\s/g, ''));
export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---------------------------------------------------------------- rótulos
export const STATUS_VEICULO: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
};

export const TIPO_MOV: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  RESERVA: 'Reserva',
  LIBERACAO: 'Liberação',
  TRANSFERENCIA: 'Transferência',
};

export const FORMA_PAGAMENTO: Record<string, string> = {
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  CARTAO_DEBITO: 'Cartão de débito',
  CARTAO_CREDITO: 'Cartão de crédito',
  BOLETO: 'Boleto',
  FINANCIAMENTO: 'Financiamento',
};

export const CATEGORIA_DESPESA: Record<string, string> = {
  ALUGUEL: 'Aluguel',
  SALARIOS: 'Salários',
  MANUTENCAO: 'Manutenção',
  MARKETING: 'Marketing',
  IMPOSTOS: 'Impostos',
  UTILIDADES: 'Água, luz e internet',
  COMPRA_VEICULO: 'Compra de veículo',
  OUTROS: 'Outros',
};

export const ORIGEM_FLUXO: Record<string, string> = {
  PAGAMENTO: 'Recebimento de venda',
  DESPESA: 'Despesa',
  COMISSAO: 'Comissão',
  MANUAL: 'Lançamento manual',
};

export const PERFIL: Record<string, string> = { ADMIN: 'Administrador', VENDEDOR: 'Vendedor' };
