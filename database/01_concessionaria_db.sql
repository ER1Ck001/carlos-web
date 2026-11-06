-- =====================================================================
--  01_concessionaria_db.sql
--  Banco operacional da concessionária: usuários, clientes, veículos,
--  movimentações de estoque e vendas.
--
--  Execute este script PRIMEIRO no MySQL Workbench (MySQL 8.0.16+).
--  É seguro executá-lo mais de uma vez: nada é apagado.
-- =====================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS concessionaria_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE concessionaria_db;

-- ---------------------------------------------------------------------
-- usuarios: quem acessa o sistema (administradores e vendedores)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  senha_hash    VARCHAR(255) NOT NULL,             -- bcrypt, nunca texto puro
  perfil        ENUM('ADMIN','VENDEDOR') NOT NULL DEFAULT 'VENDEDOR',
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  data_criacao  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_email (email),
  KEY idx_usuarios_perfil (perfil, ativo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(150) NOT NULL,
  cpf            CHAR(11) NOT NULL,                -- somente dígitos
  telefone       VARCHAR(20) NULL,
  email          VARCHAR(160) NULL,
  endereco       VARCHAR(255) NULL,
  data_cadastro  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_clientes_cpf (cpf),
  KEY idx_clientes_nome (nome),
  KEY idx_clientes_telefone (telefone)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- veiculos
--  status: DISPONIVEL | RESERVADO | VENDIDO
--  placa/chassi são opcionais (0 km pode não ter placa), mas únicos
--  quando informados (índice UNIQUE aceita vários NULL).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  marca          VARCHAR(60)  NOT NULL,
  modelo         VARCHAR(80)  NOT NULL,
  ano            SMALLINT UNSIGNED NOT NULL,
  cor            VARCHAR(40)  NULL,
  placa          VARCHAR(7)   NULL,
  chassi         VARCHAR(17)  NULL,
  quilometragem  INT UNSIGNED NOT NULL DEFAULT 0,
  valor_compra   DECIMAL(12,2) NOT NULL,
  valor_venda    DECIMAL(12,2) NOT NULL,
  status         ENUM('DISPONIVEL','RESERVADO','VENDIDO') NOT NULL DEFAULT 'DISPONIVEL',
  observacoes    TEXT NULL,
  data_cadastro  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_veiculos_placa (placa),
  UNIQUE KEY uk_veiculos_chassi (chassi),
  KEY idx_veiculos_status (status),
  KEY idx_veiculos_marca_modelo (marca, modelo),
  KEY idx_veiculos_ano (ano),
  CONSTRAINT ck_veiculos_valor_compra CHECK (valor_compra >= 0),
  CONSTRAINT ck_veiculos_valor_venda  CHECK (valor_venda  >= 0),
  CONSTRAINT ck_veiculos_ano          CHECK (ano BETWEEN 1900 AND 2100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- estoque: histórico de movimentações de cada veículo
--  ENTRADA        - veículo entrou no estoque (cadastro)
--  SAIDA          - veículo saiu por venda
--  RESERVA        - veículo reservado para um cliente
--  LIBERACAO      - reserva cancelada, veículo volta a ficar disponível
--  TRANSFERENCIA  - mudança de localização (pátio, showroom, oficina...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estoque (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  veiculo_id         INT UNSIGNED NOT NULL,
  tipo_movimentacao  ENUM('ENTRADA','SAIDA','RESERVA','LIBERACAO','TRANSFERENCIA') NOT NULL,
  quantidade         INT UNSIGNED NOT NULL DEFAULT 1,
  localizacao        VARCHAR(80) NULL,
  observacao         VARCHAR(255) NULL,
  usuario_id         INT UNSIGNED NOT NULL,
  data_movimentacao  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_estoque_veiculo (veiculo_id, data_movimentacao),
  KEY idx_estoque_data (data_movimentacao),
  KEY idx_estoque_usuario (usuario_id),
  CONSTRAINT ck_estoque_quantidade CHECK (quantidade > 0),
  CONSTRAINT fk_estoque_veiculo FOREIGN KEY (veiculo_id)
    REFERENCES veiculos (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_estoque_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- vendas
--  valor_venda = preço negociado; desconto é abatido dele.
--  Valor líquido = valor_venda - desconto (calculado, não armazenado).
--  UNIQUE em veiculo_id impede, no próprio banco, vender o mesmo
--  veículo duas vezes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendas (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  veiculo_id       INT UNSIGNED NOT NULL,
  cliente_id       INT UNSIGNED NOT NULL,
  usuario_id       INT UNSIGNED NOT NULL,          -- vendedor
  data_venda       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor_venda      DECIMAL(12,2) NOT NULL,
  desconto         DECIMAL(12,2) NOT NULL DEFAULT 0,
  forma_pagamento  ENUM('PIX','DINHEIRO','CARTAO_DEBITO','CARTAO_CREDITO','BOLETO','FINANCIAMENTO') NOT NULL,
  observacoes      TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_vendas_veiculo (veiculo_id),
  KEY idx_vendas_cliente (cliente_id),
  KEY idx_vendas_usuario (usuario_id),
  KEY idx_vendas_data (data_venda),
  CONSTRAINT ck_vendas_valor    CHECK (valor_venda > 0),
  CONSTRAINT ck_vendas_desconto CHECK (desconto >= 0 AND desconto < valor_venda),
  CONSTRAINT fk_vendas_veiculo FOREIGN KEY (veiculo_id)
    REFERENCES veiculos (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_vendas_cliente FOREIGN KEY (cliente_id)
    REFERENCES clientes (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_vendas_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Conferência rápida
SELECT 'concessionaria_db criado' AS resultado,
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema = 'concessionaria_db') AS total_tabelas;
