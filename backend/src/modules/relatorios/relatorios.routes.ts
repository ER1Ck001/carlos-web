import { Router } from 'express';
import { dbFin, dbOp } from '../../config/database.js';
import { autorizar, ehAdmin } from '../../middlewares/auth.js';
import { dinheiro, periodo, type Linha } from '../../utils/http.js';

export const relatoriosRoutes = Router();

const DIAS_ALERTA_PARADO = 90;

/** Últimos 12 meses no formato YYYY-MM (inclui meses sem vendas). */
function ultimos12Meses() {
  const meses: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    meses.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

/**
 * Dashboard: todos os números vêm dos dois bancos.
 * Vendedor vê estoque e as próprias vendas; dados financeiros só para admin.
 */
relatoriosRoutes.get('/dashboard', async (req, res) => {
  const admin = ehAdmin(req);
  const filtroVendedor = admin ? '' : 'WHERE ve.usuario_id = ?';
  const paramsVendedor = admin ? [] : [req.usuario!.id];

  const [[estoque]] = await dbOp.query<Linha[]>(
    `SELECT COUNT(*) AS total,
            SUM(status = 'DISPONIVEL') AS disponiveis,
            SUM(status = 'RESERVADO') AS reservados,
            SUM(status = 'VENDIDO') AS vendidos,
            IFNULL(SUM(CASE WHEN status <> 'VENDIDO' THEN valor_compra END), 0) AS valor_estoque,
            IFNULL(SUM(CASE WHEN status <> 'VENDIDO' THEN valor_venda END), 0) AS valor_estoque_venda
       FROM veiculos`,
  );

  const [[vendas]] = await dbOp.query<Linha[]>(
    `SELECT COUNT(*) AS quantidade, IFNULL(SUM(ve.valor_venda - ve.desconto), 0) AS faturamento,
            IFNULL(SUM(CASE WHEN ve.data_venda >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 END), 0) AS no_mes
       FROM vendas ve ${filtroVendedor}`,
    paramsVendedor,
  );

  const [porMes] = await dbOp.query<Linha[]>(
    `SELECT DATE_FORMAT(ve.data_venda, '%Y-%m') AS mes, COUNT(*) AS quantidade,
            SUM(ve.valor_venda - ve.desconto) AS valor
       FROM vendas ve
      WHERE ve.data_venda >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
        ${admin ? '' : 'AND ve.usuario_id = ?'}
      GROUP BY mes`,
    paramsVendedor,
  );
  const mapaMes = new Map(porMes.map((m) => [m.mes, m]));
  const vendasPorMes = ultimos12Meses().map((mes) => ({
    mes,
    quantidade: Number(mapaMes.get(mes)?.quantidade ?? 0),
    valor: Number(mapaMes.get(mes)?.valor ?? 0),
  }));

  const [ultimasMov] = await dbOp.query<Linha[]>(
    `SELECT e.id, e.tipo_movimentacao, e.data_movimentacao, e.localizacao, e.observacao,
            v.id AS veiculo_id, v.marca, v.modelo, v.placa, u.nome AS usuario_nome
       FROM estoque e JOIN veiculos v ON v.id = e.veiculo_id JOIN usuarios u ON u.id = e.usuario_id
      ORDER BY e.data_movimentacao DESC, e.id DESC LIMIT 8`,
  );

  const [parados] = await dbOp.query<Linha[]>(
    `SELECT id, marca, modelo, ano, placa, DATEDIFF(NOW(), data_cadastro) AS dias
       FROM veiculos
      WHERE status <> 'VENDIDO' AND DATEDIFF(NOW(), data_cadastro) >= ?
      ORDER BY dias DESC LIMIT 5`,
    [DIAS_ALERTA_PARADO],
  );

  const alertas: { tipo: string; nivel: 'alto' | 'medio' | 'info'; titulo: string; detalhe: string; link: string }[] = [];

  if (Number(estoque.disponiveis) <= 3) {
    alertas.push({
      tipo: 'estoque_baixo',
      nivel: 'alto',
      titulo: 'Estoque baixo',
      detalhe: `Apenas ${Number(estoque.disponiveis)} veículo(s) disponível(is) para venda.`,
      link: '/veiculos',
    });
  }
  for (const p of parados) {
    alertas.push({
      tipo: 'parado',
      nivel: 'medio',
      titulo: 'Veículo parado no estoque',
      detalhe: `${p.marca} ${p.modelo}${p.placa ? ` (${p.placa})` : ''} há ${p.dias} dias sem venda.`,
      link: `/veiculos/${p.id}`,
    });
  }
  const [[reservados]] = await dbOp.query<Linha[]>("SELECT COUNT(*) AS n FROM veiculos WHERE status = 'RESERVADO'");
  if (reservados.n > 0) {
    alertas.push({
      tipo: 'reservados',
      nivel: 'info',
      titulo: 'Veículos reservados',
      detalhe: `${reservados.n} veículo(s) aguardando conclusão da venda.`,
      link: '/veiculos?status=RESERVADO',
    });
  }

  let financeiro = null;
  if (admin) {
    const [[mes]] = await dbFin.query<Linha[]>(
      `SELECT IFNULL(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor END), 0) AS receitas,
              IFNULL(SUM(CASE WHEN tipo = 'SAIDA' THEN valor END), 0) AS despesas
         FROM fluxo_caixa WHERE data_movimentacao >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    );
    const [[total]] = await dbFin.query<Linha[]>(
      `SELECT IFNULL(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor END), 0) AS receitas,
              IFNULL(SUM(CASE WHEN tipo = 'SAIDA' THEN valor END), 0) AS despesas
         FROM fluxo_caixa`,
    );
    const [fluxoMes] = await dbFin.query<Linha[]>(
      `SELECT DATE_FORMAT(data_movimentacao, '%Y-%m') AS mes,
              SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END) AS receitas,
              SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END) AS despesas
         FROM fluxo_caixa
        WHERE data_movimentacao >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
        GROUP BY mes`,
    );
    const mapaFluxo = new Map(fluxoMes.map((m) => [m.mes, m]));
    const [[pend]] = await dbFin.query<Linha[]>(
      `SELECT COUNT(*) AS quantidade, IFNULL(SUM(valor), 0) AS valor,
              IFNULL(SUM(data_vencimento < CURDATE()), 0) AS vencidos,
              IFNULL(SUM(CASE WHEN data_vencimento < CURDATE() THEN valor END), 0) AS valor_vencido
         FROM pagamentos WHERE status = 'PENDENTE'`,
    );
    const [[despVenc]] = await dbFin.query<Linha[]>(
      `SELECT COUNT(*) AS n, IFNULL(SUM(valor), 0) AS valor FROM despesas
        WHERE status = 'PENDENTE' AND data_vencimento IS NOT NULL AND data_vencimento <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
    );

    if (Number(pend.vencidos) > 0) {
      alertas.unshift({
        tipo: 'pagamentos_vencidos',
        nivel: 'alto',
        titulo: 'Pagamentos vencidos',
        detalhe: `${Number(pend.vencidos)} recebimento(s) em atraso.`,
        link: '/financeiro?aba=pagamentos&status=VENCIDO',
      });
    }
    if (Number(pend.quantidade) - Number(pend.vencidos) > 0) {
      alertas.push({
        tipo: 'pagamentos_pendentes',
        nivel: 'info',
        titulo: 'Pagamentos a receber',
        detalhe: `${Number(pend.quantidade) - Number(pend.vencidos)} recebimento(s) pendente(s) dentro do prazo.`,
        link: '/financeiro?aba=pagamentos&status=PENDENTE',
      });
    }
    if (despVenc.n > 0) {
      alertas.push({
        tipo: 'despesas',
        nivel: 'medio',
        titulo: 'Contas a pagar',
        detalhe: `${despVenc.n} despesa(s) vencida(s) ou vencendo em até 7 dias.`,
        link: '/financeiro?aba=despesas&status=PENDENTE',
      });
    }

    const meses6 = ultimos12Meses().slice(6);
    financeiro = {
      receitas_mes: Number(mes.receitas),
      despesas_mes: Number(mes.despesas),
      receitas_total: Number(total.receitas),
      despesas_total: Number(total.despesas),
      saldo_total: dinheiro(Number(total.receitas) - Number(total.despesas)),
      pendentes: {
        quantidade: Number(pend.quantidade),
        valor: Number(pend.valor),
        vencidos: Number(pend.vencidos),
        valor_vencido: Number(pend.valor_vencido),
      },
      fluxo_mensal: meses6.map((m) => ({
        mes: m,
        receitas: Number(mapaFluxo.get(m)?.receitas ?? 0),
        despesas: Number(mapaFluxo.get(m)?.despesas ?? 0),
      })),
    };
  }

  res.json({
    estoque: {
      total: Number(estoque.total),
      disponiveis: Number(estoque.disponiveis ?? 0),
      reservados: Number(estoque.reservados ?? 0),
      vendidos: Number(estoque.vendidos ?? 0),
      valor_estoque: Number(estoque.valor_estoque),
      valor_estoque_venda: Number(estoque.valor_estoque_venda),
    },
    vendas: { quantidade: Number(vendas.quantidade), faturamento: Number(vendas.faturamento), no_mes: Number(vendas.no_mes) },
    vendas_por_mes: vendasPorMes,
    ultimas_movimentacoes: ultimasMov,
    alertas,
    financeiro,
  });
});

