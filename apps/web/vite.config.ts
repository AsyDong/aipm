import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/speech/': { target: 'http://127.0.0.1:8787' },
    },
  },
  build: {
    rollupOptions: {
      // Phaser rarely changes: a separate file stays cached across app upgrades.
      output: {
        manualChunks: (id) =>
          id.includes('/node_modules/phaser/') ? 'phaser' : undefined,
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
