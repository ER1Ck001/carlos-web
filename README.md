# AutoGestor: Sistema de Estoque para Concessionária

Sistema web para controlar o estoque de veículos, os clientes, as vendas e o financeiro de uma concessionária. São **dois bancos MySQL independentes**, usados pela mesma aplicação:

| Banco | O que guarda |
|---|---|
| `concessionaria_db` | usuários, clientes, veículos, movimentações de estoque e vendas |
| `financeiro_db` | pagamentos, despesas, comissões e fluxo de caixa |

```
Navegador (React)  →  API (Node.js + Express)  →  MySQL ─┬─ concessionaria_db
                                                         └─ financeiro_db
```

## Tecnologias

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4, React Router, Recharts (gráficos), Lucide (ícones)
- **Backend:** Node.js + Express 5 + TypeScript, mysql2 (consultas parametrizadas), Zod (validação), bcrypt (senhas), JWT (login)
- **Banco:** MySQL 8.0.16 ou mais novo (scripts prontos para o MySQL Workbench)

## Estrutura

```
concessionaria/
├── database/
│   ├── 01_concessionaria_db.sql   cria o banco operacional
│   ├── 02_financeiro_db.sql       cria o banco financeiro
│   └── 03_dados_teste.sql         usuários, clientes, veículos e vendas fictícios
├── backend/
│   ├── .env.example               modelo das variáveis de ambiente
│   ├── src/
│   │   ├── config/                variáveis de ambiente e conexão com os 2 bancos
│   │   ├── middlewares/           autenticação, permissões e tratamento de erros
│   │   ├── modules/               auth, usuarios, veiculos, estoque, clientes,
│   │   │                          vendas, financeiro, relatorios
│   │   └── utils/                 validações (CPF, placa, chassi…) e auxiliares
│   └── tests/api.test.mjs         testes de ponta a ponta da API
└── frontend/
    └── src/
        ├── pages/                 telas (dashboard, veículos, vendas, financeiro…)
        ├── components/            layout, formulários e componentes de interface
        ├── contexts/              login e avisos
        └── lib/                   acesso à API e formatação
```

## Requisitos

- **Node.js 20.19 ou mais novo** (recomendado: 22 LTS). Para conferir: `node -v`
- **MySQL Server 8** e **MySQL Workbench**

## Passo a passo

### 1. Criar os bancos no MySQL Workbench

Abra a conexão local no Workbench e execute os scripts **nesta ordem**, cada um com *File › Open SQL Script* e depois o raio ⚡ (*Execute*):

1. `database/01_concessionaria_db.sql`
2. `database/02_financeiro_db.sql`
3. `database/03_dados_teste.sql`

Os scripts 01 e 02 podem ser executados de novo sem apagar nada. O 03 roda dentro de uma transação e recusa a execução se já houver usuários, para não duplicar os dados.

**Para conferir se deu certo**, clique em *Refresh* no painel *Schemas*: devem aparecer `concessionaria_db` e `financeiro_db`. Depois execute:

```sql
SHOW DATABASES LIKE '%_db';

SELECT table_schema AS banco, table_name AS tabela, table_rows AS linhas_aprox
  FROM information_schema.tables
 WHERE table_schema IN ('concessionaria_db', 'financeiro_db')
 ORDER BY banco, tabela;
```

O resultado esperado é 5 tabelas no `concessionaria_db` (clientes, estoque, usuarios, veiculos, vendas) e 4 no `financeiro_db` (comissoes, despesas, fluxo_caixa, pagamentos). O próprio script 03 também termina mostrando quantos registros inseriu em cada tabela (14 veículos, 8 clientes, 7 vendas…).

> **Recomendado:** crie um usuário MySQL só para a aplicação em vez de usar o `root`:
> ```sql
> CREATE USER 'concessionaria_app'@'localhost' IDENTIFIED BY 'escolha-uma-senha';
> GRANT SELECT, INSERT, UPDATE, DELETE ON concessionaria_db.* TO 'concessionaria_app'@'localhost';
> GRANT SELECT, INSERT, UPDATE, DELETE ON financeiro_db.*     TO 'concessionaria_app'@'localhost';
> ```

### 2. Configurar e iniciar o backend

```bash
cd backend
npm install
```

Copie `.env.example` para `.env` (no Windows: `copy .env.example .env`) e preencha com os dados do **seu** MySQL:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=concessionaria_app
DB_PASSWORD=escolha-uma-senha
JWT_SECRET=um-texto-longo-e-aleatorio-qualquer
```

O arquivo `.env` não deve ir para o GitHub; ele já está no `.gitignore`.

```bash
npm run dev
```

Se a conexão funcionar, o terminal mostra:

```
[db] conectado: concessionaria_db
[db] conectado: financeiro_db
[api] rodando em http://localhost:3333
```

Para checar pelo navegador, abra http://localhost:3333/api/health, que deve mostrar `"status":"ok"` com os dois bancos.

### 3. Iniciar o frontend

Em **outro terminal**:

```bash
cd frontend
npm install
npm run dev
```

Abra **http://localhost:5173**.

### 4. Entrar

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@concessionaria.local` | `Admin@123` |
| Vendedor | `carla@concessionaria.local` | `Vendedor@123` |
| Vendedor | `rafael@concessionaria.local` | `Vendedor@123` |

