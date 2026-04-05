import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/plugins/fact-or-fiction/',
  server: { port: 3104 },
});
