/**
 * Testes de ponta a ponta da API (MySQL real).
 *
 * Pré-requisitos: scripts 01, 02 e 03 executados e backend rodando (npm run dev).
 * Uso: npm run test:api            (ou API_URL=http://localhost:3333/api npm run test:api)
 *
 * ATENÇÃO: os testes criam registros (veículos, clientes, vendas). Rode em um banco
 * de testes ou recrie os bancos com os scripts SQL depois.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API_URL ?? 'http://localhost:3333/api';
const sufixo = String(Date.now()).slice(-6);

async function req(metodo, caminho, { token, corpo } = {}) {
  const res = await fetch(API + caminho, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await res.text();
  return { status: res.status, body: texto ? JSON.parse(texto) : null };
}

async function login(email, senha) {
  const r = await req('POST', '/auth/login', { corpo: { email, senha } });
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

/** Gera CPF válido a partir de 9 dígitos. */
function cpf(base) {
  const d = base.split('').map(Number);
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join('');
}

let admin, carla, rafael;
let carlaId;

before(async () => {
  const h = await req('GET', '/health');
  assert.equal(h.status, 200, 'API ou bancos indisponíveis');
  admin = await login('admin@concessionaria.local', 'Admin@123');
  carla = await login('carla@concessionaria.local', 'Vendedor@123');
  rafael = await login('rafael@concessionaria.local', 'Vendedor@123');
  carlaId = (await req('GET', '/auth/me', { token: carla })).body.usuario.id;
});

test('health informa os dois bancos conectados', async () => {
  const r = await req('GET', '/health');
  assert.deepEqual(
    r.body.bancos.map((b) => [b.banco, b.ok]),
    [
      ['concessionaria_db', true],
      ['financeiro_db', true],
    ],
  );
});

test('login: senha errada é recusada e rotas exigem token', async () => {
  const r = await req('POST', '/auth/login', { corpo: { email: 'admin@concessionaria.local', senha: 'errada' } });
  assert.equal(r.status, 401);
  assert.equal((await req('GET', '/veiculos')).status, 401);
  assert.equal((await req('GET', '/veiculos', { token: 'token-falso' })).status, 401);
});

test('permissões: vendedor não acessa financeiro, usuários nem relatórios de admin', async () => {
  assert.equal((await req('GET', '/financeiro/resumo', { token: carla })).status, 403);
  assert.equal((await req('GET', '/usuarios', { token: carla })).status, 403);
  assert.equal((await req('GET', '/relatorios/vendas', { token: carla })).status, 403);
  assert.equal((await req('POST', '/veiculos', { token: carla, corpo: {} })).status, 403);
  const dash = await req('GET', '/relatorios/dashboard', { token: carla });
  assert.equal(dash.status, 200);
  assert.equal(dash.body.financeiro, null, 'vendedor não recebe dados financeiros');
});

test('veículo: validações, unicidade de placa/chassi e persistência', async () => {
  const placa = `TST${sufixo.slice(0, 1)}A${sufixo.slice(1, 3)}`;
  const chassi = `9BWTESTE${sufixo}AB1`.slice(0, 17);
  const base = { marca: 'Teste', modelo: 'Modelo QA', ano: 2024, quilometragem: 100, valor_compra: 50000, valor_venda: 60000, placa, chassi };

  const neg = await req('POST', '/veiculos', { token: admin, corpo: { ...base, valor_compra: -1, placa: null, chassi: null } });
  assert.equal(neg.status, 400);
  assert.ok(neg.body.campos.valor_compra);

  const placaRuim = await req('POST', '/veiculos', { token: admin, corpo: { ...base, placa: 'XX12' } });
  assert.equal(placaRuim.status, 400);

  const ok = await req('POST', '/veiculos', { token: admin, corpo: base });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.status, 'DISPONIVEL');

  const dupPlaca = await req('POST', '/veiculos', { token: admin, corpo: { ...base, chassi: null } });
  assert.equal(dupPlaca.status, 409);
  assert.match(dupPlaca.body.erro, /placa/);
  const dupChassi = await req('POST', '/veiculos', { token: admin, corpo: { ...base, placa: null } });
  assert.equal(dupChassi.status, 409);
  assert.match(dupChassi.body.erro, /chassi/);

  // persistiu e registrou ENTRADA no estoque
  const det = await req('GET', `/veiculos/${ok.body.id}`, { token: admin });
  assert.equal(det.body.placa, placa);
  assert.equal(det.body.movimentacoes[0].tipo_movimentacao, 'ENTRADA');

  // busca por placa
  const busca = await req('GET', `/veiculos?busca=${placa}`, { token: admin });
  assert.equal(busca.body.total, 1);

  // editar e excluir (disponível e sem venda pode)
  const ed = await req('PUT', `/veiculos/${ok.body.id}`, { token: admin, corpo: { ...base, valor_venda: 61000 } });
  assert.equal(ed.body.valor_venda, 61000);
  assert.equal((await req('DELETE', `/veiculos/${ok.body.id}`, { token: admin })).status, 204);
  assert.equal((await req('GET', `/veiculos/${ok.body.id}`, { token: admin })).status, 404);
});

