import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/plugins/money-sense/',
  server: { port: 3103 },
});
