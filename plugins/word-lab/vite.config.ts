import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/plugins/word-lab/',
  server: { port: 3102 },
});
