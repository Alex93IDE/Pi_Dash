/// <reference types="vite/client" />

// Inyectados en build por vite.config.ts (define).
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
