import { defineConfig } from 'vite';
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
});
