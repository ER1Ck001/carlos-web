import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CarFront, Eye, EyeOff, Handshake, Lock, Mail, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';
import { emailValido } from '../lib/format';
import { Botao, Campo, Input } from '../components/ui';
import { NOME_SISTEMA } from '../components/Layout';

const DESTAQUES = [
  { icone: CarFront, texto: 'Estoque em tempo real' },
  { icone: Handshake, texto: 'Vendas e comissões' },
  { icone: Wallet, texto: 'Fluxo financeiro' },
];

const USUARIOS_TESTE = [
  ['admin@concessionaria.local', 'Admin@123'],
  ['carla@concessionaria.local', 'Vendedor@123'],
];

const campoLogin = 'h-12 pl-10 bg-raised! focus:bg-surface!';

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
    <div className="relative min-h-dvh overflow-hidden bg-navy text-white">
      {/* foto espelhada: carro à esquerda, espaço livre à direita para o formulário */}
      <img
        src="/hero-carro.jpg"
        alt=""
        className="zoom-lento absolute inset-0 size-full object-cover object-[30%_center] -scale-x-100"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-navy via-navy/75 to-navy/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-transparent to-navy/70" />
      <div className="absolute -left-32 top-10 hidden lg:block h-[560px] w-[820px] rounded-full bg-navy/70 blur-[110px]" aria-hidden />
      <div className="absolute -right-40 top-1/3 size-[520px] rounded-full bg-brand/20 blur-[140px]" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1280px] flex-col px-5 sm:px-8">
        {/* topo */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center size-11 rounded-xl bg-brand shadow-lg shadow-brand/40">
              <CarFront className="size-6 text-white" />
            </span>
            <div className="leading-none">
              <p className="font-display text-xl font-bold">
                Auto<span className="text-brand">Gestor</span>
              </p>
              <p className="text-[11px] text-white/55 mt-1">Estoque da concessionária</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/75 backdrop-blur">
            <ShieldCheck className="size-3.5 text-brand" /> Acesso restrito à equipe
          </span>
        </header>

        <div className="grid flex-1 grid-cols-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_440px]">
          {/* chamada */}
          <section className="surgir hidden lg:flex flex-col self-start pt-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              <span className="size-1.5 rounded-full bg-brand" /> Gestão de concessionária
            </span>
            <h2 className="font-display mt-5 max-w-xl text-[56px] xl:text-[64px] font-extrabold leading-[1.02]">
              Cada veículo do pátio, <span className="text-brand">da entrada à venda.</span>
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/70">
              Estoque, clientes, vendas e financeiro da concessionária em um só lugar.
            </p>
            <ul className="mt-9 flex flex-wrap gap-3">
              {DESTAQUES.map(({ icone: Icone, texto }) => (
                <li
                  key={texto}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 backdrop-blur-md"
                >
                  <Icone className="size-4 text-brand" /> {texto}
                </li>
              ))}
            </ul>
          </section>

          {/* formulário */}
          <section className="surgir w-full max-w-[440px] justify-self-center lg:justify-self-end [animation-delay:120ms]">
            <div className="rounded-3xl bg-surface p-7 sm:p-9 text-ink shadow-2xl shadow-black/40">
              <h1 className="font-display text-[28px] font-bold leading-tight">Bem-vindo de volta</h1>
              <p className="text-sm text-muted mt-1.5 mb-7">Use o e-mail e a senha cadastrados pelo administrador.</p>

              <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
                <Campo rotulo="E-mail" erro={erros.email}>
                  {(id, inv) => (
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
                      <Input
                        id={id}
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        invalido={inv}
                        placeholder="nome@concessionaria.com"
                        className={campoLogin}
                      />
                    </div>
                  )}
                </Campo>
                <Campo rotulo="Senha" erro={erros.senha}>
                  {(id, inv) => (
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
                      <Input
                        id={id}
                        type={verSenha ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        invalido={inv}
                        placeholder="••••••••"
                        className={`${campoLogin} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setVerSenha((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint hover:text-ink"
                        aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  )}
                </Campo>

                {erro && (
                  <p role="alert" className="text-sm text-brand bg-brand-soft border border-brand/30 rounded-lg px-3 py-2">
                    {erro}
                  </p>
                )}

                <Botao type="submit" carregando={enviando} className="group mt-2 h-12 rounded-xl text-[15px] shadow-lg shadow-brand/30">
                  Entrar no sistema
                  {!enviando && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
                </Botao>
              </form>

              {import.meta.env.DEV && (
                <div className="mt-7 rounded-xl border border-dashed border-line-strong bg-raised/60 p-4 text-xs text-muted leading-relaxed">
                  <p className="text-ink font-semibold mb-1.5">Usuários de teste (clique para preencher)</p>
                  {USUARIOS_TESTE.map(([e, s]) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setEmail(e);
                        setSenha(s);
                      }}
                      className="-mx-1.5 block w-full rounded-md px-1.5 py-0.5 text-left hover:bg-surface hover:text-ink"
                    >
                      {e} · {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-5 text-center text-xs text-white/45">
              © {new Date().getFullYear()} {NOME_SISTEMA} · Sistema interno
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
