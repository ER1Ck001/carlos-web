import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173,
    // Em desenvolvimento, /api é encaminhado para o backend
    proxy: { '/api': { target: 'http://localhost:3333', changeOrigin: true } },
  },
});
