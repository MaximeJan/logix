import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // En local : base = '/'. Sur GitHub Actions : base = '/nom-du-repo/'.
  base: process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mts,mjs}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Le rendu React (composants/hooks) n'est pas couvert par les tests de
      // logique pure ; types et point d'entrée n'ont rien d'exécutable.
      exclude: ['src/main.tsx', 'src/domain/types.ts', 'src/vite-env.d.ts'],
    },
  },
});
