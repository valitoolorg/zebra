/*
    Copyright (C) 2026 valitool GmbH

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function propertiesToJSONPlugin(): PluginOption {
  return {
    name: 'properties-to-json',
    transform(code: string, id: string) {
      if (id.endsWith('.properties')) {
        const lines = code.split('\n');
        const json: Record<string, string> = {};
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...values] = trimmed.split('=');
            if (key) {
              json[key.trim()] = values.join('=').trim();
            }
          }
        });
        
        return {
          code: `export default ${JSON.stringify(json)};`,
          map: null
        };
      }
    }
  };
}

export default defineConfig({
  build: {
    assetsDir: '',
    rollupOptions: {
      output: {
        entryFileNames: `[name]-[hash].js`,
        chunkFileNames: `[name]-[hash].js`,
        assetFileNames: `[name]-[hash].[ext]`
      }
    }
  },
  plugins: [
    propertiesToJSONPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
        'apple-touch-icon-180x180.png'
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mjs}'],
        // Increase limit to ensure PDF.js worker files are cached for offline use
        maximumFileSizeToCacheInBytes: 3000000 
      },
      manifest: {
        name: 'Zebra Anonymizer',
        short_name: 'Zebra',
        description: 'Anonymize sensitive data in e-invoices and PDF documents',
        theme_color: '#87AC50',
        background_color: '#87AC50',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
});