Troque as senhas em *Minha conta* (canto inferior do menu) se for usar o sistema de verdade.

## O que cada perfil pode fazer

| | Administrador | Vendedor |
|---|:-:|:-:|
| Dashboard | completo, com financeiro | estoque e as próprias vendas |
| Veículos: consultar | ✓ | ✓ |
| Veículos: cadastrar, editar, excluir | ✓ | — |
| Estoque: reservar, liberar, transferir | ✓ | ✓ |
| Clientes: cadastrar, editar | ✓ | ✓ |
| Clientes: excluir | ✓ | — |
| Vendas: registrar | ✓ (escolhe o vendedor) | ✓ (em seu nome) |
| Vendas: consultar | todas | só as próprias |
| Financeiro e relatórios | ✓ | — |
| Usuários | ✓ | — |

As permissões são verificadas **no backend**: esconder um botão na tela não basta, e a API recusa a ação com o código 403.

## Regras de negócio

- **Venda em transação única nos dois bancos.** O veículo é travado (`SELECT … FOR UPDATE`). A transação grava a venda, marca o veículo como `VENDIDO`, registra a `SAIDA` no estoque e gera os pagamentos e a comissão no `financeiro_db`. Se qualquer etapa falhar, tudo é desfeito.
- **Não há venda dupla.** O sistema confere o status do veículo antes da venda, o índice `UNIQUE` em `vendas.veiculo_id` impede duplicidade no próprio banco e a trava evita vendas simultâneas.
- **Os pagamentos dependem da forma de pagamento:**
  - Pix, dinheiro e débito entram como recebidos no fluxo de caixa no mesmo dia.
  - Cartão de crédito e boleto viram parcelas mensais de 1x a 12x.
  - O financiamento vira um repasse pendente em 15 dias.
- **Comissão:** um percentual sobre o valor líquido (padrão de 2%, configurável em `COMISSAO_PERCENTUAL_PADRAO`). O administrador pode recalcular a comissão enquanto ela estiver pendente.
- **Fluxo de caixa:** registra só o dinheiro que realmente entrou ou saiu. Cada lançamento aponta para o pagamento, despesa ou comissão que o gerou, e um índice único impede lançar o mesmo registro duas vezes.
- **Integridade entre os bancos:** o MySQL não permite chave estrangeira entre bancos diferentes, então `venda_id` e `vendedor_id` do `financeiro_db` são validados pelo backend e têm índice.
- **Histórico preservado:**
  - Veículo vendido ou reservado não pode ser excluído, e de um vendido só as observações podem ser editadas.
  - Cliente com compras não pode ser excluído.
  - Despesa já paga não pode ser alterada.
  - Pagamentos e vendas nunca são apagados.
- **Validações no frontend e no backend:**
  - CPF (com dígitos verificadores) e placa (antiga ou Mercosul) são conferidos.
  - Chassi precisa ter 17 caracteres.
  - Preços e quantidades não podem ser negativos, e o desconto tem de ser menor que o preço.
  - Placa, chassi, CPF e e-mail não podem se repetir.
- **Segurança:**
  - Senhas são guardadas com bcrypt e o login usa token JWT.
  - Todas as consultas são parametrizadas, o que impede SQL injection.
  - As credenciais ficam só no `.env`.
  - Há limite de tentativas de login, e um usuário desativado perde o acesso na hora.

## Testes automatizados

Com o backend rodando e os dados de teste carregados:

```bash
cd backend
npm run test:api
```

Os 11 testes cobrem:

- os dois bancos conectados;
- login e permissões;
- validações e duplicidade de placa, chassi e CPF;
- a venda completa: estoque, parcelas, comissão e fluxo de caixa;
- a tentativa de venda dupla e 5 vendas simultâneas do mesmo veículo;
- a integridade nas exclusões;
- despesas;
- os números do dashboard conferidos com o banco.

> Os testes criam registros (veículos e vendas de teste). Para voltar aos dados originais, apague os dois bancos (`DROP DATABASE concessionaria_db; DROP DATABASE financeiro_db;`) e execute os scripts 01, 02 e 03 de novo.

## Rodar como produção (opcional)

```bash
cd frontend && npm run build
cd ../backend && npm run build && npm start
```

O backend passa a servir também o site compilado, tudo em **http://localhost:3333**.

## Problemas comuns

| Mensagem | Solução |
|---|---|
| `Variáveis de ambiente inválidas` | O arquivo `backend/.env` não existe ou falta `DB_USER`/`JWT_SECRET`. Copie o `.env.example`. |
| `Acesso negado ao MySQL` | Usuário ou senha errados no `.env`. Teste os mesmos dados no Workbench. |
| `Não foi possível conectar ao MySQL` | O serviço MySQL está parado ou `DB_HOST`/`DB_PORT` estão errados. No Windows, inicie o serviço **MySQL80** em *Serviços*. |
| `Banco de dados não encontrado` | Execute os scripts 01 e 02. |
| A tela mostra "Não foi possível falar com o servidor" | O backend não está rodando. Inicie com `npm run dev` na pasta `backend`. |
| `Ja existem usuarios…` ao rodar o script 03 | Os dados de teste já foram carregados. |
| Erro de versão do Node ao rodar o frontend | Atualize o Node.js para 20.19+ ou 22 LTS. |
