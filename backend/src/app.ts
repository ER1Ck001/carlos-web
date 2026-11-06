import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { verificarBancos } from './config/database.js';
import { autenticar } from './middlewares/auth.js';
import { tratarErros } from './middlewares/erros.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usuariosRoutes } from './modules/usuarios/usuarios.routes.js';
import { veiculosRoutes } from './modules/veiculos/veiculos.routes.js';
import { estoqueRoutes } from './modules/estoque/estoque.routes.js';
import { clientesRoutes } from './modules/clientes/clientes.routes.js';
import { vendasRoutes } from './modules/vendas/vendas.routes.js';
import { financeiroRoutes } from './modules/financeiro/financeiro.routes.js';
import { relatoriosRoutes } from './modules/relatorios/relatorios.routes.js';

export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '200kb' }));

  // Status da API e dos dois bancos (público, sem dados sensíveis)
  app.get('/api/health', async (_req, res) => {
    const bancos = await verificarBancos();
    const ok = bancos.every((b) => b.ok);
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'erro',
      bancos: bancos.map((b) => ({ banco: b.banco, ok: b.ok })),
    });
  });

  app.use('/api/auth', authRoutes);

  const api = express.Router();
  api.use(autenticar);
  api.use('/usuarios', usuariosRoutes);
  api.use('/veiculos', veiculosRoutes);
  api.use('/estoque', estoqueRoutes);
  api.use('/clientes', clientesRoutes);
  api.use('/vendas', vendasRoutes);
  api.use('/financeiro', financeiroRoutes);
  api.use('/relatorios', relatoriosRoutes);
  app.use('/api', api);

  app.use('/api', (_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
  });

  // Se o frontend já foi compilado (npm run build no frontend), o backend também o serve.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '../../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(tratarErros);
  return app;
}
