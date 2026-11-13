import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeftRight,
  CarFront,
  ChartColumn,
  Handshake,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PERFIL } from '../lib/format';
import { cx } from './ui';

export const NOME_SISTEMA = 'AutoGestor';

const MENU = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard, admin: false },
  { para: '/veiculos', rotulo: 'Veículos', icone: CarFront, admin: false },
  { para: '/estoque', rotulo: 'Estoque', icone: ArrowLeftRight, admin: false },
  { para: '/clientes', rotulo: 'Clientes', icone: Users, admin: false },
  { para: '/vendas', rotulo: 'Vendas', icone: Handshake, admin: false },
  { para: '/financeiro', rotulo: 'Financeiro', icone: Wallet, admin: true },
  { para: '/relatorios', rotulo: 'Relatórios', icone: ChartColumn, admin: true },
  { para: '/usuarios', rotulo: 'Usuários', icone: UserCog, admin: true },
];

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid place-items-center size-9 rounded-xl bg-brand shadow-lg shadow-brand/30">
        <CarFront className="size-5 text-white" />
      </span>
      <div className="leading-none">
        <p className="font-display text-lg font-bold text-white">
          Auto<span className="text-brand">Gestor</span>
        </p>
        <p className="text-[11px] text-white/50 mt-1">Estoque da concessionária</p>
      </div>
    </div>
  );
}

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const { usuario, ehAdmin, sair } = useAuth();
  const iniciais = usuario?.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 h-16 flex items-center">
        <Marca />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">
        <ul className="flex flex-col gap-0.5">
          {MENU.filter((m) => !m.admin || ehAdmin).map(({ para, rotulo, icone: Icone }) => (
            <li key={para}>
              <NavLink
                to={para}
                end={para === '/'}
                onClick={aoNavegar}
                className={({ isActive }) =>
                  cx(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                    isActive ? 'bg-brand text-white shadow-lg shadow-brand/25' : 'text-white/65 hover:text-white hover:bg-white/5',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icone className={cx('size-[18px]', isActive ? 'text-white' : 'text-white/45 group-hover:text-white')} />
                    {rotulo}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="grid place-items-center size-9 rounded-full bg-white/10 text-white text-xs font-semibold">
            {iniciais}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{usuario?.nome}</p>
            <p className="text-xs text-white/50">{usuario ? PERFIL[usuario.perfil] : ''}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <NavLink
            to="/minha-conta"
            onClick={aoNavegar}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] text-white/60 hover:text-white hover:bg-white/5"
          >
            <KeyRound className="size-4" /> Senha
          </NavLink>
          <button
            onClick={sair}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] text-white/60 hover:text-white hover:bg-brand"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const [aberto, setAberto] = useState(false);
  const local = useLocation();
  useEffect(() => setAberto(false), [local.pathname]);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* menu lateral fixo (desktop) */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-navy">
        <Navegacao />
      </aside>

      {/* barra superior (celular) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-navy/95 backdrop-blur">
        <Marca />
        <button onClick={() => setAberto(true)} className="p-2 -mr-2 text-white/70 hover:text-white" aria-label="Abrir menu">
          <Menu className="size-6" />
        </button>
      </header>

      {aberto && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setAberto(false)} aria-hidden />
          <aside className="animar-entrada absolute inset-y-0 left-0 w-72 max-w-[85%] bg-navy">
            <button onClick={() => setAberto(false)} className="absolute right-3 top-4 p-1 text-white/70" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            <Navegacao aoNavegar={() => setAberto(false)} />
          </aside>
        </div>
      )}

      <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-9 max-w-[1440px]">
        <Outlet />
      </main>
    </div>
  );
}
