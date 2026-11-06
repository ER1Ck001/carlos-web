import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import { Carregando } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Veiculos from './pages/Veiculos';
import VeiculoDetalhe from './pages/VeiculoDetalhe';
import Estoque from './pages/Estoque';
import Clientes from './pages/Clientes';
import ClienteDetalhe from './pages/ClienteDetalhe';
import Vendas from './pages/Vendas';
import NovaVenda from './pages/NovaVenda';
import VendaDetalhe from './pages/VendaDetalhe';
import Financeiro from './pages/Financeiro';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import MinhaConta from './pages/MinhaConta';
import NaoEncontrado from './pages/NaoEncontrado';

/** Exige login; com somenteAdmin, também exige perfil de administrador. */
function Protegida({ children, somenteAdmin }: { children: ReactNode; somenteAdmin?: boolean }) {
  const { usuario, carregando, ehAdmin } = useAuth();
  if (carregando) return <Carregando texto="Verificando sessão…" />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (somenteAdmin && !ehAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Rotas() {
  const { usuario, carregando } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!carregando && usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="veiculos" element={<Veiculos />} />
        <Route path="veiculos/:id" element={<VeiculoDetalhe />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteDetalhe />} />
        <Route path="vendas" element={<Vendas />} />
        <Route path="vendas/nova" element={<NovaVenda />} />
        <Route path="vendas/:id" element={<VendaDetalhe />} />
        <Route path="financeiro" element={<Protegida somenteAdmin><Financeiro /></Protegida>} />
        <Route path="relatorios" element={<Protegida somenteAdmin><Relatorios /></Protegida>} />
        <Route path="usuarios" element={<Protegida somenteAdmin><Usuarios /></Protegida>} />
        <Route path="minha-conta" element={<MinhaConta />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Rotas />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