/** Relatório de vendas por período: totais, margem, por vendedor, marca e forma de pagamento. */
relatoriosRoutes.get('/vendas', autorizar('ADMIN'), async (req, res) => {
  const { inicio, fim } = periodo(req);
  const where: string[] = [];
  const params: unknown[] = [];
  if (inicio) {
    where.push('ve.data_venda >= ?');
    params.push(inicio);
  }
  if (fim) {
    where.push('ve.data_venda < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(fim);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM vendas ve JOIN veiculos v ON v.id = ve.veiculo_id JOIN usuarios u ON u.id = ve.usuario_id ${w}`;

  const [[tot]] = await dbOp.query<Linha[]>(
    `SELECT COUNT(*) AS quantidade,
            IFNULL(SUM(ve.valor_venda - ve.desconto), 0) AS faturamento,
            IFNULL(SUM(ve.desconto), 0) AS descontos,
            IFNULL(SUM(v.valor_compra), 0) AS custo
       ${from}`,
    params,
  );
  const [porVendedor] = await dbOp.query<Linha[]>(
    `SELECT u.id, u.nome, COUNT(*) AS quantidade, SUM(ve.valor_venda - ve.desconto) AS faturamento,
            SUM(ve.valor_venda - ve.desconto - v.valor_compra) AS margem
       ${from} GROUP BY u.id, u.nome ORDER BY faturamento DESC`,
    params,
  );
  const [porMarca] = await dbOp.query<Linha[]>(
    `SELECT v.marca, COUNT(*) AS quantidade, SUM(ve.valor_venda - ve.desconto) AS faturamento
       ${from} GROUP BY v.marca ORDER BY faturamento DESC`,
    params,
  );
  const [porForma] = await dbOp.query<Linha[]>(
    `SELECT ve.forma_pagamento, COUNT(*) AS quantidade, SUM(ve.valor_venda - ve.desconto) AS faturamento
       ${from} GROUP BY ve.forma_pagamento ORDER BY faturamento DESC`,
    params,
  );

  // Comissões das vendas do período (banco financeiro)
  const [ids] = await dbOp.query<Linha[]>(`SELECT ve.id ${from}`, params);
  let comissoes = 0;
  if (ids.length) {
    const [[c]] = await dbFin.query<Linha[]>('SELECT IFNULL(SUM(valor), 0) AS total FROM comissoes WHERE venda_id IN (?)', [
      ids.map((i) => i.id),
    ]);
    comissoes = Number(c.total);
  }

  const faturamento = Number(tot.faturamento);
  const custo = Number(tot.custo);
  const n = (rows: Linha[]) =>
    rows.map((r) => ({
      ...r,
      quantidade: Number(r.quantidade),
      faturamento: Number(r.faturamento),
      ...(r.margem !== undefined ? { margem: Number(r.margem) } : {}),
    }));

  res.json({
    periodo: { inicio: inicio ?? null, fim: fim ?? null },
    quantidade: Number(tot.quantidade),
    faturamento,
    descontos: Number(tot.descontos),
    custo,
    margem_bruta: dinheiro(faturamento - custo),
    comissoes,
    ticket_medio: tot.quantidade ? dinheiro(faturamento / Number(tot.quantidade)) : 0,
    por_vendedor: n(porVendedor),
    por_marca: n(porMarca),
    por_forma_pagamento: n(porForma),
  });
});

/** Relatório de estoque: veículos não vendidos com dias em estoque e margem prevista. */
relatoriosRoutes.get('/estoque', autorizar('ADMIN'), async (_req, res) => {
  const [itens] = await dbOp.query<Linha[]>(
    `SELECT id, marca, modelo, ano, placa, status, valor_compra, valor_venda,
            (valor_venda - valor_compra) AS margem_prevista, DATEDIFF(NOW(), data_cadastro) AS dias_estoque
       FROM veiculos WHERE status <> 'VENDIDO' ORDER BY dias_estoque DESC`,
  );
  const [porMarca] = await dbOp.query<Linha[]>(
    `SELECT marca, COUNT(*) AS quantidade, SUM(valor_compra) AS valor_compra
       FROM veiculos WHERE status <> 'VENDIDO' GROUP BY marca ORDER BY quantidade DESC, marca`,
  );
  res.json({
    itens,
    por_marca: porMarca.map((m) => ({ marca: m.marca, quantidade: Number(m.quantidade), valor_compra: Number(m.valor_compra) })),
  });
});
