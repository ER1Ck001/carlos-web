import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, definirAoExpirar, token } from '../lib/api';

export type Perfil = 'ADMIN' | 'VENDEDOR';
export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
}

interface Ctx {
  usuario: Usuario | null;
  carregando: boolean;
  ehAdmin: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
}

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const sair = useCallback(() => {
    token.limpar();
    setUsuario(null);
  }, []);

  useEffect(() => {
    definirAoExpirar(sair);
    if (!token.get()) {
      setCarregando(false);
      return;
    }
    api
      .get<{ usuario: Usuario }>('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => token.limpar())
      .finally(() => setCarregando(false));
  }, [sair]);

  const entrar = async (email: string, senha: string) => {
    const r = await api.post<{ token: string; usuario: Usuario }>('/auth/login', { email, senha });
    token.set(r.token);
    setUsuario(r.usuario);
  };

  return (
    <AuthContext.Provider value={{ usuario, carregando, ehAdmin: usuario?.perfil === 'ADMIN', entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
