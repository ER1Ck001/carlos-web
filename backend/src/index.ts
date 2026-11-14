// Ponto de entrada usado pela Vercel: exporta o app Express sem chamar listen().
// Para rodar localmente continue usando `npm run dev` (src/server.ts).
import { criarApp } from './app.js';

export default criarApp();
