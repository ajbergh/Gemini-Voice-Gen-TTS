/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * vite.config.ts — Vite Build & Dev Server Configuration
 *
 * Configures the React plugin, development server (port 3000, localhost-only),
 * API proxy to the Go backend (port 8080), and path aliases.
 */

import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
      port: 3000,
      host: 'localhost',
      proxy: {
        '/api': 'http://localhost:8080',
      },
    },
    publicDir: 'assets',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});
