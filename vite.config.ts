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
                includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo192.png', 'firebase-messaging-sw.js'],
                manifest: {
                    name: 'OracleFish',
                    short_name: 'Oracle',
                    description: 'Application de prédiction de pêche intelligente',
                    theme_color: '#fdfbf7',
                    background_color: '#fdfbf7',
                    display: 'standalone',
                    orientation: 'portrait',
                    start_url: '/', 
                    scope: '/',  
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
                            src: 'logo192.png', // Idéalement, utilise un 180x180 ici
                            sizes: '180x180',
                            type: 'image/png',
                            purpose: 'apple touch icon'
                        }
                    ]
                }
            })
        ],
        define: {
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
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            if (id.includes('firebase')) {
                                return 'vendor-firebase';
                            }
                            if (id.includes('recharts') || id.includes('d3')) {
                                return 'vendor-charts';
                            }
                            if (id.includes('lucide-react')) {
                                return 'vendor-ui-icons';
                            }
                            return 'vendor';
                        }
                    }
                }
            }
        }
    };
});