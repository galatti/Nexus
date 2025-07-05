import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/index.html'),
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'markdown-vendor': [
            'react-markdown', 
            'remark-gfm'
          ],
          'utils-vendor': ['zustand']
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'vendor') {
            return 'assets/vendor-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    },
    target: 'esnext',
    minify: false, // Disable minification completely in development
    sourcemap: true, // Enable source maps for debugging
    cssCodeSplit: true
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'react-markdown',
      'remark-gfm'
    ],
    exclude: [
      'winston'
    ]
  },
  server: {
    port: process.env.DEV_SERVER_PORT ? Number(process.env.DEV_SERVER_PORT) : 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@preload': resolve(__dirname, 'src/preload')
    }
  },
  define: {
    __IS_DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
}); 