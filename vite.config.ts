
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      /* 
       * Guidelines: Do not define process.env manually. 
       * The API key (process.env.API_KEY) is automatically injected by the environment.
       */
      resolve: {
        alias: {
          // Fix: Use path.resolve('.') instead of __dirname which is not available in ESM environments
          '@': path.resolve('.'),
        }
      }
    };
});
