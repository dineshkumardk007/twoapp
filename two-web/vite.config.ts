import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Lists the files the build makes that its manifest leaves out - Web
 * Workers (the ambient sound renderer) - in sw-precache.json, which the
 * service worker reads to precache them with everything else. Otherwise the
 * worker was cached only once fetched, and a first ambience started offline
 * had to render on the main thread.
 */
function precacheExtras(): Plugin {
  return {
    name: 'two-precache-extras',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(f => /\.worker-[\w-]+\.js$/.test(f));
      this.emitFile({ type: 'asset', fileName: 'sw-precache.json', source: JSON.stringify(files) });
    }
  };
}

export default defineConfig({
  plugins: [react(), precacheExtras()],
  base: './',
  server: {
    port: 3000,
    host: true
  },
  build: {
    // Emitted so the service worker can discover every code-split chunk by name
    // and precache it. Without that list, a screen you had not visited would be
    // the one thing that did not work offline.
    manifest: true,
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
