// Ponto de entrada usado pela Vercel: exporta um handler sem chamar listen().
// Para rodar localmente continue usando `npm run dev` (src/server.ts).
import type { IncomingMessage, ServerResponse } from 'node:http';

// Se a API falhar ao iniciar, responde com o motivo em vez de um erro 500 genérico.
const appPronto = import('./app.js')
  .then((m) => m.criarApp())
  .catch((erro: unknown) => {
    console.error('[api] falha ao iniciar:', erro);
    return erro instanceof Error ? erro : new Error(String(erro));
  });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPronto;
  if (app instanceof Error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ erro: 'Falha ao iniciar a API.', detalhe: app.message }));
    return;
  }
  return app(req as never, res as never);
}
