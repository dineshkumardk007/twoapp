import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Keep the libraries in their own files.
         *
         * They change only when a dependency is upgraded, while the app code
         * changes constantly. Splitting them means a normal release does not
         * invalidate the cached copy of React, and the Android build does not
         * reship it inside the same asset.
         */
        manualChunks: {
          react: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    }
  }
});
