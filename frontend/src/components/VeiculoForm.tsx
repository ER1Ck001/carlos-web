import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useEnvio } from '../lib/useEnvio';
import { chassiValido, placaValida } from '../lib/format';
import { Botao, Campo, Input, Modal, Textarea } from './ui';

export interface Veiculo {
  id: number;
  marca: string;
  modelo: string;
  ano: number;
  cor: string | null;
  placa: string | null;
  chassi: string | null;
  quilometragem: number;
  valor_compra: number;
  valor_venda: number;
  status: 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO';
  observacoes: string | null;
  data_cadastro: string;
  localizacao?: string | null;
  dias_estoque?: number;
}

const VAZIO = {
  marca: '',
  modelo: '',
  ano: String(new Date().getFullYear()),
  cor: '',
  placa: '',
  chassi: '',
  quilometragem: '0',
  valor_compra: '',
  valor_venda: '',
  observacoes: '',
  localizacao: 'Pátio',
};

export default function VeiculoForm({
  aberto,
  fechar,
  veiculo,
  salvo,
}: {
  aberto: boolean;
  fechar: () => void;
  veiculo?: Veiculo | null;
  salvo: (v: Veiculo) => void;
}) {
  const [f, setF] = useState(VAZIO);
  const { enviando, erros, setErros, enviar, validar } = useEnvio();
  const vendido = veiculo?.status === 'VENDIDO';

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setF(
      veiculo
        ? {
            marca: veiculo.marca,
            modelo: veiculo.modelo,
            ano: String(veiculo.ano),
            cor: veiculo.cor ?? '',
            placa: veiculo.placa ?? '',
            chassi: veiculo.chassi ?? '',
            quilometragem: String(veiculo.quilometragem),
            valor_compra: String(veiculo.valor_compra),
            valor_venda: String(veiculo.valor_venda),
            observacoes: veiculo.observacoes ?? '',
            localizacao: '',
          }
        : VAZIO,
    );
  }, [aberto, veiculo, setErros]);

  const set = (k: keyof typeof VAZIO) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const anoMax = new Date().getFullYear() + 1;
    const ano = Number(f.ano);
    const ok = validar({
      marca: f.marca.trim().length < 2 && 'Informe a marca',
      modelo: !f.modelo.trim() && 'Informe o modelo',
      ano: (!Number.isInteger(ano) || ano < 1950 || ano > anoMax) && `Ano entre 1950 e ${anoMax}`,
      placa: f.placa.trim() !== '' && !placaValida(f.placa) && 'Placa inválida (ABC1234 ou ABC1D23)',
      chassi: f.chassi.trim() !== '' && !chassiValido(f.chassi) && 'Chassi deve ter 17 caracteres (sem I, O, Q)',
      quilometragem: (f.quilometragem === '' || Number(f.quilometragem) < 0) && 'Quilometragem não pode ser negativa',
      valor_compra: (f.valor_compra === '' || Number(f.valor_compra) < 0) && 'Informe um valor de compra válido',
      valor_venda: !(Number(f.valor_venda) > 0) && 'Informe o valor de venda',
    });
    if (!ok) return;

    const corpo = {
      ...f,
      ano,
      quilometragem: Number(f.quilometragem),
      valor_compra: Number(f.valor_compra),
      valor_venda: Number(f.valor_venda),
      placa: f.placa.trim() || null,
      chassi: f.chassi.trim() || null,
    };
    const r = await enviar(
      () => (veiculo ? api.put<Veiculo>(`/veiculos/${veiculo.id}`, corpo) : api.post<Veiculo>('/veiculos', corpo)),
      veiculo ? 'Veículo atualizado.' : 'Veículo cadastrado e registrado no estoque.',
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
      titulo={veiculo ? 'Editar veículo' : 'Cadastrar veículo'}
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-veiculo" carregando={enviando}>
            {veiculo ? 'Salvar alterações' : 'Cadastrar veículo'}
          </Botao>
        </>
      }
    >
      {vendido && (
        <p className="text-sm text-warn bg-warn/10 border border-warn/30 rounded-md px-3 py-2 mb-4">
          Veículo vendido: os dados ficam preservados para o histórico. Só as observações podem ser alteradas.
        </p>
      )}
      <form id="form-veiculo" onSubmit={salvar} noValidate className="grid grid-cols-1 sm:grid-cols-6 gap-4">
        <fieldset disabled={vendido} className="contents">
          <Campo rotulo="Marca" obrigatorio erro={erros.marca} className="sm:col-span-2">
            {(id, inv) => <Input id={id} value={f.marca} onChange={set('marca')} invalido={inv} placeholder="Ex.: Toyota" />}
          </Campo>
          <Campo rotulo="Modelo" obrigatorio erro={erros.modelo} className="sm:col-span-3">
            {(id, inv) => <Input id={id} value={f.modelo} onChange={set('modelo')} invalido={inv} placeholder="Ex.: Corolla XEi 2.0" />}
          </Campo>
          <Campo rotulo="Ano" obrigatorio erro={erros.ano} className="sm:col-span-1">
            {(id, inv) => <Input id={id} type="number" inputMode="numeric" value={f.ano} onChange={set('ano')} invalido={inv} />}
          </Campo>
          <Campo rotulo="Cor" erro={erros.cor} className="sm:col-span-2">
            {(id, inv) => <Input id={id} value={f.cor} onChange={set('cor')} invalido={inv} />}
          </Campo>
          <Campo rotulo="Placa" erro={erros.placa} ajuda="Opcional para 0 km" className="sm:col-span-2">
            {(id, inv) => (
              <Input id={id} value={f.placa} onChange={(e) => setF((x) => ({ ...x, placa: e.target.value.toUpperCase() }))} invalido={inv} maxLength={8} placeholder="ABC1D23" />
            )}
          </Campo>
          <Campo rotulo="Quilometragem" erro={erros.quilometragem} className="sm:col-span-2">
            {(id, inv) => <Input id={id} type="number" min={0} inputMode="numeric" value={f.quilometragem} onChange={set('quilometragem')} invalido={inv} />}
          </Campo>
          <Campo rotulo="Chassi" erro={erros.chassi} className="sm:col-span-6">
            {(id, inv) => (
              <Input id={id} value={f.chassi} onChange={(e) => setF((x) => ({ ...x, chassi: e.target.value.toUpperCase() }))} invalido={inv} maxLength={17} placeholder="17 caracteres" />
            )}
          </Campo>
          <Campo rotulo="Valor de compra (R$)" obrigatorio erro={erros.valor_compra} className="sm:col-span-3">
            {(id, inv) => <Input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={f.valor_compra} onChange={set('valor_compra')} invalido={inv} />}
          </Campo>
          <Campo rotulo="Valor de venda (R$)" obrigatorio erro={erros.valor_venda} className="sm:col-span-3">
            {(id, inv) => <Input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={f.valor_venda} onChange={set('valor_venda')} invalido={inv} />}
          </Campo>
          {!veiculo && (
            <Campo rotulo="Localização no estoque" erro={erros.localizacao} className="sm:col-span-6">
              {(id, inv) => <Input id={id} value={f.localizacao} onChange={set('localizacao')} invalido={inv} placeholder="Pátio, Showroom…" />}
            </Campo>
          )}
        </fieldset>
        <Campo rotulo="Observações" erro={erros.observacoes} className="sm:col-span-6">
          {(id, inv) => <Textarea id={id} value={f.observacoes} onChange={set('observacoes')} invalido={inv} rows={3} />}
        </Campo>
      </form>
    </Modal>
  );
}
