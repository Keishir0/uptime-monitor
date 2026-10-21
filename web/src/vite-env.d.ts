/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API em produção. Em dev, o proxy do Vite atende /api. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
