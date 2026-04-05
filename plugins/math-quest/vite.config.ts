import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/plugins/math-quest/',
  server: { port: 3101 },
});
