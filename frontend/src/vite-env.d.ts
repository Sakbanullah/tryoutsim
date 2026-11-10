/// <reference types="vite/client" />

/** `VITE_API_MODE=http` selects the HTTP client (`src/data/httpClient.ts`); anything else keeps the mock. */
interface ImportMetaEnv {
  readonly VITE_API_MODE?: string
}
