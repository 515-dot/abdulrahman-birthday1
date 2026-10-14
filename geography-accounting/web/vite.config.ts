import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' lets the same build work at https://user.github.io/repo/ and at a custom domain.
export default defineConfig({ base: './', plugins: [react()], server: { proxy: { '/api': 'http://localhost:4000' } } });
