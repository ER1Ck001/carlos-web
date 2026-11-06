-- =====================================================================
--  02_financeiro_db.sql
--  Banco financeiro: pagamentos, despesas, comissões e fluxo de caixa.
--
--  Execute este script DEPOIS do 01_concessionaria_db.sql.
--  É seguro executá-lo mais de uma vez: nada é apagado.
--
--  Relacionamentos com o outro banco (venda_id -> concessionaria_db.vendas,
--  vendedor_id -> concessionaria_db.usuarios) são validados pelo backend,
--  mantendo os dois bancos independentes. Todas essas colunas têm índice.
-- =====================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS financeiro_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE financeiro_db;

-- ---------------------------------------------------------------------
-- pagamentos: parcelas a receber referentes a cada venda
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagamentos (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venda_id         INT UNSIGNED NOT NULL,          -- concessionaria_db.vendas.id
  valor            DECIMAL(12,2) NOT NULL,
  forma_pagamento  ENUM('PIX','DINHEIRO','CARTAO_DEBITO','CARTAO_CREDITO','BOLETO','FINANCIAMENTO') NOT NULL,
  data_vencimento  DATE NOT NULL,
  data_pagamento   DATE NULL,
  status           ENUM('PENDENTE','PAGO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  descricao        VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_pagamentos_venda (venda_id),
  KEY idx_pagamentos_status_venc (status, data_vencimento),
  CONSTRAINT ck_pagamentos_valor CHECK (valor > 0),
  CONSTRAINT ck_pagamentos_pago  CHECK (status <> 'PAGO' OR data_pagamento IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- despesas: contas a pagar da concessionária
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS despesas (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  descricao        VARCHAR(255) NOT NULL,
  categoria        ENUM('ALUGUEL','SALARIOS','MANUTENCAO','MARKETING','IMPOSTOS','UTILIDADES','COMPRA_VEICULO','OUTROS') NOT NULL DEFAULT 'OUTROS',
  valor            DECIMAL(12,2) NOT NULL,
  data_despesa     DATE NOT NULL,
  data_vencimento  DATE NULL,
  status           ENUM('PENDENTE','PAGO') NOT NULL DEFAULT 'PENDENTE',
  PRIMARY KEY (id),
  KEY idx_despesas_status_venc (status, data_vencimento),
  KEY idx_despesas_data (data_despesa),
  KEY idx_despesas_categoria (categoria),
  CONSTRAINT ck_despesas_valor CHECK (valor > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- comissoes: uma comissão por venda (UNIQUE em venda_id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comissoes (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venda_id      INT UNSIGNED NOT NULL,             -- concessionaria_db.vendas.id
  vendedor_id   INT UNSIGNED NOT NULL,             -- concessionaria_db.usuarios.id
  percentual    DECIMAL(5,2) NOT NULL,
  valor         DECIMAL(12,2) NOT NULL,
  data_calculo  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status        ENUM('PENDENTE','PAGA') NOT NULL DEFAULT 'PENDENTE',
  PRIMARY KEY (id),
  UNIQUE KEY uk_comissoes_venda (venda_id),
  KEY idx_comissoes_vendedor (vendedor_id, status),
  CONSTRAINT ck_comissoes_percentual CHECK (percentual >= 0 AND percentual <= 100),
  CONSTRAINT ck_comissoes_valor      CHECK (valor >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- fluxo_caixa: somente dinheiro que efetivamente entrou ou saiu.
--  origem + referencia_id apontam para o registro que gerou o lançamento
--  (pagamento, despesa ou comissão). Lançamentos MANUAIS não têm
--  referência. O índice único impede lançar o mesmo registro duas vezes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fluxo_caixa (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo               ENUM('ENTRADA','SAIDA') NOT NULL,
  descricao          VARCHAR(255) NOT NULL,
  valor              DECIMAL(12,2) NOT NULL,
  data_movimentacao  DATE NOT NULL,
  origem             ENUM('PAGAMENTO','DESPESA','COMISSAO','MANUAL') NOT NULL,
  referencia_id      INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_fluxo_origem_ref (origem, referencia_id),
  KEY idx_fluxo_data (data_movimentacao, tipo),
  CONSTRAINT ck_fluxo_valor CHECK (valor > 0),
  CONSTRAINT ck_fluxo_ref   CHECK (origem = 'MANUAL' OR referencia_id IS NOT NULL)
) ENGINE=InnoDB;

-- Conferência rápida
SELECT 'financeiro_db criado' AS resultado,
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema = 'financeiro_db') AS total_tabelas;
