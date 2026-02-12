import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to serve .wasm files with correct MIME type
const wasmContentTypePlugin: Plugin = {
  name: 'wasm-content-type-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      next();
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), wasmContentTypePlugin],
    base: env.BASE_URL || '/',
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      exclude: ['pyodide'],
    },
  };
});
