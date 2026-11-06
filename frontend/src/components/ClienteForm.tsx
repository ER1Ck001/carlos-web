import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useEnvio } from '../lib/useEnvio';
import { cpfValido, digitos, emailValido, mascaraCpf, mascaraTelefone } from '../lib/format';
import { Botao, Campo, Input, Modal } from './ui';

export interface Cliente {
  id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  data_cadastro: string;
  total_compras?: number;
  ultima_compra?: string | null;
}

const VAZIO = { nome: '', cpf: '', telefone: '', email: '', endereco: '' };

export default function ClienteForm({
  aberto,
  fechar,
  cliente,
  salvo,
}: {
  aberto: boolean;
  fechar: () => void;
  cliente?: Cliente | null;
  salvo: (c: Cliente) => void;
}) {
  const [f, setF] = useState(VAZIO);
  const { enviando, erros, setErros, enviar, validar } = useEnvio();

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setF(
      cliente
        ? {
            nome: cliente.nome,
            cpf: mascaraCpf(cliente.cpf),
            telefone: mascaraTelefone(cliente.telefone ?? ''),
            email: cliente.email ?? '',
            endereco: cliente.endereco ?? '',
          }
        : VAZIO,
    );
  }, [aberto, cliente, setErros]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const tel = digitos(f.telefone);
    const ok = validar({
      nome: f.nome.trim().length < 3 && 'Informe o nome completo',
      cpf: !cpfValido(f.cpf) && 'CPF inválido',
      telefone: tel !== '' && (tel.length < 10 || tel.length > 11) && 'Telefone inválido (DDD + número)',
      email: f.email.trim() !== '' && !emailValido(f.email.trim()) && 'E-mail inválido',
    });
    if (!ok) return;
    const corpo = { ...f, cpf: digitos(f.cpf) };
    const r = await enviar(
      () => (cliente ? api.put<Cliente>(`/clientes/${cliente.id}`, corpo) : api.post<Cliente>('/clientes', corpo)),
      cliente ? 'Cliente atualizado.' : 'Cliente cadastrado.',
    );
    if (r) {
      salvo(r);
      fechar();
    }
  }

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo={cliente ? 'Editar cliente' : 'Cadastrar cliente'}
      largura="max-w-xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-cliente" carregando={enviando}>
            {cliente ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Botao>
        </>
      }
    >
      <form id="form-cliente" onSubmit={salvar} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo rotulo="Nome completo" obrigatorio erro={erros.nome} className="sm:col-span-2">
          {(id, inv) => <Input id={id} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} invalido={inv} autoComplete="off" />}
        </Campo>
        <Campo rotulo="CPF" obrigatorio erro={erros.cpf}>
          {(id, inv) => (
            <Input id={id} value={f.cpf} onChange={(e) => setF({ ...f, cpf: mascaraCpf(e.target.value) })} invalido={inv} inputMode="numeric" placeholder="000.000.000-00" />
          )}
        </Campo>
        <Campo rotulo="Telefone" erro={erros.telefone}>
          {(id, inv) => (
            <Input id={id} value={f.telefone} onChange={(e) => setF({ ...f, telefone: mascaraTelefone(e.target.value) })} invalido={inv} inputMode="tel" placeholder="(00) 00000-0000" />
          )}
        </Campo>
        <Campo rotulo="E-mail" erro={erros.email} className="sm:col-span-2">
          {(id, inv) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} invalido={inv} />}
        </Campo>
        <Campo rotulo="Endereço" erro={erros.endereco} className="sm:col-span-2">
          {(id, inv) => <Input id={id} value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} invalido={inv} placeholder="Rua, número, bairro, cidade/UF" />}
        </Campo>
      </form>
    </Modal>
  );
}
