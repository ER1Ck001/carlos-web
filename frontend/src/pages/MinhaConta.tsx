import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useEnvio } from '../lib/useEnvio';
import { useAuth } from '../contexts/AuthContext';
import { PERFIL } from '../lib/format';
import { Botao, Cabecalho, Campo, Detalhes, Input, Painel } from '../components/ui';

export default function MinhaConta() {
  const { usuario } = useAuth();
  const [f, setF] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const { enviando, erros, enviar, validar } = useEnvio();

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const ok = validar({
      senhaAtual: !f.senhaAtual && 'Informe a senha atual',
      novaSenha: f.novaSenha.length < 8 && 'A nova senha deve ter pelo menos 8 caracteres',
      confirmar: f.confirmar !== f.novaSenha && 'As senhas não conferem',
    });
    if (!ok) return;
    const r = await enviar(() => api.patch('/auth/senha', { senhaAtual: f.senhaAtual, novaSenha: f.novaSenha }), 'Senha alterada.');
    if (r) setF({ senhaAtual: '', novaSenha: '', confirmar: '' });
  }

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Minha conta" />
      <div className="grid gap-5">
        <Painel titulo="Dados de acesso">
          <Detalhes
            itens={[
              ['Nome', usuario?.nome],
              ['E-mail', usuario?.email],
              ['Perfil', usuario ? PERFIL[usuario.perfil] : ''],
            ]}
          />
        </Painel>
        <Painel titulo="Alterar senha">
          <form onSubmit={salvar} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo rotulo="Senha atual" obrigatorio erro={erros.senhaAtual} className="sm:col-span-2">
              {(id, inv) => <Input id={id} type="password" autoComplete="current-password" value={f.senhaAtual} invalido={inv} onChange={(e) => setF({ ...f, senhaAtual: e.target.value })} />}
            </Campo>
            <Campo rotulo="Nova senha" obrigatorio erro={erros.novaSenha} ajuda="Mínimo de 8 caracteres.">
              {(id, inv) => <Input id={id} type="password" autoComplete="new-password" value={f.novaSenha} invalido={inv} onChange={(e) => setF({ ...f, novaSenha: e.target.value })} />}
            </Campo>
            <Campo rotulo="Confirmar nova senha" obrigatorio erro={erros.confirmar}>
              {(id, inv) => <Input id={id} type="password" autoComplete="new-password" value={f.confirmar} invalido={inv} onChange={(e) => setF({ ...f, confirmar: e.target.value })} />}
            </Campo>
            <div className="sm:col-span-2">
              <Botao type="submit" carregando={enviando}>
                Alterar senha
              </Botao>
            </div>
          </form>
        </Painel>
      </div>
    </div>
  );
}
