import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, forward /api calls to the Express server so there are no CORS issues
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
});