test('cliente: CPF inválido e duplicado são recusados', async () => {
  const invalido = await req('POST', '/clientes', { token: carla, corpo: { nome: 'Cliente QA', cpf: '111.111.111-11' } });
  assert.equal(invalido.status, 400);
  const doc = cpf(`9${sufixo}12`.slice(0, 9));
  const ok = await req('POST', '/clientes', { token: carla, corpo: { nome: 'Cliente QA', cpf: doc, telefone: '(62) 99999-0000' } });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const dup = await req('POST', '/clientes', { token: carla, corpo: { nome: 'Outro', cpf: doc } });
  assert.equal(dup.status, 409);
  const busca = await req('GET', `/clientes?busca=99999-0000`, { token: carla });
  assert.ok(busca.body.itens.some((c) => c.id === ok.body.id), 'busca por telefone');
});

test('venda: atualiza estoque, gera financeiro e impede venda dupla', async () => {
  const v = await req('POST', '/veiculos', {
    token: admin,
    corpo: { marca: 'Teste', modelo: 'Venda QA', ano: 2023, quilometragem: 0, valor_compra: 80000, valor_venda: 100000 },
  });
  const c = await req('POST', '/clientes', { token: admin, corpo: { nome: 'Comprador QA', cpf: cpf(`8${sufixo}34`.slice(0, 9)) } });

  // desconto >= valor é recusado
  const descRuim = await req('POST', '/vendas', {
    token: carla,
    corpo: { veiculo_id: v.body.id, cliente_id: c.body.id, valor_venda: 1000, desconto: 1000, forma_pagamento: 'PIX' },
  });
  assert.equal(descRuim.status, 400);

  // vendedor tenta registrar em nome de outro: o backend força o próprio vendedor
  const venda = await req('POST', '/vendas', {
    token: carla,
    corpo: { veiculo_id: v.body.id, cliente_id: c.body.id, usuario_id: 1, valor_venda: 99000, desconto: 1000, forma_pagamento: 'BOLETO', parcelas: 3 },
  });
  assert.equal(venda.status, 201, JSON.stringify(venda.body));

  const det = await req('GET', `/vendas/${venda.body.id}`, { token: admin });
  assert.equal(det.body.vendedor_id, carlaId);
  assert.equal(det.body.valor_liquido, 98000);
  assert.equal(det.body.pagamentos.length, 3);
  const soma = det.body.pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  assert.equal(Math.round(soma * 100), 9800000, 'parcelas somam o valor líquido');
  assert.equal(det.body.comissao.valor, 1960, 'comissão de 2% sobre o líquido');

  const veic = await req('GET', `/veiculos/${v.body.id}`, { token: admin });
  assert.equal(veic.body.status, 'VENDIDO');
  assert.equal(veic.body.movimentacoes[0].tipo_movimentacao, 'SAIDA');

  // venda dupla do mesmo veículo
  const dupla = await req('POST', '/vendas', {
    token: admin,
    corpo: { veiculo_id: v.body.id, cliente_id: c.body.id, valor_venda: 99000, forma_pagamento: 'PIX' },
  });
  assert.equal(dupla.status, 409);

  // integridade: não exclui veículo vendido nem cliente com compra
  assert.equal((await req('DELETE', `/veiculos/${v.body.id}`, { token: admin })).status, 409);
  assert.equal((await req('DELETE', `/clientes/${c.body.id}`, { token: admin })).status, 409);

  // vendedor só vê as próprias vendas
  assert.equal((await req('GET', `/vendas/${venda.body.id}`, { token: rafael })).status, 403);
  const listaRafael = await req('GET', '/vendas?pageSize=100', { token: rafael });
  assert.ok(listaRafael.body.itens.every((x) => x.vendedor_nome === 'Rafael Souza'));

  // receber a 1ª parcela gera entrada no fluxo de caixa
  const p1 = det.body.pagamentos[0];
  const antes = await req('GET', '/financeiro/fluxo?pageSize=1', { token: admin });
  assert.equal((await req('PATCH', `/financeiro/pagamentos/${p1.id}/pagar`, { token: admin, corpo: {} })).status, 200);
  assert.equal((await req('PATCH', `/financeiro/pagamentos/${p1.id}/pagar`, { token: admin, corpo: {} })).status, 409, 'não paga duas vezes');
  const depois = await req('GET', '/financeiro/fluxo?pageSize=1', { token: admin });
  assert.equal(depois.body.total, antes.body.total + 1);
  assert.equal(Math.round((depois.body.entradas - antes.body.entradas) * 100), Math.round(Number(p1.valor) * 100));
});

