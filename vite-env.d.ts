/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  // Ajoutez ici d'autres variables d'environnement VITE_... si vous en créez d'autres
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}