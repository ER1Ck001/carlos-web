import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

/** Carrega dados de uma função assíncrona e expõe recarregar(). */
export function useApi<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const seq = useRef(0);

  const executar = useCallback(async () => {
    const atual = ++seq.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await carregar();
      if (atual === seq.current) setDados(r);
    } catch (e) {
      if (atual === seq.current) setErro(e instanceof ApiError ? e.message : 'Erro inesperado ao carregar os dados.');
    } finally {
      if (atual === seq.current) setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    executar();
  }, [executar]);

  return { dados, erro, carregando, recarregar: executar };
}

/** Valor com atraso (para campos de busca). */
export function useDebounce<T>(valor: T, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}