test('venda à vista entra direto no caixa', async () => {
  const v = await req('POST', '/veiculos', {
    token: admin,
    corpo: { marca: 'Teste', modelo: 'Pix QA', ano: 2022, quilometragem: 0, valor_compra: 10000, valor_venda: 15000 },
  });
  const c = (await req('GET', '/clientes/opcoes', { token: admin })).body[0];
  const venda = await req('POST', '/vendas', { token: admin, corpo: { veiculo_id: v.body.id, cliente_id: c.id, valor_venda: 15000, forma_pagamento: 'PIX' } });
  const det = await req('GET', `/vendas/${venda.body.id}`, { token: admin });
  assert.equal(det.body.pagamentos.length, 1);
  assert.equal(det.body.pagamentos[0].status, 'PAGO');
  const fluxo = await req('GET', '/financeiro/fluxo?origem=PAGAMENTO&pageSize=100', { token: admin });
  assert.ok(fluxo.body.itens.some((l) => l.referencia_id === det.body.pagamentos[0].id));
});

test('vendas simultâneas do mesmo veículo: só uma é aceita (transação + trava)', async () => {
  const v = await req('POST', '/veiculos', {
    token: admin,
    corpo: { marca: 'Teste', modelo: 'Corrida QA', ano: 2022, quilometragem: 0, valor_compra: 10000, valor_venda: 12000 },
  });
  const c = (await req('GET', '/clientes/opcoes', { token: admin })).body[0];
  const corpo = { veiculo_id: v.body.id, cliente_id: c.id, valor_venda: 12000, forma_pagamento: 'PIX' };
  const rs = await Promise.all(Array.from({ length: 5 }, () => req('POST', '/vendas', { token: admin, corpo })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 4);
});

test('estoque: reserva e liberação mudam o status do veículo', async () => {
  const v = await req('POST', '/veiculos', {
    token: admin,
    corpo: { marca: 'Teste', modelo: 'Reserva QA', ano: 2022, quilometragem: 0, valor_compra: 10000, valor_venda: 12000 },
  });
  const r1 = await req('POST', '/estoque', { token: carla, corpo: { veiculo_id: v.body.id, tipo_movimentacao: 'RESERVA' } });
  assert.equal(r1.status, 201);
  assert.equal((await req('GET', `/veiculos/${v.body.id}`, { token: carla })).body.status, 'RESERVADO');
  assert.equal((await req('POST', '/estoque', { token: carla, corpo: { veiculo_id: v.body.id, tipo_movimentacao: 'RESERVA' } })).status, 409);
  assert.equal((await req('DELETE', `/veiculos/${v.body.id}`, { token: admin })).status, 409, 'reservado não exclui');
  await req('POST', '/estoque', { token: carla, corpo: { veiculo_id: v.body.id, tipo_movimentacao: 'LIBERACAO' } });
  assert.equal((await req('GET', `/veiculos/${v.body.id}`, { token: carla })).body.status, 'DISPONIVEL');
  const tr = await req('POST', '/estoque', { token: carla, corpo: { veiculo_id: v.body.id, tipo_movimentacao: 'TRANSFERENCIA' } });
  assert.equal(tr.status, 400, 'transferência exige local');
});

test('despesa: cadastrar, pagar e bloquear edição depois de paga', async () => {
  const d = await req('POST', '/financeiro/despesas', {
    token: admin,
    corpo: { descricao: 'Despesa QA', categoria: 'OUTROS', valor: 123.45, data_despesa: '2026-01-10', data_vencimento: '2026-01-20' },
  });
  assert.equal(d.status, 201);
  assert.equal((await req('POST', '/financeiro/despesas', { token: admin, corpo: { descricao: 'Neg', categoria: 'OUTROS', valor: -5, data_despesa: '2026-01-10' } })).status, 400);
  assert.equal((await req('PATCH', `/financeiro/despesas/${d.body.id}/pagar`, { token: admin, corpo: { data_pagamento: '2026-01-15' } })).status, 200);
  assert.equal((await req('DELETE', `/financeiro/despesas/${d.body.id}`, { token: admin })).status, 409);
  const fluxo = await req('GET', '/financeiro/fluxo?origem=DESPESA&inicio=2026-01-15&fim=2026-01-15', { token: admin });
  assert.ok(fluxo.body.itens.some((l) => l.referencia_id === d.body.id && l.tipo === 'SAIDA'));
});

test('dashboard bate com o banco', async () => {
  const dash = (await req('GET', '/relatorios/dashboard', { token: admin })).body;
  const todos = (await req('GET', '/veiculos?pageSize=100', { token: admin })).body;
  assert.equal(dash.estoque.total, todos.total);
  const vendidos = (await req('GET', '/veiculos?status=VENDIDO&pageSize=100', { token: admin })).body.total;
  assert.equal(dash.estoque.vendidos, vendidos);
  const vendas = (await req('GET', '/vendas?pageSize=1', { token: admin })).body;
  assert.equal(dash.vendas.quantidade, vendas.total);
  assert.equal(Math.round(dash.vendas.faturamento * 100), Math.round(vendas.soma * 100));
});
