import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useEnvio } from '../lib/useEnvio';
import { useAuth } from '../contexts/AuthContext';
import { data, emailValido, PERFIL } from '../lib/format';
import { Badge, Botao, Cabecalho, Campo, Carregando, ErroCarregar, Input, Modal, Painel, Select, Tabela, Td, Th } from '../components/ui';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'VENDEDOR';
  ativo: number;
  data_criacao: string;
  total_vendas: number;
}

function UsuarioForm({ aberto, fechar, usuario, salvo }: { aberto: boolean; fechar: () => void; usuario: Usuario | null; salvo: () => void }) {
  const { usuario: eu } = useAuth();
  const [f, setF] = useState({ nome: '', email: '', perfil: 'VENDEDOR', ativo: true, senha: '' });
  const { enviando, erros, setErros, enviar, validar } = useEnvio();
  const proprio = usuario?.id === eu?.id;

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setF(usuario ? { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, ativo: !!usuario.ativo, senha: '' } : { nome: '', email: '', perfil: 'VENDEDOR', ativo: true, senha: '' });
  }, [aberto, usuario, setErros]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const ok = validar({
      nome: f.nome.trim().length < 3 && 'Informe o nome completo',
      email: !emailValido(f.email.trim()) && 'E-mail inválido',
      senha: (!usuario || f.senha) && f.senha.length < 8 && 'A senha deve ter pelo menos 8 caracteres',
    });
    if (!ok) return;
    const r = await enviar(
      () => (usuario ? api.put(`/usuarios/${usuario.id}`, f) : api.post('/usuarios', { nome: f.nome, email: f.email, perfil: f.perfil, senha: f.senha })),
      usuario ? 'Usuário atualizado.' : 'Usuário criado.',
    );
    if (r) {
      salvo();
      fechar();
    }
  }

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo={usuario ? 'Editar usuário' : 'Novo usuário'}
      largura="max-w-lg"
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-usuario" carregando={enviando}>
            {usuario ? 'Salvar alterações' : 'Criar usuário'}
          </Botao>
        </>
      }
    >
      <form id="form-usuario" onSubmit={salvar} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo rotulo="Nome" obrigatorio erro={erros.nome} className="sm:col-span-2">
          {(id, inv) => <Input id={id} value={f.nome} invalido={inv} onChange={(e) => setF({ ...f, nome: e.target.value })} />}
        </Campo>
        <Campo rotulo="E-mail" obrigatorio erro={erros.email} className="sm:col-span-2">
          {(id, inv) => <Input id={id} type="email" autoComplete="off" value={f.email} invalido={inv} onChange={(e) => setF({ ...f, email: e.target.value })} />}
        </Campo>
        <Campo rotulo="Perfil" obrigatorio ajuda={proprio ? 'Você não pode alterar o próprio perfil.' : undefined}>
          {(id) => (
            <Select id={id} value={f.perfil} disabled={proprio} onChange={(e) => setF({ ...f, perfil: e.target.value })}>
              <option value="VENDEDOR">Vendedor</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          )}
        </Campo>
        {usuario && (
          <Campo rotulo="Situação">
            {(id) => (
              <Select id={id} value={f.ativo ? '1' : '0'} disabled={proprio} onChange={(e) => setF({ ...f, ativo: e.target.value === '1' })}>
                <option value="1">Ativo</option>
                <option value="0">Inativo (sem acesso)</option>
              </Select>
            )}
          </Campo>
        )}
        <Campo rotulo={usuario ? 'Nova senha' : 'Senha'} obrigatorio={!usuario} erro={erros.senha} ajuda={usuario ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 8 caracteres.'} className="sm:col-span-2">
          {(id, inv) => <Input id={id} type="password" autoComplete="new-password" value={f.senha} invalido={inv} onChange={(e) => setF({ ...f, senha: e.target.value })} />}
        </Campo>
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const { dados, erro, carregando, recarregar } = useApi(() => api.get<Usuario[]>('/usuarios'), []);
  const [form, setForm] = useState<{ aberto: boolean; usuario: Usuario | null }>({ aberto: false, usuario: null });

  return (
    <div>
      <Cabecalho
        titulo="Usuários"
        descricao="Quem acessa o sistema. Administradores veem tudo; vendedores veem estoque, clientes e as próprias vendas."
        acoes={
          <Botao icone={<Plus className="size-4" />} onClick={() => setForm({ aberto: true, usuario: null })}>
            Novo usuário
          </Botao>
        }
      />
      <Painel semPadding>
        {carregando && !dados ? (
          <Carregando />
        ) : erro || !dados ? (
          <ErroCarregar mensagem={erro ?? ''} tentar={recarregar} />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Perfil</Th>
                <Th>Situação</Th>
                <Th className="text-right">Vendas</Th>
                <Th>Criado em</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {dados.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'opacity-60'}>
                  <Td>
                    <p className="font-medium">{u.nome}</p>
                    <p className="text-xs text-faint">{u.email}</p>
                  </Td>
                  <Td>
                    <Badge valor={u.perfil} rotulo={PERFIL[u.perfil]} />
                  </Td>
                  <Td>{u.ativo ? <Badge valor="DISPONIVEL" rotulo="Ativo" /> : <Badge valor="INATIVO" rotulo="Inativo" />}</Td>
                  <Td className="text-right">{u.total_vendas}</Td>
                  <Td className="text-muted whitespace-nowrap">{data(u.data_criacao)}</Td>
                  <Td className="text-right">
                    <Botao variante="fantasma" tamanho="sm" aria-label={`Editar ${u.nome}`} onClick={() => setForm({ aberto: true, usuario: u })}>
                      <Pencil className="size-4" />
                    </Botao>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Painel>
      <UsuarioForm aberto={form.aberto} usuario={form.usuario} fechar={() => setForm({ aberto: false, usuario: null })} salvo={recarregar} />
    </div>
  );
}
