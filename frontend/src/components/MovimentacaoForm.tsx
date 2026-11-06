import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useEnvio } from '../lib/useEnvio';
import { placa, STATUS_VEICULO } from '../lib/format';
import { Botao, Campo, Input, Modal, Select, Textarea } from './ui';

interface Opcao {
  id: number;
  marca: string;
  modelo: string;
  ano: number;
  placa: string | null;
  status: 'DISPONIVEL' | 'RESERVADO';
}

type Tipo = 'RESERVA' | 'LIBERACAO' | 'TRANSFERENCIA';

const DESCRICAO: Record<Tipo, string> = {
  RESERVA: 'O veículo fica reservado e não aparece como disponível até ser vendido ou liberado.',
  LIBERACAO: 'Cancela a reserva e o veículo volta a ficar disponível para venda.',
  TRANSFERENCIA: 'Registra a mudança de local do veículo (pátio, showroom, oficina…).',
};

/**
 * Movimentação manual de estoque. Entradas são registradas no cadastro do veículo
 * e saídas na venda, automaticamente.
 */
export default function MovimentacaoForm({
  aberto,
  fechar,
  salvo,
  veiculo,
  tipoInicial,
}: {
  aberto: boolean;
  fechar: () => void;
  salvo: () => void;
  veiculo?: Opcao | null;
  tipoInicial?: Tipo;
}) {
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [veiculoId, setVeiculoId] = useState('');
  const [tipo, setTipo] = useState<Tipo>('TRANSFERENCIA');
  const [localizacao, setLocalizacao] = useState('');
  const [observacao, setObservacao] = useState('');
  const { enviando, erros, setErros, enviar, validar } = useEnvio();

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setVeiculoId(veiculo ? String(veiculo.id) : '');
    setTipo(tipoInicial ?? 'TRANSFERENCIA');
    setLocalizacao('');
    setObservacao('');
    if (!veiculo) api.get<Opcao[]>('/veiculos/vendaveis').then(setOpcoes).catch(() => setOpcoes([]));
  }, [aberto, veiculo, tipoInicial, setErros]);

  const selecionado = useMemo(() => veiculo ?? opcoes.find((o) => String(o.id) === veiculoId), [veiculo, opcoes, veiculoId]);

  const tiposPermitidos: Tipo[] = !selecionado
    ? ['RESERVA', 'LIBERACAO', 'TRANSFERENCIA']
    : selecionado.status === 'DISPONIVEL'
      ? ['RESERVA', 'TRANSFERENCIA']
      : ['LIBERACAO', 'TRANSFERENCIA'];

  useEffect(() => {
    if (selecionado && !tiposPermitidos.includes(tipo)) setTipo('TRANSFERENCIA');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const ok = validar({
      veiculo_id: !veiculoId && 'Selecione o veículo',
      localizacao: tipo === 'TRANSFERENCIA' && !localizacao.trim() && 'Informe o novo local',
    });
    if (!ok) return;
    const r = await enviar(
      () => api.post('/estoque', { veiculo_id: Number(veiculoId), tipo_movimentacao: tipo, localizacao, observacao }),
      tipo === 'RESERVA' ? 'Veículo reservado.' : tipo === 'LIBERACAO' ? 'Reserva liberada.' : 'Transferência registrada.',
    );
    if (r !== undefined) {
      salvo();
      fechar();
    }
  }

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo="Registrar movimentação"
      largura="max-w-lg"
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-mov" carregando={enviando}>
            Registrar
          </Botao>
        </>
      }
    >
      <form id="form-mov" onSubmit={salvar} noValidate className="flex flex-col gap-4">
        {veiculo ? (
          <div className="rounded-lg bg-raised px-4 py-3">
            <p className="font-medium">
              {veiculo.marca} {veiculo.modelo} {veiculo.ano}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {placa(veiculo.placa)} · {STATUS_VEICULO[veiculo.status]}
            </p>
          </div>
        ) : (
          <Campo rotulo="Veículo" obrigatorio erro={erros.veiculo_id}>
            {(id, inv) => (
              <Select id={id} value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} invalido={inv}>
                <option value="">Selecione…</option>
                {opcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.marca} {o.modelo} {o.ano} · {placa(o.placa)} ({STATUS_VEICULO[o.status]})
                  </option>
                ))}
              </Select>
            )}
          </Campo>
        )}

        <Campo rotulo="Tipo de movimentação" obrigatorio ajuda={DESCRICAO[tipo]}>
          {(id) => (
            <Select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              {tiposPermitidos.includes('RESERVA') && <option value="RESERVA">Reservar veículo</option>}
              {tiposPermitidos.includes('LIBERACAO') && <option value="LIBERACAO">Liberar reserva</option>}
              <option value="TRANSFERENCIA">Transferir de local</option>
            </Select>
          )}
        </Campo>

        {tipo === 'TRANSFERENCIA' && (
          <Campo rotulo="Novo local" obrigatorio erro={erros.localizacao}>
            {(id, inv) => <Input id={id} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} invalido={inv} placeholder="Showroom, Pátio B, Oficina…" maxLength={80} />}
          </Campo>
        )}

        <Campo rotulo="Observação" erro={erros.observacao}>
          {(id, inv) => (
            <Textarea
              id={id}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              invalido={inv}
              rows={2}
              maxLength={255}
              placeholder={tipo === 'RESERVA' ? 'Ex.: reservado para o cliente Fulano' : ''}
            />
          )}
        </Campo>
      </form>
    </Modal>
  );
}
