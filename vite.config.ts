import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo192.png'],
                manifest: {
                    name: 'OracleFish',
                    short_name: 'Oracle',
                    description: 'Application de prédiction de pêche intelligente',
                    theme_color: '#fdfbf7',
                    background_color: '#fdfbf7',
                    display: 'standalone',
                    icons: [
                        {
                            src: 'logo192.png',
                            sizes: '192x192',
                            type: 'image/png'
                        },
                        {
                            src: 'logo512.png',
                            sizes: '512x512',
                            type: 'image/png'
                        },
                        {
                            src: 'logo512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any maskable'
                        }
                    ]
                },
                workbox: {
                    // Stratégie de cache pour la résilience offline [cite: 10, 379]
                    runtimeCaching: [
                        {
                            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/,
                            handler: 'NetworkFirst', 
                            options: {
                                cacheName: 'open-meteo-cache',
                                expiration: {
                                    maxAgeSeconds: 1800 // Cache tactique de 30 minutes 
                                },
                                cacheableResponse: {
                                    statuses: [0, 200]
                                }
                            }
                        },
                        {
                            urlPattern: /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|esm\.sh)\/.*/,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'external-resources',
                                expiration: {
                                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 jours
                                }
                            }
                        }
                    ]
                }
            })
        ],
        // Note: L'usage de process.env ici est déprécié par tes specs de sécurité v7.3 [cite: 15, 28]
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        },
        build: {
            target: 'esnext',
            minify: 'esbuild',
            chunkSizeWarningLimit: 600,
            rollupOptions: {
                output: {
                    // Stratégie de fragmentation pour réduire la taille du bundle principal
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            // On isole Firebase qui est assez lourd
                            if (id.includes('firebase')) {
                                return 'vendor-firebase';
                            }
                            // On isole les graphiques (Recharts) utilisés dans l'Oracle 72h [cite: 125, 519]
                            if (id.includes('recharts') || id.includes('d3')) {
                                return 'vendor-charts';
                            }
                            // On isole les icônes Lucide
                            if (id.includes('lucide-react')) {
                                return 'vendor-ui-icons';
                            }
                            // Le reste des dépendances (React, etc.)
                            return 'vendor';
                        }
                    }
                }
            }
        }
    };
});