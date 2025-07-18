import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework (most stable)
          vendor: ['react', 'react-dom', 'react-router-dom'],

          // Supabase and authentication (heavy, separate chunk)
          supabase: ['@supabase/supabase-js'],

          // Payment system (only loads when needed)
          stripe: ['@stripe/stripe-js', 'stripe'],

          // UI components (frequently updated)
          ui: ['@headlessui/react'],

          // Icons (optimize lucide-react import)
          icons: ['lucide-react'],

          // State management (small, stable)
          state: ['zustand'],

          // Image processing (large, separate)
          imaging: ['jszip'],

          // Admin components (lazy loaded)
          admin: (id: string) => {
            if (
              id.includes('src/components/admin') ||
              id.includes('src/pages/admin') ||
              id.includes('AdminPage')
            ) {
              return 'admin';
            }
            return undefined;
          },
        },
      },
    },
  },
});
