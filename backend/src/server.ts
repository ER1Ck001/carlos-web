import { env } from './config/env.js';
import { fecharBancos, verificarBancos } from './config/database.js';
import { criarApp } from './app.js';

async function iniciar() {
  const bancos = await verificarBancos();
  for (const b of bancos) {
    if (b.ok) console.log(`[db] conectado: ${b.banco}`);
    else console.error(`[db] FALHA ao conectar em ${b.banco}: ${b.erro}`);
  }
  if (bancos.some((b) => !b.ok)) {
    console.error(
      '[db] Verifique se o MySQL está rodando, se os scripts SQL foram executados e se o arquivo backend/.env está correto.\n' +
        '     A API vai iniciar mesmo assim e responderá com mensagens de erro até a conexão funcionar.',
    );
  }

  const server = criarApp().listen(env.PORT, () => {
    console.log(`[api] rodando em http://localhost:${env.PORT}`);
  });

  const encerrar = () => {
    server.close(async () => {
      await fecharBancos();
      process.exit(0);
    });
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

iniciar();
