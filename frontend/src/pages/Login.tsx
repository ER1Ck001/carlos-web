import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';
import { emailValido } from '../lib/format';
import { Botao, Campo, Input } from '../components/ui';
import { NOME_SISTEMA } from '../components/Layout';

export default function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const locais: Record<string, string> = {};
    if (!emailValido(email.trim())) locais.email = 'Informe um e-mail válido';
    if (!senha) locais.senha = 'Informe a senha';
    setErros(locais);
    setErro('');
    if (Object.keys(locais).length) return;

    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      navegar('/', { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden lg:block overflow-hidden">
        <img src="/showroom.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/30 to-base/10" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <p className="font-display text-5xl font-bold leading-[0.95] tracking-wide max-w-md">
            Cada veículo do pátio, da entrada à venda.
          </p>
          <p className="text-muted mt-4 max-w-md">
            Estoque, clientes, vendas e financeiro da concessionária em um só lugar.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <span className="grid place-items-center size-11 rounded-xl bg-brand">
              <CarFront className="size-6 text-white" />
            </span>
            <div>
              <p className="font-display text-2xl font-bold tracking-wide leading-none">{NOME_SISTEMA}</p>
              <p className="text-xs text-faint mt-1">Estoque da concessionária</p>
            </div>
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-wide">Entrar</h1>
          <p className="text-sm text-muted mt-1 mb-7">Use o e-mail e a senha cadastrados pelo administrador.</p>

          <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
            <Campo rotulo="E-mail" erro={erros.email}>
              {(id, inv) => (
                <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} invalido={inv} placeholder="nome@concessionaria.com" />
              )}
            </Campo>
            <Campo rotulo="Senha" erro={erros.senha}>
              {(id, inv) => (
                <div className="relative">
                  <Input
                    id={id}
                    type={verSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    invalido={inv}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-faint hover:text-ink"
                    aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Campo>

            {erro && (
              <p role="alert" className="text-sm text-brand bg-brand-soft border border-brand/30 rounded-md px-3 py-2">
                {erro}
              </p>
            )}

            <Botao type="submit" carregando={enviando} icone={<LogIn className="size-4" />} className="mt-2 h-11">
              Entrar
            </Botao>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-lg border border-line bg-surface p-4 text-xs text-muted leading-relaxed">
              <p className="text-ink font-medium mb-1">Usuários de teste</p>
              <p>admin@concessionaria.local · Admin@123</p>
              <p>carla@concessionaria.local · Vendedor@123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
