import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Abas, Cabecalho } from '../components/ui';
import { FiltroPeriodo, type Periodo } from './financeiro/comum';
import Resumo from './financeiro/Resumo';
import Pagamentos from './financeiro/Pagamentos';
import Despesas from './financeiro/Despesas';
import Comissoes from './financeiro/Comissoes';
import Fluxo from './financeiro/Fluxo';

type Aba = 'resumo' | 'pagamentos' | 'despesas' | 'comissoes' | 'fluxo';
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'pagamentos', rotulo: 'Pagamentos a receber' },
  { id: 'despesas', rotulo: 'Despesas' },
  { id: 'comissoes', rotulo: 'Comissões' },
  { id: 'fluxo', rotulo: 'Fluxo de caixa' },
];

export default function Financeiro() {
  const [params, setParams] = useSearchParams();
  const aba = (ABAS.some((a) => a.id === params.get('aba')) ? params.get('aba') : 'resumo') as Aba;
  const statusInicial = params.get('status') ?? '';
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: '', fim: '' });

  return (
    <div>
      <Cabecalho titulo="Financeiro" descricao="Recebimentos das vendas, despesas, comissões e fluxo de caixa." acoes={<FiltroPeriodo periodo={periodo} mudar={setPeriodo} />} />
      <Abas abas={ABAS} atual={aba} mudar={(a) => setParams({ aba: a }, { replace: true })} />
      {aba === 'resumo' && <Resumo periodo={periodo} />}
      {aba === 'pagamentos' && <Pagamentos key={statusInicial} periodo={periodo} statusInicial={statusInicial} />}
      {aba === 'despesas' && <Despesas key={statusInicial} periodo={periodo} statusInicial={statusInicial} />}
      {aba === 'comissoes' && <Comissoes periodo={periodo} />}
      {aba === 'fluxo' && <Fluxo periodo={periodo} />}
    </div>
  );
}
