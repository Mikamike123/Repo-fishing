import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            // NOUVEAU: Configuration du Proxy pour contourner CORS Hubeau
            proxy: {
                // Intercepter les requêtes commençant par /hubeau-proxy
                '/hubeau-proxy': {
                    target: 'https://hubeau.eaufrance.fr',
                    changeOrigin: true, // Crucial pour que Hubeau accepte la requête
                    
                    // NOUVEAU: Ajout d'en-têtes pour simuler un appel direct et contourner le 403
                    headers: {
                        // Simuler l'en-tête Referer comme si la requête venait de Hubeau
                        'Referer': 'https://hubeau.eaufrance.fr/', 
                        // Simuler un navigateur classique
                        'User-Agent': 'Mozilla/5.0',
                        'host': 'hubeau.eaufrance.fr' 
                    },

                    // CORRECTION DU REWRITE : Utiliser un remplacement simple (la cause du 404/403 est ailleurs)
                    rewrite: (path) => path.replace('/hubeau-proxy', ''),
                    
                    // Sécurité : autoriser les appels HTTPS
                    secure: true, 
                },
            },
        },
        plugins: [react()],
        define: {
            // Utilisation des variables d'environnement telles que définies dans le fichier .env
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});