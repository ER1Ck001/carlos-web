import { useEffect, useState } from 'react';
import { hoje } from '../../lib/format';
import { Botao, Campo, Input, Modal } from '../../components/ui';

export interface Periodo {
  inicio: string;
  fim: string;
}

/** Modal para escolher a data de um pagamento/recebimento. */
export function ModalBaixa({
  aberto,
  titulo,
  descricao,
  rotulo,
  carregando,
  fechar,
  confirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: React.ReactNode;
  rotulo: string;
  carregando: boolean;
  fechar: () => void;
  confirmar: (data: string) => void;
}) {
  const [dataPg, setDataPg] = useState(hoje());
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (aberto) {
      setDataPg(hoje());
      setErro('');
    }
  }, [aberto]);

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo={titulo}
      largura="max-w-md"
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao
            carregando={carregando}
            onClick={() => {
              if (!dataPg) return setErro('Informe a data');
              if (dataPg > hoje()) return setErro('A data não pode estar no futuro');
              confirmar(dataPg);
            }}
          >
            {rotulo}
          </Botao>
        </>
      }
    >
      <div className="text-sm text-muted mb-4">{descricao}</div>
      <Campo rotulo="Data" erro={erro}>
        {(id, inv) => <Input id={id} type="date" max={hoje()} value={dataPg} invalido={inv} onChange={(e) => setDataPg(e.target.value)} />}
      </Campo>
    </Modal>
  );
}

export function FiltroPeriodo({ periodo, mudar }: { periodo: Periodo; mudar: (p: Periodo) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" value={periodo.inicio} onChange={(e) => mudar({ ...periodo, inicio: e.target.value })} aria-label="Data inicial" className="w-40" />
      <span className="text-faint text-sm">até</span>
      <Input type="date" value={periodo.fim} onChange={(e) => mudar({ ...periodo, fim: e.target.value })} aria-label="Data final" className="w-40" />
      {(periodo.inicio || periodo.fim) && (
        <Botao variante="fantasma" tamanho="sm" onClick={() => mudar({ inicio: '', fim: '' })}>
          Limpar
        </Botao>
      )}
    </div>
  );
}
