const BASE = import.meta.env.VITE_API_URL ?? '/api';
const CHAVE_TOKEN = 'concessionaria.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public campos: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const token = {
  get: () => {
    try {
      return localStorage.getItem(CHAVE_TOKEN);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(CHAVE_TOKEN, t);
    } catch {
      /* armazenamento indisponível */
    }
  },
  limpar: () => {
    try {
      localStorage.removeItem(CHAVE_TOKEN);
    } catch {
      /* ignore */
    }
  },
};

let aoExpirar: (() => void) | null = null;
export const definirAoExpirar = (fn: () => void) => {
  aoExpirar = fn;
};

type Query = Record<string, string | number | boolean | null | undefined>;

function montarUrl(caminho: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return `${BASE}${caminho}${qs ? `?${qs}` : ''}`;
}

async function requisicao<T>(metodo: string, caminho: string, corpo?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(montarUrl(caminho, query), {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique se o backend está rodando.');
  }

  if (res.status === 204) return undefined as T;

  let dados: any = null;
  try {
    dados = await res.json();
  } catch {
    /* resposta sem JSON */
  }

  if (!res.ok) {
    if (res.status === 401 && t) aoExpirar?.();
    throw new ApiError(res.status, dados?.erro ?? `Erro ${res.status}`, dados?.campos ?? {});
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string, query?: Query) => requisicao<T>('GET', caminho, undefined, query),
  post: <T>(caminho: string, corpo?: unknown) => requisicao<T>('POST', caminho, corpo ?? {}),
  put: <T>(caminho: string, corpo: unknown) => requisicao<T>('PUT', caminho, corpo),
  patch: <T>(caminho: string, corpo?: unknown) => requisicao<T>('PATCH', caminho, corpo ?? {}),
  delete: (caminho: string) => requisicao<void>('DELETE', caminho),
};

export interface Paginado<T> {
  itens: T[];
  total: number;
  page: number;
  pageSize: number;
}
