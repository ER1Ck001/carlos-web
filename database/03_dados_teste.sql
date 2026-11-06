-- =====================================================================
--  03_dados_teste.sql
--  Dados FICTÍCIOS para testes (usuários, clientes, veículos, vendas,
--  pagamentos, comissões, despesas e fluxo de caixa).
--
--  Execute DEPOIS do 01 e do 02.
--  - Tudo roda dentro de uma transação: ou entra tudo, ou nada.
--  - IDs gerados automaticamente são recuperados por chaves únicas
--    (e-mail, CPF, chassi), nunca supostos.
--  - Se o banco já tiver usuários, o script é interrompido para não
--    duplicar nem misturar dados.
--  - As datas são relativas ao dia da execução, para o dashboard
--    sempre mostrar movimento recente.
--
--  Usuários de teste:
--    admin@concessionaria.local   / Admin@123     (ADMIN)
--    carla@concessionaria.local   / Vendedor@123  (VENDEDOR)
--    rafael@concessionaria.local  / Vendedor@123  (VENDEDOR)
-- =====================================================================

SET NAMES utf8mb4;

USE concessionaria_db;

DROP PROCEDURE IF EXISTS sp_carregar_dados_teste;

DELIMITER $$

CREATE PROCEDURE sp_carregar_dados_teste()
BEGIN
  DECLARE v_admin, v_carla, v_rafael INT UNSIGNED;
  DECLARE c1, c2, c3, c4, c5, c6, c7, c8 INT UNSIGNED;
  DECLARE v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14 INT UNSIGNED;
  DECLARE s1, s2, s3, s4, s5, s6, s7 INT UNSIGNED;
  DECLARE p_id INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF (SELECT COUNT(*) FROM concessionaria_db.usuarios) > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Ja existem usuarios em concessionaria_db. Dados de teste nao foram inseridos.';
  END IF;

  START TRANSACTION;

  -- ------------------------------------------------------------- usuários
  INSERT INTO concessionaria_db.usuarios (nome, email, senha_hash, perfil, ativo, data_criacao) VALUES
    ('Administrador',  'admin@concessionaria.local',  '$2b$10$HUtR0SVmd.BSj37ssICzkuX/BeUwCvemnu9/bJAyJPRg95FmYTFY.', 'ADMIN',    1, DATE_SUB(NOW(), INTERVAL 200 DAY)),
    ('Carla Mendes',   'carla@concessionaria.local',  '$2b$10$tUzEt9WgHti0W0Q.R8YqA.wwNljGUqn.wvLAtMQJ7543B4V/.bjxa', 'VENDEDOR', 1, DATE_SUB(NOW(), INTERVAL 190 DAY)),
    ('Rafael Souza',   'rafael@concessionaria.local', '$2b$10$tUzEt9WgHti0W0Q.R8YqA.wwNljGUqn.wvLAtMQJ7543B4V/.bjxa', 'VENDEDOR', 1, DATE_SUB(NOW(), INTERVAL 185 DAY));

  SELECT id INTO v_admin  FROM concessionaria_db.usuarios WHERE email = 'admin@concessionaria.local';
  SELECT id INTO v_carla  FROM concessionaria_db.usuarios WHERE email = 'carla@concessionaria.local';
  SELECT id INTO v_rafael FROM concessionaria_db.usuarios WHERE email = 'rafael@concessionaria.local';

  -- ------------------------------------------------------------- clientes
  INSERT INTO concessionaria_db.clientes (nome, cpf, telefone, email, endereco, data_cadastro) VALUES
    ('Ana Beatriz Lima',     '12345678062', '(62) 99100-0001', 'ana.lima@exemplo.com',      'Rua das Acácias, 100 - Centro, Cidade Exemplo/GO',    DATE_SUB(NOW(), INTERVAL 170 DAY)),
    ('Bruno Carvalho',       '23456789173', '(62) 99100-0002', 'bruno.carvalho@exemplo.com','Av. Brasil, 250 - Jardim Norte, Cidade Exemplo/GO',  DATE_SUB(NOW(), INTERVAL 140 DAY)),
    ('Camila Ferreira',      '34567890256', '(62) 99100-0003', 'camila.f@exemplo.com',      'Rua 7, 45 - Setor Sul, Cidade Exemplo/GO',            DATE_SUB(NOW(), INTERVAL 110 DAY)),
    ('Diego Martins',        '45678901320', '(62) 99100-0004', 'diego.m@exemplo.com',       'Rua Goiás, 812 - Vila Nova, Cidade Exemplo/GO',       DATE_SUB(NOW(), INTERVAL 80 DAY)),
    ('Eduarda Rocha',        '56789012494', '(62) 99100-0005', 'eduarda.r@exemplo.com',     'Al. dos Ipês, 33 - Centro, Cidade Exemplo/GO',        DATE_SUB(NOW(), INTERVAL 50 DAY)),
    ('Felipe Andrade',       '67890123540', '(62) 99100-0006', 'felipe.a@exemplo.com',      'Rua Tocantins, 9 - Bairro Alto, Cidade Exemplo/GO',   DATE_SUB(NOW(), INTERVAL 25 DAY)),
    ('Gabriela Nunes',       '78901234696', '(62) 99100-0007', 'gabriela.n@exemplo.com',    'Av. Central, 1500 - Centro, Cidade Exemplo/GO',       DATE_SUB(NOW(), INTERVAL 10 DAY)),
    ('Henrique Barbosa',     '89012345723', '(62) 99100-0008', NULL,                        'Rua do Comércio, 77 - Centro, Cidade Exemplo/GO',     DATE_SUB(NOW(), INTERVAL 5 DAY));

  SELECT id INTO c1 FROM concessionaria_db.clientes WHERE cpf = '12345678062';
  SELECT id INTO c2 FROM concessionaria_db.clientes WHERE cpf = '23456789173';
  SELECT id INTO c3 FROM concessionaria_db.clientes WHERE cpf = '34567890256';
  SELECT id INTO c4 FROM concessionaria_db.clientes WHERE cpf = '45678901320';
  SELECT id INTO c5 FROM concessionaria_db.clientes WHERE cpf = '56789012494';
  SELECT id INTO c6 FROM concessionaria_db.clientes WHERE cpf = '67890123540';
  SELECT id INTO c7 FROM concessionaria_db.clientes WHERE cpf = '78901234696';
  SELECT id INTO c8 FROM concessionaria_db.clientes WHERE cpf = '89012345723';

  -- ------------------------------------------------------------- veículos
  INSERT INTO concessionaria_db.veiculos
    (marca, modelo, ano, cor, placa, chassi, quilometragem, valor_compra, valor_venda, status, observacoes, data_cadastro) VALUES
    ('Toyota',    'Corolla XEi 2.0',        2022, 'Prata',    'RTA1B23', '9BRTESTE000000001', 38500, 108000.00, 128900.00, 'VENDIDO',    'Único dono, revisões na concessionária.',  DATE_SUB(NOW(), INTERVAL 180 DAY)),
    ('Honda',     'Civic Touring 1.5 Turbo',2021, 'Preto',    'RTB2C34', '9BRTESTE000000002', 41200, 121000.00, 142000.00, 'VENDIDO',    NULL,                                       DATE_SUB(NOW(), INTERVAL 165 DAY)),
    ('Volkswagen','T-Cross Highline 1.4',   2023, 'Branco',   'RTC3D45', '9BRTESTE000000003', 19800, 101000.00, 119900.00, 'VENDIDO',    'Teto solar.',                              DATE_SUB(NOW(), INTERVAL 140 DAY)),
    ('Fiat',      'Argo Drive 1.0',         2020, 'Vermelho', 'RTD4E56', '9BRTESTE000000004', 55300,  50500.00,  62500.00, 'VENDIDO',    NULL,                                       DATE_SUB(NOW(), INTERVAL 110 DAY)),
    ('Hyundai',   'HB20 Platinum 1.0 TGDI', 2022, 'Azul',     'RTE5F67', '9BRTESTE000000005', 29900,  63000.00,  74900.00, 'VENDIDO',    NULL,                                       DATE_SUB(NOW(), INTERVAL 75 DAY)),
    ('Jeep',      'Compass Longitude T270', 2022, 'Cinza',    'RTF6G78', '9BRTESTE000000006', 33400, 134000.00, 159900.00, 'VENDIDO',    'Pacote de tecnologia.',                    DATE_SUB(NOW(), INTERVAL 45 DAY)),
    ('Chevrolet', 'Onix Plus Premier 1.0T', 2023, 'Branco',   'RTG7H89', '9BRTESTE000000007', 12100,  74000.00,  89900.00, 'VENDIDO',    NULL,                                       DATE_SUB(NOW(), INTERVAL 20 DAY)),
    ('Renault',   'Kwid Zen 1.0',           2021, 'Laranja',  'RTH8J90', '9BRTESTE000000008', 47800,  39000.00,  49900.00, 'DISPONIVEL', 'Ótimo para primeiro carro.',               DATE_SUB(NOW(), INTERVAL 60 DAY)),
    ('Toyota',    'Hilux SRX 2.8 Diesel',   2023, 'Preto',    'RTJ9K01', '9BRTESTE000000009', 22500, 248000.00, 284900.00, 'DISPONIVEL', '4x4, automática.',                         DATE_SUB(NOW(), INTERVAL 35 DAY)),
    ('Volkswagen','Nivus Highline 1.0 TSI', 2024, 'Cinza',    'RTK0L12', '9BRTESTE000000010',  8700, 112000.00, 129900.00, 'DISPONIVEL', NULL,                                       DATE_SUB(NOW(), INTERVAL 18 DAY)),
    ('Nissan',    'Kicks Advance 1.6',      2022, 'Vermelho', 'RTL1M23', '9BRTESTE000000011', 31000,  86000.00, 102900.00, 'RESERVADO',  'Reservado aguardando aprovação de crédito.',DATE_SUB(NOW(), INTERVAL 28 DAY)),
    ('Fiat',      'Toro Volcano 2.0 Diesel',2023, 'Branco',   'RTM2N34', '9BRTESTE000000012', 26400, 152000.00, 176900.00, 'DISPONIVEL', NULL,                                       DATE_SUB(NOW(), INTERVAL 12 DAY)),
    ('Honda',     'HR-V EXL 1.5 Turbo',     2025, 'Prata',    NULL,      '9BRTESTE000000013',     0, 158000.00, 184900.00, 'DISPONIVEL', '0 km, aguardando emplacamento.',           DATE_SUB(NOW(), INTERVAL 4 DAY)),
    ('Chevrolet', 'Tracker LTZ 1.0 Turbo',  2022, 'Azul',     'RTN3P45', '9BRTESTE000000014', 36200,  92000.00, 109900.00, 'DISPONIVEL', NULL,                                       DATE_SUB(NOW(), INTERVAL 120 DAY));

  SELECT id INTO v1  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000001';
  SELECT id INTO v2  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000002';
  SELECT id INTO v3  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000003';
  SELECT id INTO v4  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000004';
  SELECT id INTO v5  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000005';
  SELECT id INTO v6  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000006';
  SELECT id INTO v7  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000007';
  SELECT id INTO v8  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000008';
  SELECT id INTO v9  FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000009';
  SELECT id INTO v10 FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000010';
  SELECT id INTO v11 FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000011';
  SELECT id INTO v12 FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000012';
  SELECT id INTO v13 FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000013';
  SELECT id INTO v14 FROM concessionaria_db.veiculos WHERE chassi = '9BRTESTE000000014';

  -- ------------------------------------------------- entradas no estoque
  INSERT INTO concessionaria_db.estoque (veiculo_id, tipo_movimentacao, quantidade, localizacao, observacao, usuario_id, data_movimentacao)
  SELECT id, 'ENTRADA', 1,
         CASE WHEN MOD(id, 3) = 0 THEN 'Showroom' WHEN MOD(id, 3) = 1 THEN 'Pátio A' ELSE 'Pátio B' END,
         'Entrada inicial no estoque', v_admin, data_cadastro
    FROM concessionaria_db.veiculos;

  INSERT INTO concessionaria_db.estoque (veiculo_id, tipo_movimentacao, quantidade, localizacao, observacao, usuario_id, data_movimentacao) VALUES
    (v9,  'TRANSFERENCIA', 1, 'Showroom', 'Destaque da vitrine',              v_admin, DATE_SUB(NOW(), INTERVAL 30 DAY)),
    (v11, 'RESERVA',       1, NULL,       'Reserva para cliente Gabriela Nunes', v_carla, DATE_SUB(NOW(), INTERVAL 9 DAY));

  -- ------------------------------------------------------------- vendas
  INSERT INTO concessionaria_db.vendas (veiculo_id, cliente_id, usuario_id, data_venda, valor_venda, desconto, forma_pagamento, observacoes) VALUES
    (v1, c1, v_carla,  DATE_SUB(NOW(), INTERVAL 160 DAY), 128900.00, 1900.00, 'PIX',            NULL),
    (v2, c2, v_rafael, DATE_SUB(NOW(), INTERVAL 130 DAY), 142000.00, 2000.00, 'FINANCIAMENTO',  'Financiado pelo Banco Exemplo.'),
    (v3, c3, v_carla,  DATE_SUB(NOW(), INTERVAL 100 DAY), 119900.00,  900.00, 'BOLETO',         'Parcelado em 3 boletos.'),
    (v4, c4, v_rafael, DATE_SUB(NOW(), INTERVAL  70 DAY),  62500.00,  500.00, 'DINHEIRO',       NULL),
    (v5, c5, v_carla,  DATE_SUB(NOW(), INTERVAL  40 DAY),  74900.00,    0.00, 'CARTAO_CREDITO', 'Cartão em 2x.'),
    (v6, c6, v_rafael, DATE_SUB(NOW(), INTERVAL  15 DAY), 159900.00, 4900.00, 'PIX',            NULL),
    (v7, c1, v_carla,  DATE_SUB(NOW(), INTERVAL   3 DAY),  89900.00, 1900.00, 'FINANCIAMENTO',  'Segundo veículo da cliente.');

  SELECT id INTO s1 FROM concessionaria_db.vendas WHERE veiculo_id = v1;
  SELECT id INTO s2 FROM concessionaria_db.vendas WHERE veiculo_id = v2;
  SELECT id INTO s3 FROM concessionaria_db.vendas WHERE veiculo_id = v3;
  SELECT id INTO s4 FROM concessionaria_db.vendas WHERE veiculo_id = v4;
  SELECT id INTO s5 FROM concessionaria_db.vendas WHERE veiculo_id = v5;
  SELECT id INTO s6 FROM concessionaria_db.vendas WHERE veiculo_id = v6;
  SELECT id INTO s7 FROM concessionaria_db.vendas WHERE veiculo_id = v7;

  -- saídas de estoque por venda
  INSERT INTO concessionaria_db.estoque (veiculo_id, tipo_movimentacao, quantidade, localizacao, observacao, usuario_id, data_movimentacao)
  SELECT ve.veiculo_id, 'SAIDA', 1, NULL, CONCAT('Saída por venda #', ve.id), ve.usuario_id, ve.data_venda
    FROM concessionaria_db.vendas ve;

  -- ----------------------------------------------- pagamentos (financeiro_db)
  INSERT INTO financeiro_db.pagamentos (venda_id, valor, forma_pagamento, data_vencimento, data_pagamento, status, descricao) VALUES
    (s1, 127000.00, 'PIX',            DATE(DATE_SUB(NOW(), INTERVAL 160 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 160 DAY)), 'PAGO',     CONCAT('Venda #', s1, ' - pagamento à vista')),
    (s2, 140000.00, 'FINANCIAMENTO',  DATE(DATE_SUB(NOW(), INTERVAL 115 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 116 DAY)), 'PAGO',     CONCAT('Venda #', s2, ' - repasse do financiamento')),
    (s3,  39666.67, 'BOLETO',         DATE(DATE_SUB(NOW(), INTERVAL  70 DAY)), DATE(DATE_SUB(NOW(), INTERVAL  70 DAY)), 'PAGO',     CONCAT('Venda #', s3, ' - parcela 1/3')),
    (s3,  39666.67, 'BOLETO',         DATE(DATE_SUB(NOW(), INTERVAL  40 DAY)), DATE(DATE_SUB(NOW(), INTERVAL  41 DAY)), 'PAGO',     CONCAT('Venda #', s3, ' - parcela 2/3')),
    (s3,  39666.66, 'BOLETO',         DATE(DATE_SUB(NOW(), INTERVAL  10 DAY)), NULL,                                    'PENDENTE', CONCAT('Venda #', s3, ' - parcela 3/3')),
    (s4,  62000.00, 'DINHEIRO',       DATE(DATE_SUB(NOW(), INTERVAL  70 DAY)), DATE(DATE_SUB(NOW(), INTERVAL  70 DAY)), 'PAGO',     CONCAT('Venda #', s4, ' - pagamento à vista')),
    (s5,  37450.00, 'CARTAO_CREDITO', DATE(DATE_SUB(NOW(), INTERVAL  10 DAY)), DATE(DATE_SUB(NOW(), INTERVAL  10 DAY)), 'PAGO',     CONCAT('Venda #', s5, ' - parcela 1/2')),
    (s5,  37450.00, 'CARTAO_CREDITO', DATE(DATE_ADD(NOW(), INTERVAL  20 DAY)), NULL,                                    'PENDENTE', CONCAT('Venda #', s5, ' - parcela 2/2')),
    (s6, 155000.00, 'PIX',            DATE(DATE_SUB(NOW(), INTERVAL  15 DAY)), DATE(DATE_SUB(NOW(), INTERVAL  15 DAY)), 'PAGO',     CONCAT('Venda #', s6, ' - pagamento à vista')),
    (s7,  88000.00, 'FINANCIAMENTO',  DATE(DATE_ADD(NOW(), INTERVAL  12 DAY)), NULL,                                    'PENDENTE', CONCAT('Venda #', s7, ' - repasse do financiamento'));

  -- cada pagamento PAGO gera uma entrada no fluxo de caixa
  INSERT INTO financeiro_db.fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem, referencia_id)
  SELECT 'ENTRADA', descricao, valor, data_pagamento, 'PAGAMENTO', id
    FROM financeiro_db.pagamentos WHERE status = 'PAGO';

  -- ----------------------------------------------- comissões (2% do líquido)
  INSERT INTO financeiro_db.comissoes (venda_id, vendedor_id, percentual, valor, data_calculo, status)
  SELECT ve.id, ve.usuario_id, 2.00, ROUND((ve.valor_venda - ve.desconto) * 0.02, 2), ve.data_venda,
         CASE WHEN ve.id IN (s1, s2, s3, s4) THEN 'PAGA' ELSE 'PENDENTE' END
    FROM concessionaria_db.vendas ve;

  INSERT INTO financeiro_db.fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem, referencia_id)
  SELECT 'SAIDA', CONCAT('Comissão da venda #', co.venda_id), co.valor,
         DATE(DATE_ADD(co.data_calculo, INTERVAL 30 DAY)), 'COMISSAO', co.id
    FROM financeiro_db.comissoes co WHERE co.status = 'PAGA';

  -- ------------------------------------------------------------- despesas
  INSERT INTO financeiro_db.despesas (descricao, categoria, valor, data_despesa, data_vencimento, status) VALUES
    ('Aluguel do galpão - 3 meses atrás',  'ALUGUEL',    18000.00, DATE(DATE_SUB(NOW(), INTERVAL 95 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 85 DAY)), 'PAGO'),
    ('Aluguel do galpão - 2 meses atrás',  'ALUGUEL',    18000.00, DATE(DATE_SUB(NOW(), INTERVAL 65 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 55 DAY)), 'PAGO'),
    ('Aluguel do galpão - mês passado',    'ALUGUEL',    18000.00, DATE(DATE_SUB(NOW(), INTERVAL 35 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 25 DAY)), 'PAGO'),
    ('Aluguel do galpão - mês atual',      'ALUGUEL',    18000.00, DATE(DATE_SUB(NOW(), INTERVAL  5 DAY)), DATE(DATE_ADD(NOW(), INTERVAL  5 DAY)), 'PENDENTE'),
    ('Folha de pagamento',                 'SALARIOS',   42000.00, DATE(DATE_SUB(NOW(), INTERVAL 30 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 25 DAY)), 'PAGO'),
    ('Folha de pagamento',                 'SALARIOS',   42000.00, DATE(NOW()),                            DATE(DATE_ADD(NOW(), INTERVAL  5 DAY)), 'PENDENTE'),
    ('Campanha em redes sociais',          'MARKETING',   3500.00, DATE(DATE_SUB(NOW(), INTERVAL 32 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 30 DAY)), 'PAGO'),
    ('Manutenção do elevador automotivo',  'MANUTENCAO',  1200.00, DATE(DATE_SUB(NOW(), INTERVAL 12 DAY)), DATE(DATE_SUB(NOW(), INTERVAL  3 DAY)), 'PENDENTE'),
    ('Conta de energia',                   'UTILIDADES',  2100.00, DATE(DATE_SUB(NOW(), INTERVAL 25 DAY)), DATE(DATE_SUB(NOW(), INTERVAL 20 DAY)), 'PAGO'),
    ('Impostos municipais',                'IMPOSTOS',    6800.00, DATE(DATE_SUB(NOW(), INTERVAL  2 DAY)), DATE(DATE_ADD(NOW(), INTERVAL 15 DAY)), 'PENDENTE');

  INSERT INTO financeiro_db.fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem, referencia_id)
  SELECT 'SAIDA', descricao, valor, data_vencimento, 'DESPESA', id
    FROM financeiro_db.despesas WHERE status = 'PAGO';

  -- receita avulsa lançada manualmente
  INSERT INTO financeiro_db.fluxo_caixa (tipo, descricao, valor, data_movimentacao, origem, referencia_id) VALUES
    ('ENTRADA', 'Serviço de despachante (documentação)', 1500.00, DATE(DATE_SUB(NOW(), INTERVAL 8 DAY)), 'MANUAL', NULL);

  COMMIT;
END$$

DELIMITER ;

CALL sp_carregar_dados_teste();
DROP PROCEDURE IF EXISTS sp_carregar_dados_teste;

-- ------------------------------------------------------------ conferência
SELECT 'usuarios'    AS tabela, COUNT(*) AS registros FROM concessionaria_db.usuarios
UNION ALL SELECT 'clientes',    COUNT(*) FROM concessionaria_db.clientes
UNION ALL SELECT 'veiculos',    COUNT(*) FROM concessionaria_db.veiculos
UNION ALL SELECT 'estoque',     COUNT(*) FROM concessionaria_db.estoque
UNION ALL SELECT 'vendas',      COUNT(*) FROM concessionaria_db.vendas
UNION ALL SELECT 'pagamentos',  COUNT(*) FROM financeiro_db.pagamentos
UNION ALL SELECT 'despesas',    COUNT(*) FROM financeiro_db.despesas
UNION ALL SELECT 'comissoes',   COUNT(*) FROM financeiro_db.comissoes
UNION ALL SELECT 'fluxo_caixa', COUNT(*) FROM financeiro_db.fluxo_caixa;
