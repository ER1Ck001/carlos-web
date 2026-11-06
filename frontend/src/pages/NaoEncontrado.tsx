import { Link } from 'react-router-dom';
import { Botao } from '../components/ui';

export default function NaoEncontrado() {
  return (
    <div className="flex flex-col items-center text-center py-24">
      <p className="font-display text-7xl font-bold text-brand">404</p>
      <h1 className="font-display text-2xl font-semibold mt-2">Página não encontrada</h1>
      <p className="text-muted mt-2 text-sm">O endereço não existe ou foi removido.</p>
      <Link to="/" className="mt-6">
        <Botao variante="secundario">Voltar ao dashboard</Botao>
      </Link>
    </div>
  );
}
