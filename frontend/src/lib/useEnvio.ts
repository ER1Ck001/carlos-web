import { useState } from 'react';
import { ApiError } from './api';
import { useToast } from '../contexts/ToastContext';

/**
 * Controla o envio de formulários: estado de carregamento, erros por campo
 * (vindos da validação local ou do backend) e mensagens de sucesso/erro.
 */
export function useEnvio() {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function enviar<T>(fn: () => Promise<T>, sucesso?: string): Promise<T | undefined> {
    setEnviando(true);
    try {
      const r = await fn();
      setErros({});
      if (sucesso) toast.sucesso(sucesso);
      return r;
    } catch (e) {
      if (e instanceof ApiError) {
        if (Object.keys(e.campos).length) setErros(e.campos);
        toast.erro(e.message);
      } else {
        toast.erro('Erro inesperado. Tente novamente.');
      }
      return undefined;
    } finally {
      setEnviando(false);
    }
  }

  /** Retorna true quando não há erros locais (e os exibe se houver). */
  function validar(locais: Record<string, string | false | undefined>) {
    const encontrados = Object.fromEntries(Object.entries(locais).filter(([, v]) => v)) as Record<string, string>;
    setErros(encontrados);
    if (Object.keys(encontrados).length) toast.erro('Verifique os campos destacados.');
    return Object.keys(encontrados).length === 0;
  }

  return { enviando, erros, setErros, enviar, validar };
}
